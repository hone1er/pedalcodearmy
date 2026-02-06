"use client";

import { useState, useEffect } from "react";
import { X, Cookie } from "lucide-react";
import Link from "next/link";

const COOKIE_CONSENT_KEY = "pca-cookie-consent";

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if user has already consented
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Small delay to prevent flash on page load
      const timer = setTimeout(() => setShowBanner(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    document.cookie = `${COOKIE_CONSENT_KEY}=accepted; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    setShowBanner(false);
  };

  const handleDecline = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "declined");
    document.cookie = `${COOKIE_CONSENT_KEY}=declined; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <div className="mx-auto max-w-4xl rounded-none border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-start gap-4 p-4 md:p-6">
          <Cookie className="hidden h-8 w-8 flex-shrink-0 text-[#FFD700] md:block" />
          <div className="flex-1">
            <h3 className="mb-2 font-black uppercase tracking-tight">
              Cookie Notice
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              We use cookies to remember your shopping cart and improve your
              experience. We don&apos;t sell your data or use tracking cookies
              for advertising. By clicking &quot;Accept&quot;, you consent to our use of
              cookies.{" "}
              <Link
                href="/privacy"
                className="font-bold text-[#FFD700] underline hover:text-yellow-600"
              >
                Learn more
              </Link>
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleAccept}
                className="rounded-none border-2 border-black bg-[#FFD700] px-6 py-2 font-bold uppercase text-black transition-all hover:bg-yellow-400 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                Accept
              </button>
              <button
                onClick={handleDecline}
                className="rounded-none border-2 border-black bg-white px-6 py-2 font-bold uppercase text-black transition-all hover:bg-gray-100"
              >
                Decline
              </button>
            </div>
          </div>
          <button
            onClick={handleDecline}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Utility function to check if cookies are consented
export function hasCookieConsent(): boolean {
  if (typeof window === "undefined") return false;
  const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
  return consent === "accepted";
}
