"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Printer,
  BikeIcon as Motorcycle,
  Instagram,
  Package,
} from "lucide-react";
import Link from "next/link";

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

function PlaceholderImage({ label }: { label: string }) {
  return (
    <div className="flex aspect-square w-full items-center justify-center bg-gray-200">
      <div className="text-center text-gray-400">
        <Package className="mx-auto mb-2 h-12 w-12" />
        <p className="text-sm">{label}</p>
      </div>
    </div>
  );
}

const PRINTED_PARTS = [
  {
    name: "Honda Hobbit Fork Spacers",
    material: "PETG-CF",
    description:
      "Increases the rake/trail of the forks, creating a more stable bike. Essential upgrade for anyone pushing their Hobbit harder.",
  },
  {
    name: "Honda Hobbit Chain Tensioner",
    material: "PETG-CF",
    description:
      "Cheap replacement for the original tensioner. Keeps your pedal chain tight and your pedals spinning smooth.",
  },
  {
    name: "Racing Airbox for Mopeds (RAM)",
    material: "PETG-CF",
    description:
      "Tunable airbox designed to maximize your moped's power. Bonus: it makes your moped slightly quieter too.",
  },
];

const MOPEDS_FOR_SALE = [
  {
    name: "Puch Maxi N",
    specs: "White Frame | Kitted | Custom Seat",
    description:
      "Clean white Puch Maxi N with a performance kit installed and a custom seat. Ready to rip or make it your own project. Classic Austrian engineering meets California streets.",
  },
];

export default function Shop() {
  return (
    <div className="container mx-auto px-4 py-12">
      {/* Hero Section */}
      <div className="mb-12 text-center">
        <h1 className="mb-6 text-4xl font-bold text-black md:text-5xl">
          Pedal Code Shop
        </h1>
        <div className="mx-auto max-w-2xl rounded-lg bg-white/80 p-6 shadow-lg">
          <p className="mb-4 text-gray-800">
            We design and print parts specifically for vintage mopeds - fork
            spacers, chain tensioners, airboxes, and more. All printed in-house
            with carbon fiber reinforced PETG for durability.
          </p>
          <p className="mb-4 text-gray-700">
            Got a part that doesn&apos;t exist anymore?{" "}
            <Link
              href="mailto:pedalcodearmy@gmail.com?subject=Custom%203D%20Print%20Request"
              className="font-semibold text-black underline hover:text-gray-600"
            >
              Hit us up for custom requests.
            </Link>
          </p>
          <div className="flex items-center justify-center gap-6 border-t border-gray-200 pt-4">
            <Link
              href="https://instagram.com/pedalcodearmy"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-gray-700 transition-colors hover:text-black"
            >
              <Instagram className="h-5 w-5" />
              <span className="text-sm font-medium">@pedalcodearmy</span>
            </Link>
            <Link
              href="https://tiktok.com/@pedal.code"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-gray-700 transition-colors hover:text-black"
            >
              <TikTokIcon className="h-5 w-5" />
              <span className="text-sm font-medium">@pedal.code</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 3D Printed Parts Section */}
      <section className="mb-16">
        <div className="mb-6 flex items-center justify-center gap-3">
          <Printer className="h-7 w-7 text-black" />
          <h2 className="text-2xl font-bold text-black">3D Printed Parts</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {PRINTED_PARTS.map((part) => (
            <Card
              key={part.name}
              className="overflow-hidden bg-white shadow-lg transition-shadow hover:shadow-xl"
            >
              <PlaceholderImage label="Product Photo" />
              <CardContent className="p-4">
                <h3 className="mb-1 text-lg font-bold text-black">
                  {part.name}
                </h3>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#FFD700]">
                  {part.material}
                </p>
                <p className="mb-4 text-sm text-gray-600">{part.description}</p>
                <div className="border-t border-gray-100 pt-3 text-center text-xs text-gray-400">
                  {/* SHOPIFY BUY BUTTON */}
                  {/* Paste embed code here */}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Mopeds for Sale Section */}
      <section className="mb-16">
        <div className="mb-6 flex items-center justify-center gap-3">
          <Motorcycle className="h-7 w-7 text-black" />
          <h2 className="text-2xl font-bold text-black">Mopeds for Sale</h2>
        </div>

        <div className="mx-auto max-w-lg">
          {MOPEDS_FOR_SALE.map((moped) => (
            <Card
              key={moped.name}
              className="overflow-hidden bg-white shadow-lg transition-shadow hover:shadow-xl"
            >
              <PlaceholderImage label="Moped Photo" />
              <CardContent className="p-4">
                <h3 className="mb-1 text-lg font-bold text-black">
                  {moped.name}
                </h3>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#FFD700]">
                  {moped.specs}
                </p>
                <p className="mb-4 text-sm text-gray-600">
                  {moped.description}
                </p>
                <div className="border-t border-gray-100 pt-3 text-center text-xs text-gray-400">
                  {/* SHOPIFY BUY BUTTON */}
                  {/* Paste embed code here */}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Contact CTA */}
      <section className="text-center">
        <div className="inline-block rounded-lg bg-black px-8 py-6 text-[#FFD700]">
          <h3 className="mb-2 text-xl font-bold">Questions?</h3>
          <p className="text-sm">
            DM us on{" "}
            <Link
              href="https://instagram.com/pedalcodearmy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              Instagram
            </Link>{" "}
            or{" "}
            <Link
              href="mailto:pedalcodearmy@gmail.com"
              className="underline hover:text-white"
            >
              email us
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
