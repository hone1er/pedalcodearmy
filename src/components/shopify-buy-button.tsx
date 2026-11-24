"use client";

import { ShoppingCart, Check } from "lucide-react";
import { useState } from "react";
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
  const [justAdded, setJustAdded] = useState(false);
  const { addItem } = useCart();
  const resolvedVariantId = variantId ?? getShopifyVariantId(productId);

  if (!resolvedVariantId) {
    return (
      <button
        type="button"
        disabled
        className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-none border-2 border-black bg-gray-300 py-3 text-sm font-black uppercase text-gray-600"
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
        className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-none border-2 border-black bg-gray-300 py-3 text-sm font-black uppercase text-gray-600"
      >
        Sold Out
      </button>
    );
  }

  const handleAddToCart = () => {
    void addItem({
      variantId: resolvedVariantId,
      productId,
      name: productName,
      price,
      image,
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleAddToCart}
      disabled={justAdded}
      className={`flex w-full items-center justify-center gap-2 rounded-none border-2 border-black py-3 text-sm font-black uppercase transition-all ${
        justAdded
          ? "bg-green-500 text-white"
          : "bg-[#FFD700] text-black hover:bg-yellow-400 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
      }`}
    >
      {justAdded ? (
        <>
          <Check className="h-4 w-4" />
          Added!
        </>
      ) : (
        <>
          <ShoppingCart className="h-4 w-4" />
          Add to Cart
        </>
      )}
    </button>
  );
}
