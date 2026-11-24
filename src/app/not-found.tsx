import { type Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "This road doesn't go anywhere. Head back to Pedal Code Army.",
  robots: { index: false, follow: true },
};

const PRIMARY_LINK =
  "border-4 border-black bg-black px-6 py-3 text-center font-black uppercase text-[#FFD700] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-black";
const SECONDARY_LINK =
  "border-4 border-black bg-white px-6 py-3 text-center font-black uppercase text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-0.5 hover:bg-[#FFF6BF] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-black";

export default function NotFound() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-[70vh] items-center justify-center bg-[#FFD700] px-4 py-16 focus:outline-none"
    >
      <div className="w-full max-w-2xl border-4 border-black bg-white shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
        <div className="border-b-4 border-black bg-black px-6 py-4">
          <p className="text-sm font-black uppercase tracking-widest text-[#FFD700]">
            Error 404 · Dead end
          </p>
        </div>
        <div className="p-6 text-black md:p-10">
          <p
            aria-hidden="true"
            className="text-7xl font-black leading-none tracking-tighter md:text-9xl"
          >
            404
          </p>
          <h1 className="mt-4 text-3xl font-black uppercase leading-tight md:text-4xl">
            You took a wrong turn
          </h1>
          <p className="mt-3 text-lg text-gray-800">
            This page ran out of gas, fell off the back of the truck, or never existed. Pick a
            route below and get back on the road.
          </p>

          <nav aria-label="Recovery links" className="mt-8 grid gap-4 sm:grid-cols-2">
            <Link href="/" className={PRIMARY_LINK}>
              Go Home
            </Link>
            <Link href="/shop" className={SECONDARY_LINK}>
              Shop Parts
            </Link>
            <Link href="/stable" className={SECONDARY_LINK}>
              The Stable
            </Link>
            <Link href="/game" className={SECONDARY_LINK}>
              Play City Runner
            </Link>
          </nav>
        </div>
      </div>
    </main>
  );
}
