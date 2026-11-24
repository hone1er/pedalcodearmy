"use client";

import { useEffect, useId, useRef } from "react";
import {
  ShoppingCart,
  X,
  Plus,
  Minus,
  Trash2,
  Loader2,
  Lock,
  AlertTriangle,
} from "lucide-react";
import Image from "next/image";
import { useCart, parsePrice, formatMoney } from "./cart-context";

/** Visual disabled state for aria-disabled controls; hover styles only when idle. */
function busyClass(isBusy: boolean, idleHoverClass: string): string {
  return isBusy ? "cursor-not-allowed opacity-50" : idleHoverClass;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function CartDrawer() {
  const {
    items,
    totalItems,
    isOpen,
    closeCart,
    removeItem,
    updateQuantity,
    clearCart,
    checkoutUrl,
    isLoading,
    isShopifyConnected,
    error,
    clearError,
    subtotalAmount,
    currencyCode,
  } = useCart();

  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // Cart controls stay focusable while an update is in flight (aria-disabled
  // instead of native `disabled`, which would drop keyboard focus to <body>).
  // Ignore activations until the update settles.
  const guardBusy = (action: () => void) => () => {
    if (isLoading) return;
    action();
  };

  // Escape to close, focus trap, body scroll lock, and focus return.
  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCart();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen, closeCart]);

  // Safety net: if the focused control disappears during an update (an item
  // removed, or checkout swapping between link and button), keep keyboard
  // focus inside the drawer instead of losing it to <body>.
  useEffect(() => {
    if (!isOpen) return;
    const active = document.activeElement;
    if (!active || active === document.body) {
      closeButtonRef.current?.focus({ preventScroll: true });
    }
  }, [isOpen, isLoading, items]);

  if (!isOpen) return null;

  const canCheckout = Boolean(checkoutUrl) && !isLoading && items.length > 0;

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={closeCart}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={isLoading}
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l-4 border-black bg-white shadow-[-8px_0px_0px_0px_rgba(0,0,0,1)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b-4 border-black bg-black p-4">
          <div className="flex items-center gap-2">
            <h2 id={titleId} className="text-xl font-black uppercase text-[#FFD700]">
              Your Cart ({totalItems})
            </h2>
            {isShopifyConnected && (
              <span className="rounded-none border border-green-400 bg-green-900 px-2 py-0.5 text-xs font-bold text-green-100">
                Synced
              </span>
            )}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeCart}
            aria-label="Close cart"
            className="p-1 text-white hover:text-[#FFD700] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFD700]"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        {/* Screen-reader status announcements */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {isLoading ? "Updating cart…" : ""}
        </div>

        {/* Error banner */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 border-b-4 border-black bg-red-50 p-3 text-red-900"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
            <p className="flex-1 text-sm font-bold">{error}</p>
            <button
              type="button"
              onClick={clearError}
              aria-label="Dismiss cart message"
              className="rounded-none border-2 border-red-900 p-0.5 hover:bg-red-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="relative flex min-h-0 flex-1 flex-col">
          {/* Loading overlay */}
          {isLoading && (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center bg-white/80"
              aria-hidden="true"
            >
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-black" />
                <span className="font-bold text-gray-700">Updating cart...</span>
              </div>
            </div>
          )}

          {/* Items */}
          <div className="flex-1 overflow-y-auto p-4">
            {items.length === 0 ? (
              <div className="py-12 text-center">
                <ShoppingCart className="mx-auto mb-4 h-16 w-16 text-gray-300" aria-hidden="true" />
                <p className="font-bold text-gray-700">Your cart is empty</p>
                <p className="mt-2 text-sm text-gray-600">
                  Add some moped parts to get started!
                </p>
              </div>
            ) : (
              <ul className="space-y-4">
                {items.map((item) => {
                  const itemTotal = parsePrice(item.price) * item.quantity;
                  return (
                    <li
                      key={item.variantId}
                      className="border-4 border-black bg-amber-50 p-4"
                    >
                      <div className="mb-3 flex items-start gap-3">
                        {item.image && (
                          <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden border-2 border-black bg-white">
                            <Image
                              src={item.image}
                              alt=""
                              fill
                              sizes="64px"
                              className="object-contain"
                            />
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="font-black uppercase text-black">
                            {item.name}
                          </h3>
                          <p className="text-sm font-bold text-gray-700">
                            {item.price} each
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={guardBusy(() => void removeItem(item.variantId))}
                          aria-disabled={isLoading}
                          className={`rounded-none border-2 border-red-700 bg-red-700 p-1 text-white ${busyClass(isLoading, "hover:bg-red-800")}`}
                          aria-label={`Remove ${item.name} from cart`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={guardBusy(
                              () => void updateQuantity(item.variantId, item.quantity - 1),
                            )}
                            aria-disabled={isLoading}
                            className={`rounded-none border-2 border-black bg-black p-2 text-white ${busyClass(isLoading, "hover:bg-gray-800")}`}
                            aria-label={`Decrease quantity of ${item.name}`}
                          >
                            <Minus className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <span
                            className="w-12 border-2 border-black bg-black py-2 text-center font-black text-[#FFD700]"
                            aria-label={`Quantity ${item.quantity}`}
                          >
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={guardBusy(
                              () => void updateQuantity(item.variantId, item.quantity + 1),
                            )}
                            aria-disabled={isLoading}
                            className={`rounded-none border-2 border-black bg-black p-2 text-white ${busyClass(isLoading, "hover:bg-gray-800")}`}
                            aria-label={`Increase quantity of ${item.name}`}
                          >
                            <Plus className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                        <p className="text-lg font-black text-black">
                          {formatMoney(itemTotal, currencyCode)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t-4 border-black bg-white p-4">
            <div className="mb-4 flex items-center justify-between border-b-2 border-dashed border-gray-400 pb-4">
              <span className="text-lg font-black uppercase text-black">
                Subtotal
              </span>
              <span className="text-2xl font-black text-black">
                {formatMoney(subtotalAmount, currencyCode)}
              </span>
            </div>
            {canCheckout && checkoutUrl ? (
              <a
                href={checkoutUrl}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-none border-4 border-black bg-[#FFD700] py-4 font-black uppercase text-black transition-all hover:bg-yellow-400 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              >
                <Lock className="h-4 w-4" aria-hidden="true" />
                Checkout on Shopify
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="mb-3 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-none border-4 border-black bg-gray-200 py-4 font-black uppercase text-gray-700"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    Processing...
                  </>
                ) : (
                  "Checkout unavailable"
                )}
              </button>
            )}
            <button
              type="button"
              onClick={guardBusy(clearCart)}
              aria-disabled={isLoading}
              className={`w-full py-2 text-sm font-bold text-gray-700 underline ${busyClass(isLoading, "hover:text-red-700")}`}
            >
              Clear Cart
            </button>
            {isShopifyConnected && (
              <p className="mt-3 text-center text-xs text-gray-600">
                Your cart is synced with Shopify. Taxes and shipping are
                calculated at checkout.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
