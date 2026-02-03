"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Printer,
  BikeIcon as Motorcycle,
  Instagram,
  Package,
  Bell,
  Star,
  Check,
} from "lucide-react";
import { ShopifyBuyButton } from "@/components/shopify-buy-button";
import { CartProvider } from "@/components/cart-context";
import { CartButton, CartDrawer } from "@/components/cart";
import Link from "next/link";
import Image from "next/image";

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
    <div className="relative flex aspect-square w-full items-center justify-center bg-gradient-to-br from-amber-100 to-orange-100">
      <div className="absolute inset-0 opacity-10">
        <div
          className="h-full w-full"
          style={{
            backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 10px,
            rgba(0,0,0,0.1) 10px,
            rgba(0,0,0,0.1) 20px
          )`,
          }}
        />
      </div>
      <div className="text-center text-orange-400">
        <Package className="mx-auto mb-2 h-12 w-12" />
        <p className="text-sm font-bold">{label}</p>
      </div>
    </div>
  );
}

function RetroStripe() {
  return (
    <div className="my-8 flex items-center justify-center gap-1">
      <div className="h-2 w-16 bg-orange-500" />
      <div className="h-2 w-8 bg-black" />
      <div className="h-2 w-16 bg-[#FFD700]" />
      <div className="h-2 w-8 bg-black" />
      <div className="h-2 w-16 bg-orange-500" />
    </div>
  );
}

function MopedBrandBadge({
  brand,
  country,
  colors,
}: {
  brand: string;
  country: string;
  colors: string;
}) {
  return (
    <div
      className={`flex flex-col items-center rounded-none border-2 border-black p-3 ${colors}`}
    >
      <span className="text-xs font-bold uppercase tracking-wider opacity-70">
        {country}
      </span>
      <span className="text-lg font-black uppercase tracking-tight">
        {brand}
      </span>
    </div>
  );
}

function MopedHeritage() {
  return (
    <div className="mb-8 rounded-none border-4 border-black bg-gradient-to-r from-amber-50 via-white to-amber-50 p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
      <div className="mb-4 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
          We Specialize In
        </p>
        <h3 className="text-xl font-black uppercase tracking-tight text-black">
          The Classics
        </h3>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <MopedBrandBadge
          brand="Honda Hobbit"
          country="Japan"
          colors="bg-gradient-to-b from-red-500 to-red-600 text-white"
        />
        <MopedBrandBadge
          brand="Derbi Variant"
          country="Spain"
          colors="bg-gradient-to-b from-gray-800 to-black text-red-500"
        />
        <MopedBrandBadge
          brand="Piaggio Ciao"
          country="Italy"
          colors="bg-gradient-to-b from-green-600 to-green-700 text-white"
        />
      </div>
      <p className="mt-4 text-center text-xs text-gray-600">
        Plus Puch, Tomos, Garelli, and whatever else you&apos;re wrenching on
      </p>
    </div>
  );
}

function RetroBadge({
  children,
  color = "orange",
}: {
  children: React.ReactNode;
  color?: "orange" | "gold" | "black";
}) {
  const colors = {
    orange: "bg-orange-500 text-white border-orange-700",
    gold: "bg-[#FFD700] text-black border-yellow-600",
    black: "bg-black text-[#FFD700] border-gray-700",
  };
  return (
    <span
      className={`inline-block rotate-[-3deg] rounded border-2 border-b-4 px-2 py-0.5 text-xs font-black uppercase tracking-wider ${colors[color]}`}
    >
      {children}
    </span>
  );
}

function WaitlistButton({ productName, productPrice }: { productName: string; productPrice: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: productName,
          customerName: name,
          customerEmail: email,
          quantity: 1,
          estimatedPrice: productPrice,
          isCustom: false,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to join waitlist");
      }

      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Reset form after closing
    setTimeout(() => {
      setEmail("");
      setName("");
      setIsSuccess(false);
      setError("");
    }, 300);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-none border-2 border-black bg-black py-3 text-sm font-black uppercase text-[#FFD700] transition-all hover:bg-gray-900 hover:shadow-[4px_4px_0px_0px_rgba(255,165,0,1)]"
      >
        <Bell className="h-4 w-4" />
        Get Notified
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-none border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase text-black">
              Join the Waitlist
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Get notified when <span className="font-bold text-black">{productName}</span> is available.
            </DialogDescription>
          </DialogHeader>

          {isSuccess ? (
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="mb-2 text-lg font-black uppercase text-black">You&apos;re on the list!</h3>
              <p className="text-sm text-gray-600">We&apos;ll email you when it&apos;s ready.</p>
              <Button
                onClick={handleClose}
                className="mt-4 rounded-none border-2 border-black bg-black text-[#FFD700] hover:bg-gray-900"
              >
                Close
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-black">Name</label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Your name"
                  className="rounded-none border-2 border-black"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-black">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="rounded-none border-2 border-black"
                />
              </div>

              {error && (
                <p className="text-sm font-bold text-red-600">{error}</p>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-none border-2 border-black bg-[#FFD700] py-3 font-black uppercase text-black hover:bg-yellow-400 disabled:opacity-50"
              >
                {isSubmitting ? "Joining..." : "Join Waitlist"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

const PRINTED_PARTS = [
  {
    id: "side-covers",
    name: "Puch Magnum Side Covers",
    description:
      "3D printed side covers - plain or with your own custom embossed text. Preview your design before ordering.",
    price: "$50-$60",
    priceLabel: "per side",
    image: "/images/products/SideCoverRight.png",
    includes: [
      "3D printed Puch Magnum side cover",
      "Plain: $50 | Custom text: $60  per side",
      "Durable PETG material",
    ],
    availability: "Coming Soon",
    customizable: true,
  },
  {
    id: "fork-spacers",
    name: "Honda Hobbit Fork Spacers",
    description:
      "Increases the rake/trail of the forks, creating a more stable bike. Essential upgrade for anyone pushing their Hobbit harder.",
    price: "$25",
    image: "/images/products/forkSpacers.JPG",
    includes: [
      "2x 3D printed fork spacers",
      "2x M10x1.25x60mm bolts",
      "2x Concave spring washers",
    ],
    availability: "In Stock",
    shopifyEnabled: true,
  },
  {
    id: "chain-tensioner",
    name: "Honda Hobbit Chain Tensioner",
    description:
      "Cheap replacement for the original tensioner. Keeps your pedal chain tight and your pedals spinning smooth.",
    price: "$20",
    image: "/images/products/chainTensioner.JPG",
    includes: [
      "3D printed chain tensioner parts",
      "1x M5x22mm bolt",
      "1x M5x25mm bolt",
      "2x M5 washers",
    ],
    availability: "In Stock",
    shopifyEnabled: true,
  },
  {
    id: "ram-airbox",
    name: "Racing Airbox for Mopeds (RAM)",
    description:
      "Tunable airbox designed to maximize your moped's power. Bonus: it makes your moped slightly quieter too.",
    price: "TBD",
    image: null,
    includes: null,
    availability: "Coming Soon",
  },
];

const MOPEDS_FOR_SALE = [
  {
    name: "Puch Maxi N",
    specs: "White Frame | Kitted | Custom Seat",
    price: "$800",
    description:
      "Clean white Puch Maxi N with a performance kit installed and a custom seat. Ready to rip or make it your own project. Classic Austrian engineering meets California streets.",
    image: "/images/honesMopeds/maxi_n.JPG",
  },
];

export default function Shop() {
  return (
    <CartProvider>
      <CartButton />
      <CartDrawer />
      <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
      <div className="mb-8 text-center">
        <div className="mb-4 flex items-center justify-center gap-3">
          <Star className="h-8 w-8 text-orange-500" />
          <Star className="h-6 w-6 text-[#FFD700]" />
          <Star className="h-8 w-8 text-orange-500" />
        </div>
        <h1 className="mb-2 text-5xl font-black uppercase tracking-tighter text-black md:text-7xl">
          Pedal Code
        </h1>
        <h2 className="mb-4 text-3xl font-black uppercase tracking-tight text-orange-600 md:text-4xl">
          Speed Shop
        </h2>
        <p className="mx-auto mb-6 max-w-md text-sm font-bold uppercase tracking-wide text-gray-600">
          Keeping vintage two-strokes alive since recently
        </p>

        {/* Shipping Banner */}
        <div className="mx-auto mb-6 max-w-md rounded-none border-2 border-black bg-[#FFD700] px-4 py-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-sm font-black uppercase text-black">
            Free Shipping on Orders Over $99
          </p>
        </div>

        <div className="mx-auto max-w-2xl rounded-none border-4 border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <p className="mb-4 text-gray-800">
            We design and print parts for the mopeds manufacturers forgot about.
            Hobbits, Variants, Ciaos - if it&apos;s broken and out of
            production, we can probably print it.
          </p>
          <p className="mb-4 font-bold text-black">
            Got a part that doesn&apos;t exist anymore?{" "}
            <Link
              href="mailto:pedalcodearmy@gmail.com?subject=Custom%203D%20Print%20Request"
              className="text-orange-600 underline hover:text-orange-800"
            >
              Hit us up for custom work.
            </Link>
          </p>
          <div className="flex items-center justify-center gap-6 border-t-2 border-black pt-4">
            <Link
              href="https://instagram.com/pedalcodearmy"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 font-bold text-black transition-colors hover:text-orange-600"
            >
              <Instagram className="h-5 w-5" />
              <span className="text-sm">@pedalcodearmy</span>
            </Link>
            <Link
              href="https://tiktok.com/@pedal.code"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 font-bold text-black transition-colors hover:text-orange-600"
            >
              <TikTokIcon className="h-5 w-5" />
              <span className="text-sm">@pedal.code</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Moped Heritage Section */}
      <MopedHeritage />

      <RetroStripe />

      {/* 3D Printed Parts Section */}
      <section className="mb-16">
        <div className="mb-8 flex flex-col items-center justify-center gap-2">
          <div className="flex items-center gap-3">
            <Printer className="h-8 w-8 text-black" />
            <h2 className="text-3xl font-black uppercase tracking-tight text-black">
              3D Printed Parts
            </h2>
          </div>
          <p className="text-sm font-bold uppercase tracking-wide text-orange-600">
            From Tokyo to Barcelona to Milano
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {PRINTED_PARTS.map((part) => (
            <Card
              key={part.id}
              className="flex flex-col overflow-hidden rounded-none border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
            >
              {part.image ? (
                <div className="relative aspect-square w-full">
                  <Image
                    src={part.image}
                    alt={part.name}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <PlaceholderImage label="Product Photo" />
              )}
              <CardContent className="flex flex-1 flex-col p-4">
                <h3 className="mb-2 text-lg font-black uppercase text-black">
                  {part.name}
                </h3>

                <p className="mb-3 text-sm text-gray-600">{part.description}</p>

                {part.includes && (
                  <div className="mb-3 rounded-none border-2 border-dashed border-gray-400 bg-amber-50 p-2">
                    <p className="mb-1 text-xs font-black uppercase text-black">
                      What&apos;s in the box:
                    </p>
                    <ul className="space-y-0.5 text-xs text-gray-700">
                      {part.includes.map((item, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <span className="font-bold text-orange-500">+</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-auto border-t-2 border-black pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-2xl font-black text-black">
                      {part.price}
                      {part.priceLabel && (
                        <span className="text-sm font-bold text-gray-500">
                          {" "}
                          {part.priceLabel}
                        </span>
                      )}
                    </span>
                    <RetroBadge color="orange">{part.availability}</RetroBadge>
                  </div>
                  {part.customizable ? (
                    <>
                      <Link
                        href="/shop/side-covers"
                        className="flex w-full items-center justify-center gap-2 rounded-none border-2 border-black bg-[#FFD700] py-3 text-sm font-black uppercase text-black transition-all hover:bg-yellow-400 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                      >
                        Customize Yours
                      </Link>
                      <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-wide text-gray-500">
                        Preview your custom text before ordering
                      </p>
                    </>
                  ) : part.shopifyEnabled ? (
                    <>
                      <ShopifyBuyButton
                        productId={part.id}
                        productName={part.name}
                        price={part.price}
                        image={part.image ?? undefined}
                      />
                      <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-wide text-gray-500">
                        Secure checkout via Shopify
                      </p>
                    </>
                  ) : (
                    <>
                      <WaitlistButton productName={part.name} productPrice={part.price} />
                      <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-wide text-gray-500">
                        No payment until it&apos;s ready to ship
                      </p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <RetroStripe />

      {/* Mopeds for Sale Section */}
      <section className="mb-16">
        <div className="mb-8 flex flex-col items-center justify-center gap-2">
          <div className="flex items-center gap-3">
            <Motorcycle className="h-8 w-8 text-black" />
            <h2 className="text-3xl font-black uppercase tracking-tight text-black">
              Mopeds for Sale
            </h2>
          </div>
          <p className="text-sm font-bold uppercase tracking-wide text-orange-600">
            Pre-mix perfection seeking new riders
          </p>
        </div>

        <div className="mx-auto max-w-lg">
          {MOPEDS_FOR_SALE.map((moped) => (
            <Card
              key={moped.name}
              className="overflow-hidden rounded-none border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
            >
              {moped.image ? (
                <div className="relative aspect-square w-full">
                  <Image
                    src={moped.image}
                    alt={moped.name}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <PlaceholderImage label="Moped Photo" />
              )}
              <CardContent className="p-4">
                <div className="mb-2 flex items-start justify-between">
                  <h3 className="text-xl font-black uppercase text-black">
                    {moped.name}
                  </h3>
                  <RetroBadge color="gold">For Sale</RetroBadge>
                </div>
                <p className="mb-2 text-xs font-black uppercase tracking-wider text-orange-600">
                  {moped.specs}
                </p>
                <p className="mb-4 text-sm text-gray-600">
                  {moped.description}
                </p>
                <div className="border-t-2 border-black pt-3">
                  <div className="mb-3 text-center">
                    <span className="text-3xl font-black text-black">
                      {moped.price}
                    </span>
                  </div>
                  <Link
                    href="mailto:pedalcodearmy@gmail.com?subject=Interested in Puch Maxi N&body=Hi, I'm interested in the Puch Maxi N you have for sale. Is it still available?"
                    className="flex w-full items-center justify-center gap-2 rounded-none border-2 border-black bg-[#FFD700] py-3 text-sm font-black uppercase text-black transition-all hover:bg-yellow-400 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  >
                    Inquire About This Ride
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Contact CTA */}
      <section className="text-center">
        <div className="inline-block rounded-none border-4 border-black bg-black px-8 py-6 shadow-[6px_6px_0px_0px_rgba(255,165,0,1)]">
          <h3 className="mb-2 text-2xl font-black uppercase text-[#FFD700]">
            Questions?
          </h3>
          <p className="text-sm font-bold text-white">
            Slide into our{" "}
            <Link
              href="https://instagram.com/pedalcodearmy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 underline hover:text-orange-300"
            >
              Instagram DMs
            </Link>{" "}
            or{" "}
            <Link
              href="mailto:pedalcodearmy@gmail.com"
              className="text-orange-400 underline hover:text-orange-300"
            >
              shoot us an email
            </Link>
          </p>
        </div>
      </section>

      {/* Legal Disclaimer */}
      <section className="mt-16">
        <div className="rounded-none border-4 border-red-800 bg-red-50 p-6">
          <h3 className="mb-4 text-center text-lg font-black uppercase text-red-800">
            Important Safety Disclaimer
          </h3>
          <div className="space-y-3 text-sm text-red-900">
            <p>
              <strong>USE AT YOUR OWN RISK:</strong> All 3D printed parts sold by Pedal Code Army are provided &quot;as is&quot; without any warranty, express or implied. These parts are not safety tested, certified, or approved by any regulatory agency.
            </p>
            <p>
              <strong>ASSUMPTION OF RISK:</strong> By purchasing and installing these parts, you acknowledge and accept full responsibility for any and all risks associated with their use, including but not limited to personal injury, death, property damage, or mechanical failure.
            </p>
            <p>
              <strong>NOT FOR STREET USE:</strong> These parts are intended for off-road, display, or novelty purposes only. Use on public roads is at your own risk and may not comply with local vehicle safety regulations.
            </p>
            <p>
              <strong>PROFESSIONAL INSTALLATION RECOMMENDED:</strong> We strongly recommend having all parts inspected and installed by a qualified mechanic. Improper installation may result in part failure, accidents, or injury.
            </p>
            <p>
              <strong>NO LIABILITY:</strong> Pedal Code Army, its owners, employees, and affiliates shall not be held liable for any damages, injuries, or losses resulting from the use, misuse, or failure of any products sold. This includes direct, indirect, incidental, punitive, and consequential damages.
            </p>
            <p>
              <strong>WARRANTY DISCLAIMER:</strong> Installing aftermarket parts may void your vehicle&apos;s manufacturer warranty. Pedal Code Army is not responsible for any warranty claims denied as a result of using our products.
            </p>
            <p className="pt-2 text-center text-xs font-bold uppercase tracking-wide text-red-700">
              By completing a purchase, you agree to these terms and conditions.
            </p>
          </div>
        </div>
      </section>
      </div>
    </CartProvider>
  );
}
