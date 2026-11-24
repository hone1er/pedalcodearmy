"use client";

import { useState, useEffect } from "react";
import { X, Cookie } from "lucide-react";
import Link from "next/link";

const COOKIE_CONSENT_KEY = "pca-cookie-consent";

function persistConsent(value: "accepted" | "declined") {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, value);
  } catch {
    // Ignore storage errors (private mode / restricted storage)
  }

  const secureFlag =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${COOKIE_CONSENT_KEY}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax${secureFlag}`;

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("pca-cookie-consent-changed"));
  }
}

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    let consent: string | null = null;
    try {
      consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    } catch {
      consent = null;
    }

    if (!consent) {
      const timer = setTimeout(() => setShowBanner(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    persistConsent("accepted");
    setShowBanner(false);
  };

  const handleDecline = () => {
    persistConsent("declined");
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie notice"
      className="fixed bottom-0 left-0 right-0 z-40 p-4"
    >
      <div className="mx-auto max-w-4xl rounded-none border-4 border-black bg-white text-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-start gap-4 p-4 md:p-6">
          <div className="hidden flex-shrink-0 border-2 border-black bg-[#FFD700] p-2 md:block">
            <Cookie className="h-6 w-6 text-black" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h3 className="mb-2 font-black uppercase tracking-tight text-black">
              Cookie Notice
            </h3>
            <p className="mb-4 text-sm text-gray-800">
              We use cookies to remember your shopping cart and improve your
              experience. We don&apos;t sell your data or use tracking cookies
              for advertising. By clicking &quot;Accept&quot;, you consent to
              our use of cookies.{" "}
              <Link
                href="/privacy"
                className="px-1 font-black text-black underline decoration-2 hover:bg-[#FFD700]"
              >
                Learn more
              </Link>
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleAccept}
                className="rounded-none border-2 border-black bg-[#FFD700] px-6 py-2 font-bold uppercase text-black transition-all hover:bg-yellow-400 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={handleDecline}
                className="rounded-none border-2 border-black bg-white px-6 py-2 font-bold uppercase text-black transition-all hover:bg-gray-100"
              >
                Decline
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDecline}
            className="flex-shrink-0 border-2 border-transparent p-1 text-gray-600 hover:border-black hover:text-black"
            aria-label="Close cookie notice"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Utility function to check if cookies are consented
export function hasCookieConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(COOKIE_CONSENT_KEY) === "accepted";
  } catch {
    return false;
  }
}
