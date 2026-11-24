"use client";

import Link from "next/link";
import { useEffect } from "react";

const PRIMARY_BUTTON =
  "border-4 border-black bg-black px-6 py-3 text-center font-black uppercase text-[#FFD700] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-black";
const SECONDARY_LINK =
  "border-4 border-black bg-white px-6 py-3 text-center font-black uppercase text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-0.5 hover:bg-[#FFF6BF] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-black";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-[70vh] items-center justify-center bg-[#FFD700] px-4 py-16 focus:outline-none"
    >
      <div
        role="alert"
        className="w-full max-w-2xl border-4 border-black bg-white shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]"
      >
        <div className="border-b-4 border-black bg-black px-6 py-4">
          <p className="text-sm font-black uppercase tracking-widest text-[#FFD700]">
            Engine trouble
          </p>
        </div>
        <div className="p-6 text-black md:p-10">
          <h1 className="text-3xl font-black uppercase leading-tight md:text-4xl">
            Something seized up
          </h1>
          <p className="mt-3 text-lg text-gray-800">
            We hit an unexpected problem loading this page. Give it another kick — if it keeps
            stalling, head somewhere else and try again in a bit.
          </p>
          {error.digest ? (
            <p className="mt-4 inline-block border-2 border-black bg-[#FFF6BF] px-2 py-1 font-mono text-xs">
              Reference: {error.digest}
            </p>
          ) : null}

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <button type="button" onClick={() => reset()} className={PRIMARY_BUTTON}>
              Try Again
            </button>
            <Link href="/" className={SECONDARY_LINK}>
              Go Home
            </Link>
            <Link href="/shop" className={SECONDARY_LINK}>
              Shop Parts
            </Link>
            <Link href="/stable" className={SECONDARY_LINK}>
              The Stable
            </Link>
            <Link href="/game" className={`${SECONDARY_LINK} sm:col-span-2`}>
              Play City Runner
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
