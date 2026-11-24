"use client";

import { ShoppingCart, Check, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getShopifyVariantId } from "@/lib/shopify";
import { useCart } from "./cart-context";

interface ShopifyBuyButtonProps {
  productId: string;
  productName: string;
  price: string;
  image?: string;
  variantId?: string;
  availableForSale?: boolean;
}

export function ShopifyBuyButton({
  productId,
  productName,
  price,
  image,
  variantId,
  availableForSale,
}: ShopifyBuyButtonProps) {
  const [status, setStatus] = useState<"idle" | "adding" | "added">("idle");
  const { addItem, isLoading } = useCart();
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const resolvedVariantId = variantId ?? getShopifyVariantId(productId);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  if (!resolvedVariantId) {
    return (
      <button
        type="button"
        disabled
        className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-none border-2 border-black bg-gray-300 py-3 text-sm font-black uppercase text-gray-800"
      >
        Coming Soon
      </button>
    );
  }

  if (availableForSale === false) {
    return (
      <button
        type="button"
        disabled
        className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-none border-2 border-black bg-gray-300 py-3 text-sm font-black uppercase text-gray-800"
      >
        Sold Out
      </button>
    );
  }

  const handleAddToCart = async () => {
    if (status !== "idle" || isLoading) return;
    setStatus("adding");
    const added = await addItem({
      variantId: resolvedVariantId,
      productId,
      name: productName,
      price,
      image,
    });
    if (!isMountedRef.current) return;
    if (!added) {
      // The cart drawer surfaces the error message.
      setStatus("idle");
      return;
    }
    setStatus("added");
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) setStatus("idle");
    }, 1500);
  };

  const isBusy = status === "adding" || (isLoading && status === "idle");

  return (
    <button
      type="button"
      onClick={() => void handleAddToCart()}
      disabled={status !== "idle" || isLoading}
      aria-live="polite"
      className={`flex w-full items-center justify-center gap-2 rounded-none border-2 border-black py-3 text-sm font-black uppercase transition-all disabled:cursor-not-allowed ${
        status === "added"
          ? "bg-green-700 text-white"
          : "bg-[#FFD700] text-black hover:bg-yellow-400 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:opacity-70 disabled:hover:shadow-none"
      }`}
    >
      {status === "added" ? (
        <>
          <Check className="h-4 w-4" aria-hidden="true" />
          Added!
        </>
      ) : isBusy ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {status === "adding" ? "Adding..." : "Add to Cart"}
        </>
      ) : (
        <>
          <ShoppingCart className="h-4 w-4" aria-hidden="true" />
          Add to Cart
        </>
      )}
    </button>
  );
}
