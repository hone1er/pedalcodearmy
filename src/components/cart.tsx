"use client";

import { ShoppingCart, X, Plus, Minus, Trash2, Loader2, ExternalLink } from "lucide-react";
import { useCart } from "./cart-context";
import Image from "next/image";

function parsePrice(price: string): number {
  const match = /\$?([\d.]+)/.exec(price);
  return match?.[1] ? parseFloat(match[1]) : 0;
}

function formatPrice(cents: number): string {
  return `$${cents.toFixed(2)}`;
}

export function CartButton() {
  const { itemCount, setIsOpen, isLoading } = useCart();

  return (
    <button
      onClick={() => setIsOpen(true)}
      className="fixed right-4 top-20 z-40 flex items-center gap-2 rounded-none border-2 border-black bg-[#FFD700] px-4 py-2 font-black uppercase text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-yellow-400 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
    >
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <ShoppingCart className="h-5 w-5" />
      )}
      <span>Cart ({itemCount})</span>
    </button>
  );
}

export function CartDrawer() {
  const {
    items,
    isOpen,
    setIsOpen,
    removeItem,
    updateQuantity,
    clearCart,
    checkoutUrl,
    isLoading,
    isShopifyCart,
  } = useCart();

  if (!isOpen) return null;

  const subtotal = items.reduce((sum, item) => {
    return sum + parsePrice(item.price) * item.quantity;
  }, 0);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l-4 border-black bg-white shadow-[-8px_0px_0px_0px_rgba(0,0,0,1)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b-4 border-black bg-black p-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black uppercase text-[#FFD700]">
              Your Cart ({items.length})
            </h2>
            {isShopifyCart && (
              <span className="rounded-none border border-green-500 bg-green-500/20 px-2 py-0.5 text-xs font-bold text-green-400">
                Synced
              </span>
            )}
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-white hover:text-[#FFD700]"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-[#FFD700]" />
              <span className="font-bold text-gray-600">Updating cart...</span>
            </div>
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="py-12 text-center">
              <ShoppingCart className="mx-auto mb-4 h-16 w-16 text-gray-300" />
              <p className="font-bold text-gray-500">Your cart is empty</p>
              <p className="mt-2 text-sm text-gray-400">
                Add some moped parts to get started!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => {
                const itemTotal = parsePrice(item.price) * item.quantity;
                return (
                  <div
                    key={item.variantId}
                    className="border-4 border-black bg-amber-50 p-4"
                  >
                    <div className="mb-3 flex items-start gap-3">
                      {item.image && (
                        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden border-2 border-black bg-white">
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            className="object-contain"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="font-black uppercase text-black">
                          {item.name}
                        </h3>
                        <p className="text-sm font-bold text-gray-600">
                          {item.price} each
                        </p>
                      </div>
                      <button
                        onClick={() => void removeItem(item.variantId)}
                        disabled={isLoading}
                        className="rounded-none border-2 border-red-500 bg-red-500 p-1 text-white hover:bg-red-600 disabled:opacity-50"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            void updateQuantity(item.variantId, item.quantity - 1)
                          }
                          disabled={isLoading}
                          className="rounded-none border-2 border-black bg-black p-2 text-white hover:bg-gray-800 disabled:opacity-50"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-12 border-2 border-black bg-black py-2 text-center font-black text-[#FFD700]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            void updateQuantity(item.variantId, item.quantity + 1)
                          }
                          disabled={isLoading}
                          className="rounded-none border-2 border-black bg-black p-2 text-white hover:bg-gray-800 disabled:opacity-50"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-black">
                          {formatPrice(itemTotal)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t-4 border-black bg-white p-4">
            <div className="mb-4 flex items-center justify-between border-b-2 border-dashed border-gray-400 pb-4">
              <span className="text-lg font-black uppercase text-black">
                Subtotal
              </span>
              <span className="text-2xl font-black text-black">
                {formatPrice(subtotal)}
              </span>
            </div>
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`mb-3 flex w-full items-center justify-center gap-2 rounded-none border-4 border-black bg-[#FFD700] py-4 font-black uppercase text-black transition-all hover:bg-yellow-400 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${
                isLoading || checkoutUrl === "#"
                  ? "pointer-events-none opacity-50"
                  : ""
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Checkout on Shopify
                  <ExternalLink className="h-4 w-4" />
                </>
              )}
            </a>
            <button
              onClick={() => clearCart()}
              disabled={isLoading}
              className="w-full py-2 text-sm font-bold text-gray-500 underline hover:text-red-500 disabled:opacity-50"
            >
              Clear Cart
            </button>
            {isShopifyCart && (
              <p className="mt-3 text-center text-xs text-gray-400">
                Your cart is synced with Shopify and will persist across
                sessions.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
