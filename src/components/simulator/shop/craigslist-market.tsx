"use client";

import {
  CheckCircle2,
  Lock,
  MapPin,
  Tag,
  Wrench,
} from "lucide-react";
import type { SimBikeMake } from "@/lib/simulator/contract";
import { CRAIGSLIST_LISTINGS } from "@/lib/simulator/economy/catalog";
import { useSimStore } from "@/lib/simulator/store/sim-store";

const MAKE_LABELS: Record<SimBikeMake, string> = {
  "puch-maxi": "PUCH MAXI",
  "honda-hobbit": "HONDA HOBBIT",
  "derbi-variant": "DERBI VARIANT",
  "tomos-a35": "TOMOS A35",
};

const BAY_NEIGHBORHOODS = [
  "oakland / temescal",
  "berkeley / ashby",
  "alameda / west end",
  "emeryville / san pablo",
  "san leandro / east 14th",
];

export function CraigslistMarket() {
  const { save, buyCraigslistBike, selectBike, setPhase } = useSimStore();

  return (
    <div className="space-y-6">
      {/* Gritty Bay Area Craigslist Masthead */}
      <div className="border-4 border-[#FFD700] bg-zinc-950 p-5 shadow-[6px_6px_0px_0px_#FFD700]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-zinc-800 pb-3">
          <p className="font-mono text-xs font-bold text-purple-300">
            sfbay.craigslist.org &gt; east bay &gt; motorcycles/scooters &gt; by
            owner
          </p>
          <span className="border-2 border-amber-400 bg-amber-950 px-2.5 py-0.5 font-mono text-[11px] font-black uppercase text-amber-200">
            CASH ONLY &bull; NO LOWBALLERS
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2
              className="text-4xl tracking-wider text-[#FFD700] sm:text-5xl"
              style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
            >
              EAST BAY CRAIGSLIST FINDS
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-zinc-300">
              PUCH / HOBBIT / DERBI / TOMOS &mdash; &ldquo;Ran when parked,
              probably just needs a carb clean. I know what I have.&rdquo; Every
              find brings its own quirks to diagnose back in your garage.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setPhase("GARAGE")}
            className="inline-flex items-center gap-2 border-2 border-zinc-500 bg-black px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-colors hover:border-[#FFD700] hover:text-[#FFD700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
          >
            <Wrench className="h-4 w-4" aria-hidden="true" />
            Back to Garage
          </button>
        </div>
      </div>

      {/* Listings Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {CRAIGSLIST_LISTINGS.map((listing, idx) => {
          const ownedBike = save.bikes.find(
            (b) =>
              b.id === listing.id ||
              b.id === `bike-${listing.id}` ||
              (b.make === listing.make &&
                b.colorHex.toLowerCase() === listing.colorHex.toLowerCase()),
          );
          const repLocked = save.rep < listing.repRequired;
          const canAfford = save.cash >= listing.price;
          const location =
            BAY_NEIGHBORHOODS[idx % BAY_NEIGHBORHOODS.length] ?? "east bay";

          return (
            <article
              key={listing.id}
              className={`flex flex-col justify-between border-4 bg-zinc-950 p-5 ${
                ownedBike
                  ? "border-emerald-500/80"
                  : "border-zinc-700 shadow-[5px_5px_0px_0px_#27272A] hover:border-[#FFD700]"
              }`}
            >
              <div>
                {/* Classic Craigslist meta row */}
                <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-zinc-400">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-[#FFD700]" aria-hidden="true" />
                    ({location})
                  </span>
                  <span className="border border-zinc-700 bg-black px-2 py-0.5 font-sans text-[10px] font-black uppercase text-zinc-200">
                    {MAKE_LABELS[listing.make]}
                  </span>
                </div>

                {/* Title + Price + Paint Swatch */}
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      aria-hidden="true"
                      className="mt-1 flex h-10 w-10 shrink-0 flex-col overflow-hidden border-2 border-white shadow-[2px_2px_0px_0px_#000]"
                    >
                      <span
                        className="h-2/3 w-full"
                        style={{ backgroundColor: listing.colorHex }}
                      />
                      <span
                        className="h-1/3 w-full"
                        style={{ backgroundColor: listing.accentHex }}
                      />
                    </div>
                    <div>
                      <h3 className="text-lg font-black leading-snug text-white">
                        {listing.title}
                      </h3>
                      <p className="mt-0.5 font-mono text-[11px] text-zinc-400">
                        condition: &ldquo;ran when parked&rdquo; &bull; title:
                        bill of sale
                      </p>
                    </div>
                  </div>

                  <span
                    className="shrink-0 border-2 border-[#FFD700] bg-black px-2.5 py-1 text-xl font-bold text-[#FFD700] tabular-nums"
                    style={{
                      fontFamily: "var(--font-orbitron), Orbitron, monospace",
                    }}
                  >
                    ${listing.price}
                  </span>
                </div>

                {/* Seller Blurb */}
                <blockquote className="mt-4 border-l-4 border-[#FFD700] bg-black p-3.5 font-mono text-xs leading-relaxed text-zinc-200">
                  &ldquo;{listing.sellerBlurb}&rdquo;
                </blockquote>

                {/* Honest Mystery Disclaimer (never spoils starterFaults!) */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
                  <span className="inline-flex items-center gap-1.5 font-bold uppercase text-amber-300">
                    <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                    Bring tools &amp; a pickup
                  </span>
                  {listing.repRequired > 0 && (
                    <span
                      className={
                        repLocked
                          ? "font-black uppercase text-red-400"
                          : "font-bold uppercase text-zinc-400"
                      }
                    >
                      Rep Gate: {listing.repRequired}+
                    </span>
                  )}
                </div>
              </div>

              {/* Action CTA */}
              <div className="mt-5 border-t-2 border-zinc-800 pt-4">
                {ownedBike ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      In Your Garage
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        selectBike(ownedBike.id);
                        setPhase("GARAGE");
                      }}
                      className="border-2 border-emerald-400 bg-emerald-950/60 px-4 py-2 text-xs font-black uppercase text-emerald-200 transition-colors hover:bg-emerald-400 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      Wrench on Bike &rarr;
                    </button>
                  </div>
                ) : repLocked ? (
                  <div className="flex items-center justify-center gap-2 border-2 border-zinc-700 bg-zinc-900 py-2.5 text-xs font-black uppercase text-zinc-400">
                    <Lock className="h-4 w-4" aria-hidden="true" />
                    Seller Only Sells to Riders with {listing.repRequired}+ Rep
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => buyCraigslistBike(listing.id)}
                    className="w-full border-4 border-[#FFD700] bg-[#FFD700] py-2.5 text-xl tracking-wider text-black shadow-[4px_4px_0px_0px_#FFF] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-yellow-300 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-500 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
                    style={{
                      fontFamily: "var(--font-bangers), Bangers, cursive",
                    }}
                  >
                    {canAfford
                      ? `MEET SELLER & BUY ($${listing.price})`
                      : `NEED $${listing.price - save.cash} MORE CASH`}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
