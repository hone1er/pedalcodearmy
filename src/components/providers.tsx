"use client";

import type { ReactNode } from "react";
import { CartProvider } from "@/components/cart-context";
import { CookieConsent } from "@/components/cookie-consent";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      {children}
      <CookieConsent />
    </CartProvider>
  );
}
