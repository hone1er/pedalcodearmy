"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
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
  extractNumericVariantId,
  isShopifyNetworkError,
  ShopifyUserError,
  type ShopifyCart,
} from "@/lib/shopify";
import { hasCookieConsent } from "@/components/cookie-consent";

export interface CartItem {
  variantId: string;
  lineId?: string; // Shopify line item ID for updates
  productId: string;
  name: string;
  price: string;
  quantity: number;
  image?: string;
}

type NewCartItem = Omit<CartItem, "quantity" | "lineId">;

interface CartContextType {
  items: CartItem[];
  /** Total number of units in the cart. */
  totalItems: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  /** Resolves `true` when the item was added, `false` when it was rejected/failed (see `error`). */
  addItem: (item: NewCartItem) => Promise<boolean>;
  updateQuantity: (variantId: string, quantity: number) => Promise<void>;
  removeItem: (variantId: string) => Promise<void>;
  clearCart: () => void;
  /** Checkout URL, or `null` when checkout isn't currently available. */
  checkoutUrl: string | null;
  isLoading: boolean;
  /** True when the cart is backed by a live Shopify cart. */
  isShopifyConnected: boolean;
  /** User-facing error from the last cart operation, if any. */
  error: string | null;
  clearError: () => void;
  /** Cart subtotal (Shopify's authoritative amount when synced). */
  subtotalAmount: number;
  currencyCode: string;

  /** @deprecated use `totalItems` */
  itemCount: number;
  /** @deprecated use `openCart` / `closeCart` */
  setIsOpen: (open: boolean) => void;
  /** @deprecated use `isShopifyConnected` */
  isShopifyCart: boolean;
}

const CartContext = createContext<CartContextType | null>(null);

const CART_STORAGE_KEY = "pca-cart";
const SHOPIFY_CART_ID_KEY = "pca-shopify-cart-id";
const CART_ID_COOKIE_DAYS = 10; // Shopify carts expire ~10 days after last update

const NETWORK_ERROR_MESSAGE =
  "We couldn't reach Shopify. Check your connection and try again.";
const EXPIRED_CART_MESSAGE =
  "Your previous cart expired, so we started a fresh one.";
const SYNC_FAILED_MESSAGE =
  "We couldn't load your saved cart right now. Close and reopen the cart to try again.";

// ---------------------------------------------------------------------------
// Storage helpers
//
// Only the Shopify cart ID is ever written to a cookie. Full cart contents
// (local fallback mode) live in Web Storage. Without cookie consent, nothing
// persistent is written: we use sessionStorage instead.
// ---------------------------------------------------------------------------

