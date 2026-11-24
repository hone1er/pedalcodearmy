"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, ShoppingCart, X } from "lucide-react";
import { useCart } from "@/components/cart-context";

const NAV_LINKS = [
  { href: "/stable", label: "The Stable" },
  { href: "/build-calculator", label: "Build Calc" },
  { href: "/troubleshooter", label: "Troubleshooter" },
  { href: "/shop", label: "Shop" },
  { href: "/members", label: "The Dudes" },
  { href: "/game", label: "City Runner" },
] as const;

type CartHookCompat = {
  totalItems?: number;
  itemCount?: number;
  openCart?: () => void;
  setIsOpen?: (open: boolean) => void;
};

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const cart = useCart() as CartHookCompat;
  const totalItems = cart.totalItems ?? cart.itemCount ?? 0;
  const handleOpenCart = () => {
    if (typeof cart.openCart === "function") {
      cart.openCart();
    } else {
      cart.setIsOpen?.(true);
    }
  };

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  const isActiveRoute = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:border-4 focus:border-black focus:bg-[#FFD700] focus:px-4 focus:py-2 focus:font-black focus:uppercase focus:text-black focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b-4 border-[#FFD700] bg-black text-[#FFD700]">
        <div className="container mx-auto flex items-center justify-between gap-2 px-4 py-3">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
          >
            <Image
              src="/images/pedalcode.jpeg"
              alt="Pedal Code Army logo"
              width={36}
              height={36}
              className="h-8 w-8 shrink-0 rounded-full border-2 border-[#FFD700] object-cover sm:h-9 sm:w-9"
            />
            <span className="truncate text-lg font-black uppercase tracking-tight sm:text-2xl">
              Pedal Code Army
            </span>
          </Link>

          <nav aria-label="Primary navigation" className="hidden xl:block">
            <ul className="flex items-center gap-1">
              {NAV_LINKS.map((link) => {
                const active = isActiveRoute(link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={`inline-block whitespace-nowrap border-2 px-3 py-1.5 text-sm font-black uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                        active
                          ? "border-[#FFD700] bg-[#FFD700] text-black"
                          : "border-transparent text-[#FFD700] hover:border-[#FFD700] hover:bg-[#FFD700]/15"
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleOpenCart}
              aria-label={`Open shopping cart${totalItems > 0 ? ` (${totalItems} items)` : ""}`}
              className="group flex items-center gap-2 border-2 border-[#FFD700] bg-black px-2.5 py-1.5 text-sm font-black uppercase text-[#FFD700] transition-colors hover:bg-[#FFD700] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] sm:px-3"
            >
              <ShoppingCart className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Cart</span>
              <span className="inline-flex min-w-[1.25rem] items-center justify-center bg-[#FFD700] px-1.5 py-0.5 text-xs font-black text-black transition-colors group-hover:bg-black group-hover:text-[#FFD700]">
                {totalItems}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-menu"
              aria-label={
                mobileMenuOpen
                  ? "Close navigation menu"
                  : "Open navigation menu"
              }
              className="flex items-center justify-center border-2 border-[#FFD700] bg-black p-1.5 text-[#FFD700] transition-colors hover:bg-[#FFD700] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] xl:hidden"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav
            id="mobile-nav-menu"
            aria-label="Mobile navigation"
            className="border-t-2 border-[#FFD700]/40 bg-black px-4 pb-4 pt-3 xl:hidden"
          >
            <ul className="grid gap-2 sm:grid-cols-2">
              {NAV_LINKS.map((link) => {
                const active = isActiveRoute(link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`block border-2 px-3 py-2.5 text-sm font-black uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                        active
                          ? "border-[#FFD700] bg-[#FFD700] text-black"
                          : "border-[#FFD700]/40 bg-black text-[#FFD700] hover:border-[#FFD700] hover:bg-[#FFD700]/15"
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </header>
    </>
  );
}
