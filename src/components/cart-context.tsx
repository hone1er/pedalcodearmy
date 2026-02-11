"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  isStorefrontConfigured,
  createCart,
  getCart,
  addToCart,
  updateCartLines,
  removeFromCart,
  createCheckoutUrl,
  type ShopifyCart,
  SHOPIFY_VARIANT_IDS,
} from "@/lib/shopify";

export interface CartItem {
  variantId: string;
  lineId?: string; // Shopify line item ID for updates
  productId: string;
  name: string;
  price: string;
  quantity: number;
  image?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity" | "lineId">) => Promise<void>;
  removeItem: (variantId: string) => Promise<void>;
  updateQuantity: (variantId: string, quantity: number) => Promise<void>;
  clearCart: () => void;
  itemCount: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  checkoutUrl: string;
  isLoading: boolean;
  isShopifyCart: boolean;
}

const CartContext = createContext<CartContextType | null>(null);

const CART_STORAGE_KEY = "pca-cart";
const SHOPIFY_CART_ID_KEY = "pca-shopify-cart-id";

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

// Convert Shopify cart to local cart items
function shopifyCartToItems(cart: ShopifyCart): CartItem[] {
  return cart.lines.edges.map((edge) => {
    const line = edge.node;
    const variantId = line.merchandise.id.replace("gid://shopify/ProductVariant/", "");
    return {
      variantId,
      lineId: line.id,
      productId: variantId,
      name: line.merchandise.product.title,
      price: `$${parseFloat(line.merchandise.price.amount).toFixed(2)}`,
      quantity: line.quantity,
      image: line.merchandise.image?.url,
    };
  });
}