function safeStorage(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function storageGet(kind: "local" | "session", key: string): string | null {
  try {
    return safeStorage(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function storageSet(kind: "local" | "session", key: string, value: string) {
  try {
    safeStorage(kind)?.setItem(key, value);
  } catch {
    // Quota exceeded / storage disabled — keep the cart in memory only.
  }
}

function storageRemove(kind: "local" | "session", key: string) {
  try {
    safeStorage(kind)?.removeItem(key);
  } catch {
    // ignore
  }
}

function cookieSecureFlag(): string {
  return window.location.protocol === "https:" ? "; Secure" : "";
}

function setCookie(name: string, value: string, days: number) {
  const maxAge = Math.round(days * 24 * 60 * 60);
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax${cookieSecureFlag()}`;
}

function getCookie(name: string): string | null {
  const nameEQ = `${name}=`;
  for (const item of document.cookie.split(";")) {
    const c = item.trimStart();
    if (c.startsWith(nameEQ)) {
      try {
        return decodeURIComponent(c.substring(nameEQ.length));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; max-age=0; path=/; SameSite=Lax${cookieSecureFlag()}`;
}

function readStoredCartId(): string | null {
  return (
    getCookie(SHOPIFY_CART_ID_KEY) ??
    storageGet("session", SHOPIFY_CART_ID_KEY) ??
    // Legacy location from earlier builds.
    storageGet("local", SHOPIFY_CART_ID_KEY)
  );
}

function persistCartId(cartId: string) {
  if (hasCookieConsent()) {
    setCookie(SHOPIFY_CART_ID_KEY, cartId, CART_ID_COOKIE_DAYS);
    storageRemove("session", SHOPIFY_CART_ID_KEY);
  } else {
    deleteCookie(SHOPIFY_CART_ID_KEY);
    storageSet("session", SHOPIFY_CART_ID_KEY, cartId);
  }
  storageRemove("local", SHOPIFY_CART_ID_KEY);
}

function forgetCartId() {
  deleteCookie(SHOPIFY_CART_ID_KEY);
  storageRemove("session", SHOPIFY_CART_ID_KEY);
  storageRemove("local", SHOPIFY_CART_ID_KEY);
}

function parseStoredItems(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CartItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as CartItem).variantId === "string" &&
        typeof (item as CartItem).quantity === "number",
    );
  } catch {
    return [];
  }
}

function readLocalItems(): CartItem[] {
  const fromLocal = parseStoredItems(storageGet("local", CART_STORAGE_KEY));
  if (fromLocal.length > 0) return fromLocal;
  return parseStoredItems(storageGet("session", CART_STORAGE_KEY));
}

function persistLocalItems(items: CartItem[]) {
  const target = hasCookieConsent() ? "local" : "session";
  const other = target === "local" ? "session" : "local";
  storageRemove(other, CART_STORAGE_KEY);
  if (items.length > 0) {
    storageSet(target, CART_STORAGE_KEY, JSON.stringify(items));
  } else {
    storageRemove(target, CART_STORAGE_KEY);
  }
}

// ---------------------------------------------------------------------------
// Price helpers
// ---------------------------------------------------------------------------

/** Parse a display price like "$1,234.50" or "USD 20" into a number. */
export function parsePrice(price: string): number {
  const cleaned = price.replace(/[^0-9.]/g, "");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : 0;
}

/** Format a decimal currency amount (dollars, not cents). */
export function formatMoney(amount: number, currencyCode = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

// ---------------------------------------------------------------------------
// Shopify <-> local mapping
// ---------------------------------------------------------------------------

function shopifyCartToItems(cart: ShopifyCart): CartItem[] {
  return cart.lines.edges.map((edge) => {
    const line = edge.node;
    const variantId = extractNumericVariantId(line.merchandise.id);
    const variantTitle = line.merchandise.title?.trim();
    const name =
      variantTitle && variantTitle.toLowerCase() !== "default title"
        ? `${line.merchandise.product.title} — ${variantTitle}`
        : line.merchandise.product.title;
    const amount = Number.parseFloat(line.merchandise.price.amount);
    return {
      variantId,
      lineId: line.id,
      productId: variantId,
      name,
      price: formatMoney(
        Number.isFinite(amount) ? amount : 0,
        line.merchandise.price.currencyCode,
      ),
      quantity: line.quantity,
      image: line.merchandise.image?.url,
    };
  });
}

/** Convert a numeric or GraphQL variant ID to a GraphQL global ID. */
function getGraphQLVariantId(variantId: string): string {
  if (variantId.startsWith("gid://")) {
    return variantId;
  }
  const numericId = extractNumericVariantId(variantId).trim();
  return `gid://shopify/ProductVariant/${numericId}`;
}

function sameVariant(a: string, b: string): boolean {
  return extractNumericVariantId(a) === extractNumericVariantId(b);
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof ShopifyUserError) {
    return error.message || fallback;
  }
  if (isShopifyNetworkError(error)) {
    return NETWORK_ERROR_MESSAGE;
  }
  return fallback;
}

interface ShopifySummary {
  checkoutUrl: string;
  subtotalAmount: number;
  currencyCode: string;
  totalQuantity: number;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const useShopify = isStorefrontConfigured();

  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpenState] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [shopifyCartId, setShopifyCartId] = useState<string | null>(null);
  const [shopifySummary, setShopifySummary] = useState<ShopifySummary | null>(null);
  const [syncFailed, setSyncFailed] = useState(false);

  // Refs mirror state so async operations always see the latest values.
  const cartIdRef = useRef<string | null>(null);
  const itemsRef = useRef<CartItem[]>([]);
  // In-flight cart creation, so concurrent adds share one new cart.
  const createCartPromiseRef = useRef<Promise<ShopifyCart> | null>(null);
  // In-flight initial/refresh sync, so mutations wait for the stored cart to load.
  const syncPromiseRef = useRef<Promise<void> | null>(null);
  // Monotonic counter so a slow, older response never overwrites a newer one.
  const responseSeqRef = useRef(0);
  const appliedSeqRef = useRef(0);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const setCartId = useCallback((cartId: string | null) => {
    cartIdRef.current = cartId;
    setShopifyCartId(cartId);
    if (cartId) {
      persistCartId(cartId);
    } else {
      forgetCartId();
    }
  }, []);

  const applyShopifyCart = useCallback(
    (cart: ShopifyCart, seq: number) => {
      if (seq < appliedSeqRef.current) return;
      appliedSeqRef.current = seq;
      // Always re-persist: picks up consent granted after the cart was created
      // (moves the ID from sessionStorage to the cookie) and refreshes expiry.
      setCartId(cart.id);
      const nextItems = shopifyCartToItems(cart);
      itemsRef.current = nextItems;
      setItems(nextItems);
      const subtotal = Number.parseFloat(cart.cost.subtotalAmount.amount);
      setShopifySummary({
        checkoutUrl: cart.checkoutUrl,
        subtotalAmount: Number.isFinite(subtotal) ? subtotal : 0,
        currencyCode: cart.cost.subtotalAmount.currencyCode,
        totalQuantity: cart.totalQuantity,
      });
      setSyncFailed(false);
    },
    [setCartId],
  );

  const resetShopifyCart = useCallback(() => {
    setCartId(null);
    itemsRef.current = [];
    setItems([]);
    setShopifySummary(null);
  }, [setCartId]);

  const runTracked = useCallback(async <T,>(op: () => Promise<T>): Promise<T> => {
    setPendingCount((n) => n + 1);
    try {
      return await op();
    } finally {
      setPendingCount((n) => Math.max(0, n - 1));
    }
  }, []);

  /** Load the stored Shopify cart. Keeps the ID on network failure. */
  const syncStoredCart = useCallback((): Promise<void> => {
    if (syncPromiseRef.current) return syncPromiseRef.current;
    const cartId = cartIdRef.current;
    if (!cartId) return Promise.resolve();

    const seq = ++responseSeqRef.current;
    const promise = (async () => {
      try {
        const cart = await getCart(cartId);
        if (cartIdRef.current !== cartId) return; // superseded meanwhile
        setError((prev) => (prev === SYNC_FAILED_MESSAGE ? null : prev));
        if (cart) {
          applyShopifyCart(cart, seq);
        } else {
          // Shopify confirmed the cart is gone (expired or checked out).
          // Clear the stale ID and stay in Shopify mode.
          resetShopifyCart();
          setSyncFailed(false);
        }
      } catch (err) {
        // Transient failure: keep the cart ID so the cart isn't lost.
        console.error("Failed to load Shopify cart:", err);
        setSyncFailed(true);
        setError(SYNC_FAILED_MESSAGE);
      }
    })().finally(() => {
      syncPromiseRef.current = null;
    });
    syncPromiseRef.current = promise;
    return promise;
  }, [applyShopifyCart, resetShopifyCart]);

  // Initialize cart on mount
  useEffect(() => {
    // Never keep full cart JSON in a cookie (legacy builds did).
    deleteCookie(CART_STORAGE_KEY);

    if (useShopify) {
      const storedCartId = readStoredCartId();
      if (storedCartId) {
        cartIdRef.current = storedCartId;
        setShopifyCartId(storedCartId);
        // Re-persist under the current consent rules / location.
        persistCartId(storedCartId);
        void runTracked(syncStoredCart).finally(() => setIsHydrated(true));
        return;
      }
    } else {
      const merged = new Map<string, CartItem>();
      for (const item of readLocalItems()) {
        const id = extractNumericVariantId(item.variantId);
        const existing = merged.get(id);
        merged.set(
          id,
          existing
            ? { ...existing, quantity: existing.quantity + item.quantity }
            : { ...item, variantId: id },
        );
      }
      const restored = Array.from(merged.values());
      itemsRef.current = restored;
      setItems(restored);
    }
    setIsHydrated(true);
  }, [useShopify, runTracked, syncStoredCart]);

  // Persist local-mode cart contents (never to a cookie).
  useEffect(() => {
    if (isHydrated && !useShopify) {
      persistLocalItems(items);
    }
  }, [items, isHydrated, useShopify]);

  // Re-home persisted cart state as soon as the shopper accepts or declines
  // cookies, instead of waiting for the next cart mutation or page load.
  // Attached on mount; the init effect above has already populated the refs.
  useEffect(() => {
    const handleConsentChange = () => {
      const cartId = cartIdRef.current;
      if (cartId) {
        // Accepted: 10-day cookie. Declined: delete the cookie and keep the
        // active cart only in sessionStorage.
        persistCartId(cartId);
      } else if (!hasCookieConsent()) {
        // No active Shopify cart: just drop any persistent copies.
        deleteCookie(SHOPIFY_CART_ID_KEY);
        storageRemove("local", SHOPIFY_CART_ID_KEY);
      }
      if (useShopify) {
        // Shopify mode never uses `pca-cart`; drop any legacy persistent copy.
        if (!hasCookieConsent()) storageRemove("local", CART_STORAGE_KEY);
      } else {
        // Local mode: localStorage when accepted, sessionStorage when declined.
        persistLocalItems(itemsRef.current);
      }
    };

    window.addEventListener("pca-cookie-consent-changed", handleConsentChange);
    return () => {
      window.removeEventListener("pca-cookie-consent-changed", handleConsentChange);
    };
  }, [useShopify]);

  /** Get the current cart ID, creating a cart (once) if needed. */
  const ensureCart = useCallback(
    async (initialLines: { merchandiseId: string; quantity: number }[]) => {
      if (syncPromiseRef.current) {
        await syncPromiseRef.current;
      }
      if (cartIdRef.current) {
        return { cartId: cartIdRef.current, created: false as const };
      }
      if (createCartPromiseRef.current) {
        const cart = await createCartPromiseRef.current;
        return { cartId: cart.id, created: false as const };
      }
      const seq = ++responseSeqRef.current;
      const promise = createCart(initialLines);
      createCartPromiseRef.current = promise;
      try {
        const cart = await promise;
        applyShopifyCart(cart, seq);
        return { cartId: cart.id, created: true as const };
      } finally {
        createCartPromiseRef.current = null;
      }
    },
    [applyShopifyCart],
  );

  const addItemLocal = useCallback((item: NewCartItem) => {
    const normalizedVariantId = extractNumericVariantId(item.variantId);
    setItems((prev) => {
      const existing = prev.find((i) => sameVariant(i.variantId, normalizedVariantId));
      if (existing) {
        return prev.map((i) =>
          sameVariant(i.variantId, normalizedVariantId)
            ? { ...i, variantId: normalizedVariantId, quantity: i.quantity + 1 }
            : i,
        );
      }
      return [...prev, { ...item, variantId: normalizedVariantId, quantity: 1 }];
    });
  }, []);

  const addItem = useCallback(
    async (item: NewCartItem): Promise<boolean> => {
      setError(null);

      if (!useShopify) {
        addItemLocal(item);
        setIsOpenState(true);
        return true;
      }

      const lines = [{ merchandiseId: getGraphQLVariantId(item.variantId), quantity: 1 }];

      const addLines = async () => {
        const { cartId, created } = await ensureCart(lines);
        if (created) return; // the new cart was created with these lines
        const seq = ++responseSeqRef.current;
        applyShopifyCart(await addToCart(cartId, lines), seq);
      };

      return runTracked(async () => {
        try {
          const staleCartId = cartIdRef.current;
          try {
            await addLines();
          } catch (err) {
            if (!(err instanceof ShopifyUserError && err.isCartNotFound)) {
              throw err;
            }
            // Stored cart expired/completed: drop it, start fresh, retry once.
            if (cartIdRef.current === staleCartId) resetShopifyCart();
            await addLines();
            setError(EXPIRED_CART_MESSAGE);
          }
          setIsOpenState(true);
          return true;
        } catch (err) {
          console.error("Failed to add item to cart:", err);
          setError(describeError(err, `Couldn't add ${item.name} to your cart.`));
          setIsOpenState(true);
          return false;
        }
      });
    },
    [useShopify, addItemLocal, runTracked, ensureCart, applyShopifyCart, resetShopifyCart],
  );

  const mutateShopifyLine = useCallback(
    async (
      variantId: string,
      mutate: (cartId: string, lineId: string) => Promise<ShopifyCart>,
      failureMessage: string,
    ) => {
      if (syncPromiseRef.current) {
        await syncPromiseRef.current;
      }
      const cartId = cartIdRef.current;
      const line = itemsRef.current.find((i) => sameVariant(i.variantId, variantId));
      if (!cartId || !line?.lineId) return;

      const seq = ++responseSeqRef.current;
      try {
        applyShopifyCart(await mutate(cartId, line.lineId), seq);
      } catch (err) {
        console.error(failureMessage, err);
        if (err instanceof ShopifyUserError && err.isCartNotFound) {
          if (cartIdRef.current === cartId) resetShopifyCart();
          setError("Your cart expired. Please add your items again.");
        } else {
          setError(describeError(err, failureMessage));
        }
      }
    },
    [applyShopifyCart, resetShopifyCart],
  );

  const removeItem = useCallback(
    async (variantId: string) => {
      setError(null);
      if (!useShopify) {
        setItems((prev) => prev.filter((i) => !sameVariant(i.variantId, variantId)));
        return;
      }
      await runTracked(() =>
        mutateShopifyLine(
          variantId,
          (cartId, lineId) => removeFromCart(cartId, [lineId]),
          "Couldn't remove that item. Please try again.",
        ),
      );
    },
    [useShopify, runTracked, mutateShopifyLine],
  );

  const updateQuantity = useCallback(
    async (variantId: string, quantity: number) => {
      if (quantity <= 0) {
        await removeItem(variantId);
        return;
      }
      setError(null);
      if (!useShopify) {
        const normalized = extractNumericVariantId(variantId);
        setItems((prev) =>
          prev.map((i) =>
            sameVariant(i.variantId, normalized)
              ? { ...i, variantId: normalized, quantity }
              : i,
          ),
        );
        return;
      }
      await runTracked(() =>
        mutateShopifyLine(
          variantId,
          (cartId, lineId) => updateCartLines(cartId, [{ id: lineId, quantity }]),
          "Couldn't update the quantity. Please try again.",
        ),
      );
    },
    [useShopify, removeItem, runTracked, mutateShopifyLine],
  );

  const clearCart = useCallback(() => {
    setError(null);
    // Ignore any responses still in flight for the old cart.
    appliedSeqRef.current = ++responseSeqRef.current;
    itemsRef.current = [];
    setItems([]);
    setShopifySummary(null);
    setSyncFailed(false);
    if (useShopify) {
      // A new Shopify cart will be created on the next add.
      setCartId(null);
    }
    storageRemove("local", CART_STORAGE_KEY);
    storageRemove("session", CART_STORAGE_KEY);
  }, [useShopify, setCartId]);

  const openCart = useCallback(() => {
    setIsOpenState(true);
    // Retry a sync that previously failed due to a network glitch.
    if (useShopify && syncFailed && cartIdRef.current) {
      void runTracked(syncStoredCart);
    }
  }, [useShopify, syncFailed, runTracked, syncStoredCart]);

  const closeCart = useCallback(() => setIsOpenState(false), []);

  const toggleCart = useCallback(() => {
    if (isOpen) {
      closeCart();
    } else {
      openCart();
    }
  }, [isOpen, openCart, closeCart]);

  const setIsOpen = useCallback(
    (open: boolean) => (open ? openCart() : closeCart()),
    [openCart, closeCart],
  );

  const clearError = useCallback(() => setError(null), []);

  const localTotalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const localSubtotal = items.reduce(
    (sum, item) => sum + parsePrice(item.price) * item.quantity,
    0,
  );

  const isSynced = useShopify && shopifySummary !== null && shopifyCartId !== null;
  const totalItems = isSynced ? shopifySummary.totalQuantity : localTotalItems;
  const subtotalAmount = isSynced ? shopifySummary.subtotalAmount : localSubtotal;
  const currencyCode = isSynced ? shopifySummary.currencyCode : "USD";

  const checkoutUrl = useMemo<string | null>(() => {
    if (items.length === 0) return null;
    if (useShopify) {
      return isSynced && !syncFailed ? shopifySummary.checkoutUrl : null;
    }
    return createCheckoutUrl(
      items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
    );
  }, [items, useShopify, isSynced, syncFailed, shopifySummary]);

  const isLoading = pendingCount > 0;
  const isShopifyConnected = isSynced && !syncFailed;

  const value = useMemo<CartContextType>(
    () => ({
      items,
      totalItems,
      isOpen,
      openCart,
      closeCart,
      toggleCart,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      checkoutUrl,
      isLoading,
      isShopifyConnected,
      error,
      clearError,
      subtotalAmount,
      currencyCode,
      itemCount: totalItems,
      setIsOpen,
      isShopifyCart: isShopifyConnected,
    }),
    [
      items,
      totalItems,
      isOpen,
      openCart,
      closeCart,
      toggleCart,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      checkoutUrl,
      isLoading,
      isShopifyConnected,
      error,
      clearError,
      subtotalAmount,
      currencyCode,
      setIsOpen,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
