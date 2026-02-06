"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export interface CartItem {
  variantId: string;
  productId: string;
  name: string;
  price: string;
  quantity: number;
  image?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | null>(null);

const CART_STORAGE_KEY = "pca-cart";
const CART_COOKIE_KEY = "pca-cart";

// Cookie utility functions
function setCookie(name: string, value: string, days = 7) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  const nameEQ = `${name}=`;
  const ca = document.cookie.split(";");
  for (const item of ca) {
    const c = item.trimStart();
    if (c.startsWith(nameEQ)) {
      return decodeURIComponent(c.substring(nameEQ.length));
    }
  }
  return null;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load cart from localStorage and cookies on mount
  useEffect(() => {
    let cartData: CartItem[] = [];

    // Try localStorage first
    const storedLocal = localStorage.getItem(CART_STORAGE_KEY);
    if (storedLocal) {
      try {
        const parsed: unknown = JSON.parse(storedLocal);
        if (Array.isArray(parsed)) {
          cartData = parsed as CartItem[];
        }
      } catch {
        // Invalid JSON, try cookies
      }
    }

    // If localStorage is empty, try cookies as fallback
    if (cartData.length === 0) {
      const storedCookie = getCookie(CART_COOKIE_KEY);
      if (storedCookie) {
        try {
          const parsed: unknown = JSON.parse(storedCookie);
          if (Array.isArray(parsed)) {
            cartData = parsed as CartItem[];
          }
        } catch {
          // Invalid JSON in cookie
        }
      }
    }

    setItems(cartData);
    setIsHydrated(true);
  }, []);

  // Save cart to both localStorage and cookies on change
  useEffect(() => {
    if (isHydrated) {
      const cartJson = JSON.stringify(items);

      // Save to localStorage
      localStorage.setItem(CART_STORAGE_KEY, cartJson);

      // Save to cookie (for cross-session persistence)
      // Only store if cart has items to avoid large empty cookies
      if (items.length > 0) {
        setCookie(CART_COOKIE_KEY, cartJson, 7); // 7 days expiry
      } else {
        deleteCookie(CART_COOKIE_KEY);
      }
    }
  }, [items, isHydrated]);

  const addItem = (item: Omit<CartItem, "quantity">) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.variantId === item.variantId);
      if (existing) {
        return prev.map((i) =>
          i.variantId === item.variantId
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    setIsOpen(true);
  };

  const removeItem = (variantId: string) => {
    setItems((prev) => prev.filter((i) => i.variantId !== variantId));
  };

  const updateQuantity = (variantId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(variantId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.variantId === variantId ? { ...i, quantity } : i))
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        itemCount,
        isOpen,
        setIsOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