// Get the GraphQL variant ID from a numeric ID
function getGraphQLVariantId(numericId: string): string {
  // Check if it's already a GraphQL ID
  if (numericId.startsWith("gid://")) {
    return numericId;
  }
  // Check our mapping first
  for (const [, gqlId] of Object.entries(SHOPIFY_VARIANT_IDS)) {
    if (gqlId.includes(numericId)) {
      return gqlId;
    }
  }
  // Fallback: construct the GraphQL ID
  return `gid://shopify/ProductVariant/${numericId}`;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shopifyCartId, setShopifyCartId] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string>("#");
  const [useShopify, setUseShopify] = useState(false);

  // Initialize cart on mount
  useEffect(() => {
    const initCart = async () => {
      const shopifyConfigured = isStorefrontConfigured();
      setUseShopify(shopifyConfigured);

      if (shopifyConfigured) {
        // Try to load existing Shopify cart
        const storedCartId =
          localStorage.getItem(SHOPIFY_CART_ID_KEY) ??
          getCookie(SHOPIFY_CART_ID_KEY);

        if (storedCartId) {
          try {
            const cart = await getCart(storedCartId);
            if (cart) {
              setShopifyCartId(cart.id);
              setItems(shopifyCartToItems(cart));
              setCheckoutUrl(cart.checkoutUrl);
              localStorage.setItem(SHOPIFY_CART_ID_KEY, cart.id);
              setCookie(SHOPIFY_CART_ID_KEY, cart.id, 7);
            } else {
              // Cart expired or invalid, fall back to local mode
              setUseShopify(false);
              localStorage.removeItem(SHOPIFY_CART_ID_KEY);
              deleteCookie(SHOPIFY_CART_ID_KEY);
            }
          } catch (error) {
            console.error("Failed to load Shopify cart:", error);
            // API auth failed — fall back to local cart mode
            setUseShopify(false);
            localStorage.removeItem(SHOPIFY_CART_ID_KEY);
            deleteCookie(SHOPIFY_CART_ID_KEY);
          }
        }
      } else {
        // Fallback to localStorage cart
        let cartData: CartItem[] = [];
        const storedLocal = localStorage.getItem(CART_STORAGE_KEY);
        if (storedLocal) {
          try {
            const parsed: unknown = JSON.parse(storedLocal);
            if (Array.isArray(parsed)) {
              cartData = parsed as CartItem[];
            }
          } catch {
            // Invalid JSON
          }
        }

        if (cartData.length === 0) {
          const storedCookie = getCookie(CART_STORAGE_KEY);
          if (storedCookie) {
            try {
              const parsed: unknown = JSON.parse(storedCookie);
              if (Array.isArray(parsed)) {
                cartData = parsed as CartItem[];
              }
            } catch {
              // Invalid JSON
            }
          }
        }

        setItems(cartData);
      }

      setIsHydrated(true);
    };

    void initCart();
  }, []);

  // Update checkout URL when items change (for non-Shopify mode)
  useEffect(() => {
    if (isHydrated && !useShopify && items.length > 0) {
      const url = createCheckoutUrl(
        items.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        }))
      );
      setCheckoutUrl(url);
    } else if (items.length === 0) {
      setCheckoutUrl("#");
    }
  }, [items, isHydrated, useShopify]);

  // Save to localStorage/cookies when items change (non-Shopify mode)
  useEffect(() => {
    if (isHydrated && !useShopify) {
      const cartJson = JSON.stringify(items);
      localStorage.setItem(CART_STORAGE_KEY, cartJson);
      if (items.length > 0) {
        setCookie(CART_STORAGE_KEY, cartJson, 7);
      } else {
        deleteCookie(CART_STORAGE_KEY);
      }
    }
  }, [items, isHydrated, useShopify]);

  const addItemLocal = useCallback(
    (item: Omit<CartItem, "quantity" | "lineId">) => {
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
    },
    []
  );

  const addItem = useCallback(
    async (item: Omit<CartItem, "quantity" | "lineId">) => {
      setIsLoading(true);

      try {
        if (useShopify) {
          const graphqlVariantId = getGraphQLVariantId(item.variantId);

          if (shopifyCartId) {
            // Add to existing cart
            const cart = await addToCart(shopifyCartId, [
              { merchandiseId: graphqlVariantId, quantity: 1 },
            ]);
            setItems(shopifyCartToItems(cart));
            setCheckoutUrl(cart.checkoutUrl);
          } else {
            // Create new cart with item
            const cart = await createCart([
              { merchandiseId: graphqlVariantId, quantity: 1 },
            ]);
            setShopifyCartId(cart.id);
            setItems(shopifyCartToItems(cart));
            setCheckoutUrl(cart.checkoutUrl);
            localStorage.setItem(SHOPIFY_CART_ID_KEY, cart.id);
            setCookie(SHOPIFY_CART_ID_KEY, cart.id, 7);
          }
        } else {
          addItemLocal(item);
        }
      } catch (error) {
        console.error("Failed to add item to cart:", error);
        // Shopify API failed — switch to local cart mode
        setUseShopify(false);
        setShopifyCartId(null);
        localStorage.removeItem(SHOPIFY_CART_ID_KEY);
        deleteCookie(SHOPIFY_CART_ID_KEY);
        addItemLocal(item);
      } finally {
        setIsLoading(false);
        setIsOpen(true);
      }
    },
    [useShopify, shopifyCartId, addItemLocal]
  );

  const removeItem = useCallback(
    async (variantId: string) => {
      setIsLoading(true);

      try {
        if (useShopify && shopifyCartId) {
          const item = items.find((i) => i.variantId === variantId);
          if (item?.lineId) {
            const cart = await removeFromCart(shopifyCartId, [item.lineId]);
            setItems(shopifyCartToItems(cart));
            setCheckoutUrl(cart.checkoutUrl);
          }
        } else {
          setItems((prev) => prev.filter((i) => i.variantId !== variantId));
        }
      } catch (error) {
        console.error("Failed to remove item from cart:", error);
        setUseShopify(false);
        setItems((prev) => prev.filter((i) => i.variantId !== variantId));
      } finally {
        setIsLoading(false);
      }
    },
    [useShopify, shopifyCartId, items]
  );

  const updateQuantity = useCallback(
    async (variantId: string, quantity: number) => {
      if (quantity <= 0) {
        await removeItem(variantId);
        return;
      }

      setIsLoading(true);

      try {
        if (useShopify && shopifyCartId) {
          const item = items.find((i) => i.variantId === variantId);
          if (item?.lineId) {
            const cart = await updateCartLines(shopifyCartId, [
              { id: item.lineId, quantity },
            ]);
            setItems(shopifyCartToItems(cart));
            setCheckoutUrl(cart.checkoutUrl);
          }
        } else {
          setItems((prev) =>
            prev.map((i) =>
              i.variantId === variantId ? { ...i, quantity } : i
            )
          );
        }
      } catch (error) {
        console.error("Failed to update quantity:", error);
        setUseShopify(false);
        setItems((prev) =>
          prev.map((i) =>
            i.variantId === variantId ? { ...i, quantity } : i
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [useShopify, shopifyCartId, items, removeItem]
  );

  const clearCart = useCallback(() => {
    setItems([]);
    setCheckoutUrl("#");

    if (useShopify) {
      // Clear Shopify cart ID - a new cart will be created on next add
      setShopifyCartId(null);
      localStorage.removeItem(SHOPIFY_CART_ID_KEY);
      deleteCookie(SHOPIFY_CART_ID_KEY);
    } else {
      localStorage.removeItem(CART_STORAGE_KEY);
      deleteCookie(CART_STORAGE_KEY);
    }
  }, [useShopify]);

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
        checkoutUrl,
        isLoading,
        isShopifyCart: useShopify,
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
