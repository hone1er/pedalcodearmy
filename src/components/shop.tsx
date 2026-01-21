"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Printer, BikeIcon as Motorcycle } from "lucide-react";

export default function Shop() {
  return (
    <div className="container mx-auto px-4 py-12">
      {/* Hero Section */}
      <div className="mb-16 text-center">
        <h1 className="mb-4 text-4xl font-bold text-black md:text-5xl">
          Pedal Code Army Shop
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-gray-800">
          3D printed moped parts and mopeds for sale. Support the gang and keep
          those two-strokes running!
        </p>
      </div>

      {/* 3D Printed Parts Section */}
      <section className="mb-16">
        <div className="mb-8 flex items-center justify-center gap-3">
          <Printer className="h-8 w-8 text-black" />
          <h2 className="text-3xl font-bold text-black">3D Printed Parts</h2>
        </div>
        <p className="mb-8 text-center text-gray-700">
          Custom designed and printed parts to keep your moped running strong.
        </p>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Shopify Buy Button Placeholder 1 */}
          <Card className="bg-white shadow-xl">
            <CardContent className="flex min-h-[300px] flex-col items-center justify-center p-6">
              <div className="mb-4 text-center text-gray-500">
                {/* SHOPIFY BUY BUTTON EMBED #1 */}
                {/* Paste your Shopify Buy Button embed code here */}
                <p className="text-sm">Shopify Product Embed</p>
                <p className="text-xs text-gray-400">Coming Soon</p>
              </div>
            </CardContent>
          </Card>

          {/* Shopify Buy Button Placeholder 2 */}
          <Card className="bg-white shadow-xl">
            <CardContent className="flex min-h-[300px] flex-col items-center justify-center p-6">
              <div className="mb-4 text-center text-gray-500">
                {/* SHOPIFY BUY BUTTON EMBED #2 */}
                {/* Paste your Shopify Buy Button embed code here */}
                <p className="text-sm">Shopify Product Embed</p>
                <p className="text-xs text-gray-400">Coming Soon</p>
              </div>
            </CardContent>
          </Card>

          {/* Shopify Buy Button Placeholder 3 */}
          <Card className="bg-white shadow-xl">
            <CardContent className="flex min-h-[300px] flex-col items-center justify-center p-6">
              <div className="mb-4 text-center text-gray-500">
                {/* SHOPIFY BUY BUTTON EMBED #3 */}
                {/* Paste your Shopify Buy Button embed code here */}
                <p className="text-sm">Shopify Product Embed</p>
                <p className="text-xs text-gray-400">Coming Soon</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Mopeds for Sale Section */}
      <section>
        <div className="mb-8 flex items-center justify-center gap-3">
          <Motorcycle className="h-8 w-8 text-black" />
          <h2 className="text-3xl font-bold text-black">Mopeds for Sale</h2>
        </div>
        <p className="mb-8 text-center text-gray-700">
          Looking for your first moped or adding to the collection? Check out
          what we&apos;ve got available.
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Shopify Buy Button Placeholder - Moped 1 */}
          <Card className="bg-white shadow-xl">
            <CardContent className="flex min-h-[400px] flex-col items-center justify-center p-6">
              <div className="mb-4 text-center text-gray-500">
                {/* SHOPIFY BUY BUTTON EMBED - MOPED #1 */}
                {/* Paste your Shopify Buy Button embed code here */}
                <p className="text-sm">Shopify Product Embed</p>
                <p className="text-xs text-gray-400">Coming Soon</p>
              </div>
            </CardContent>
          </Card>

          {/* Shopify Buy Button Placeholder - Moped 2 */}
          <Card className="bg-white shadow-xl">
            <CardContent className="flex min-h-[400px] flex-col items-center justify-center p-6">
              <div className="mb-4 text-center text-gray-500">
                {/* SHOPIFY BUY BUTTON EMBED - MOPED #2 */}
                {/* Paste your Shopify Buy Button embed code here */}
                <p className="text-sm">Shopify Product Embed</p>
                <p className="text-xs text-gray-400">Coming Soon</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Contact Section */}
      <section className="mt-16 text-center">
        <Card className="bg-black text-[#FFD700]">
          <CardContent className="p-8">
            <h3 className="mb-4 text-2xl font-bold">Got Questions?</h3>
            <p className="mb-2">
              Hit us up on Instagram if you have questions about parts or
              mopeds.
            </p>
            <p className="text-sm text-gray-400">
              Custom 3D print requests? We might be able to help with that too.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
