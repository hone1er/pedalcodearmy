"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
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
  RefreshCw,
} from "lucide-react";
import { ShopifyBuyButton } from "@/components/shopify-buy-button";
import {
  ProductImageCarousel,
  type CarouselMedia,
} from "@/components/product-image-carousel";
import {
  SHOPIFY_VARIANT_IDS,
  extractNumericVariantId,
  fetchStorefrontProducts,
  type StorefrontProduct,
  type StorefrontVariant,
} from "@/lib/shopify";
import Link from "next/link";
import Image from "next/image";

const CONTACT_EMAIL = "pedalcodearmy@gmail.com";
const CARD_IMAGE_SIZES = "(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw";

function mailtoHref(subject: string, body?: string): string {
  const params = [`subject=${encodeURIComponent(subject)}`];
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${CONTACT_EMAIL}?${params.join("&")}`;
}

/** Read an API error message without assuming the response body is JSON. */
async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const text = await response.text();
    try {
      const data = JSON.parse(text) as { error?: unknown };
      if (typeof data.error === "string" && data.error.trim()) {
        return data.error;
      }
    } catch {
      // Not JSON (e.g. an HTML error page) — fall through.
    }
  } catch {
    // Body unreadable — fall through.
  }
  return fallback;
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

function PlaceholderImage({ label }: { label: string }) {
  return (
    <div className="relative flex aspect-square w-full items-center justify-center bg-gradient-to-br from-amber-100 to-orange-100">
      <div className="absolute inset-0 opacity-10" aria-hidden="true">
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
      <div className="text-center text-orange-900">
        <Package className="mx-auto mb-2 h-12 w-12" aria-hidden="true" />
        <p className="text-sm font-bold">{label}</p>
      </div>
    </div>
  );
}

function RetroStripe() {
  return (
    <div className="my-8 flex items-center justify-center gap-1" aria-hidden="true">
      <div className="h-2 w-16 bg-orange-500" />
      <div className="h-2 w-8 bg-black" />
      <div className="h-2 w-16 bg-[#FFD700]" />
      <div className="h-2 w-8 bg-black" />
      <div className="h-2 w-16 bg-orange-500" />
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
    orange: "bg-orange-700 text-white border-black",
    gold: "bg-[#FFD700] text-black border-black",
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

function WaitlistButton({
  productName,
  productPrice,
}: {
  productName: string;
  productPrice: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [hpCheck, setHpCheck] = useState(""); // honeypot
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const fieldId = useId();
  const nameId = `${fieldId}-name`;
  const emailId = `${fieldId}-email`;
  const hpCheckId = `${fieldId}-hp-check`;
  const errorId = `${fieldId}-error`;

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
          hpCheck,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Failed to join waitlist"));
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
    // Reset form after the close animation
    setTimeout(() => {
      setEmail("");
      setName("");
      setHpCheck("");
      setIsSuccess(false);
      setError("");
    }, 300);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex w-full items-center justify-center gap-2 rounded-none border-2 border-black bg-black py-3 text-sm font-black uppercase text-[#FFD700] transition-all hover:bg-gray-900 hover:shadow-[4px_4px_0px_0px_rgba(255,165,0,1)]"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        Get Notified
      </button>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : handleClose())}>
        <DialogContent className="rounded-none border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase text-black">
              Join the Waitlist
            </DialogTitle>
            <DialogDescription className="text-gray-700">
              Get notified when{" "}
              <span className="font-bold text-black">{productName}</span> is
              available.
            </DialogDescription>
          </DialogHeader>

          {isSuccess ? (
            <div className="py-6 text-center" role="status">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <Check className="h-6 w-6 text-green-700" aria-hidden="true" />
              </div>
              <h3 className="mb-2 text-lg font-black uppercase text-black">
                You&apos;re on the list!
              </h3>
              <p className="text-sm text-gray-700">
                We&apos;ll email you when it&apos;s ready.
              </p>
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
                <label htmlFor={nameId} className="mb-2 block text-sm font-bold text-black">
                  Name
                </label>
                <Input
                  id={nameId}
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Your name"
                  className="rounded-none border-2 border-black"
                />
              </div>
              <div>
                <label htmlFor={emailId} className="mb-2 block text-sm font-bold text-black">
                  Email
                </label>
                <Input
                  id={emailId}
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  aria-describedby={error ? errorId : undefined}
                  className="rounded-none border-2 border-black"
                />
              </div>

              {/* Honeypot: hidden from people, tempting to bots. The neutral
                  name + autoComplete="new-password" keep browser contact
                  autofill from filling it and flagging real shoppers. */}
              <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
                <label htmlFor={hpCheckId}>Leave this field empty</label>
                <input
                  id={hpCheckId}
                  name="hpCheck"
                  type="text"
                  tabIndex={-1}
                  autoComplete="new-password"
                  value={hpCheck}
                  onChange={(e) => setHpCheck(e.target.value)}
                />
              </div>

              {error && (
                <p id={errorId} role="alert" className="text-sm font-bold text-red-700">
                  {error}
                </p>
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

interface ShopPart {
  id: string;
  name: string;
  description: string;
  price: string;
  priceLabel?: string;
  image: string | null;
  media?: CarouselMedia[];
  includes: string[] | null;
  includesTitle?: string;
  availability: string;
  customizable?: boolean;
  shopifyEnabled?: boolean;
  shopifyVariantId?: string;
  availableForSale?: boolean;
  /** Present only when the Shopify product has more than one variant. */
  variants?: PartVariant[];
  /** Shopify handle, used as the card's anchor so JSON-LD product URLs resolve. */
  anchorId?: string;
}

interface PartVariant {
  id: string;
  title: string;
  price: string;
  availableForSale: boolean;
}

const PRINTED_PARTS: ShopPart[] = [
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
      "Plain: $50 | Custom text: $60 per side",
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
    media: [
      { type: "image", src: "/images/products/forkSpacers.JPG" },
      {
        type: "video",
        src: "/videos/products/hobbit_fork_extensions.mp4",
        poster: "/images/products/forkSpacers.JPG",
      },
    ],
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
    media: [
      { type: "image", src: "/images/products/chainTensioner.JPG" },
      {
        type: "video",
        src: "/videos/products/hobbit_chain_tensioner.mp4",
        poster: "/images/products/chainTensioner.JPG",
      },
    ],
    includes: [
      "3D printed chain tensioner parts",
      "2x M5x22mm bolt",
      "2x M5 washers",
    ],
    availability: "In Stock",
    shopifyEnabled: true,
  },
  {
    id: "headlight-bracket-pa50",
    name: 'Honda PA50 4.5" Headlight Bracket',
    description:
      'Mount a 4.5" Euro-style headlight on your Honda PA50, with an integrated mount for a Trail Tech temp gauge. 3D printed from PAHT-CF for stiffness and heat resistance.',
    price: "$20",
    image: "/images/products/headlightBracketPA50.jpg",
    media: [
      { type: "image", src: "/images/products/headlightBracketPA50.jpg" },
      { type: "image", src: "/images/products/headlightBracketPA50_2.jpg" },
      { type: "image", src: "/images/products/headlightBracketPA50_3.jpg" },
      { type: "image", src: "/images/products/headlightBracketPA50_4.jpg" },
      { type: "image", src: "/images/products/headlightBracketPA50_5.jpg" },
      { type: "image", src: "/images/products/headlightBracketPA50_6.jpg" },
    ],
    includes: [
      "3D printed PAHT-CF headlight bracket",
      'Fits 4.5" Euro-style headlights',
      "Trail Tech temp gauge mount",
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

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  times: "×",
  deg: "°",
  bull: "•",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

function decodeHtmlEntities(input: string): string {
  return input.replace(
    /&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g,
    (match, entity: string) => {
      if (entity.startsWith("#x") || entity.startsWith("#X")) {
        const codePoint = Number.parseInt(entity.slice(2), 16);
        return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
      }
      if (entity.startsWith("#")) {
        const codePoint = Number.parseInt(entity.slice(1), 10);
        return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
      }
      return NAMED_HTML_ENTITIES[entity.toLowerCase()] ?? match;
    },
  );
}

function stripHtmlTags(input: string): string {
  return decodeHtmlEntities(
    input.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function parseShopifyDescription(
  descriptionHtml: string,
  fallbackDescription: string,
): { description: string; includes: string[] | null } {
  const listItems: string[] = [];
  const liRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let liMatch: RegExpExecArray | null;
  while ((liMatch = liRegex.exec(descriptionHtml)) !== null) {
    const cleaned = stripHtmlTags(liMatch[1] ?? "");
    if (cleaned) {
      listItems.push(cleaned);
    }
  }

  const paragraphs: string[] = [];
  const pRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let pMatch: RegExpExecArray | null;
  while ((pMatch = pRegex.exec(descriptionHtml)) !== null) {
    const cleaned = stripHtmlTags(pMatch[1] ?? "");
    if (cleaned) {
      paragraphs.push(cleaned);
    }
  }

  let description = paragraphs.join(" ").trim();
  if (!description && descriptionHtml) {
    const withoutLists = descriptionHtml
      .replace(/<ul\b[^>]*>[\s\S]*?<\/ul>/gi, " ")
      .replace(/<ol\b[^>]*>[\s\S]*?<\/ol>/gi, " ");
    description = stripHtmlTags(withoutLists);
  }
  if (!description) {
    description = fallbackDescription.trim();
  }

  return {
    description,
    includes: listItems.length > 0 ? listItems : null,
  };
}

function formatShopifyPrice(amount: string, currencyCode = "USD"): string {
  const numeric = Number.parseFloat(amount);
  if (Number.isNaN(numeric)) return amount;
  const symbol = currencyCode === "USD" ? "$" : `${currencyCode} `;
  const fixed = numeric.toFixed(2);
  return fixed.endsWith(".00")
    ? `${symbol}${fixed.slice(0, -3)}`
    : `${symbol}${fixed}`;
}

function toPartVariants(product: StorefrontProduct): PartVariant[] | undefined {
  if (product.variants.length < 2) return undefined;
  return product.variants.map((variant: StorefrontVariant) => ({
    id: variant.id,
    title: variant.title,
    price: formatShopifyPrice(variant.price.amount, variant.price.currencyCode),
    availableForSale: product.availableForSale && variant.availableForSale,
  }));
}

function extractStorefrontMedia(product: StorefrontProduct): {
  media: CarouselMedia[];
  model3dSlides: CarouselMedia[];
  primaryImage: string | null;
} {
  const images: CarouselMedia[] = [];
  const videos: CarouselMedia[] = [];
  const model3dSlides: CarouselMedia[] = [];

  for (const item of product.media) {
    if (item.mediaContentType === "IMAGE" && item.image?.url) {
      images.push({
        type: "image",
        src: item.image.url,
        alt: item.image.altText ?? item.alt ?? product.title,
      });
    } else if (item.mediaContentType === "VIDEO") {
      const source =
        item.sources.find((s) => s.mimeType.toLowerCase().includes("mp4")) ??
        item.sources[0];
      if (source?.url) {
        videos.push({
          type: "video",
          src: source.url,
          poster: item.previewImage?.url ?? undefined,
        });
      }
    } else if (item.mediaContentType === "MODEL_3D") {
      const glbSource = item.sources.find((s) => {
        const cleanUrl = s.url.toLowerCase().split("?")[0] ?? "";
        return (
          s.format.toLowerCase() === "glb" ||
          s.mimeType.toLowerCase() === "model/gltf-binary" ||
          cleanUrl.endsWith(".glb")
        );
      });
      if (glbSource?.url) {
        const usdzSource = item.sources.find((s) => {
          const cleanUrl = s.url.toLowerCase().split("?")[0] ?? "";
          return (
            s.format.toLowerCase() === "usdz" ||
            s.mimeType.toLowerCase() === "model/vnd.usdz+zip" ||
            cleanUrl.endsWith(".usdz")
          );
        });
        model3dSlides.push({
          type: "model3d",
          src: glbSource.url,
          poster: item.previewImage?.url ?? undefined,
          usdzSrc: usdzSource?.url,
          alt: item.alt ?? `${product.title} 3D model`,
        });
      }
    }
  }

  const firstImage = images[0]?.src ?? null;
  const firstModelPoster =
    model3dSlides[0]?.type === "model3d"
      ? (model3dSlides[0].poster ?? null)
      : null;
  const firstVideoPoster =
    videos[0]?.type === "video" ? (videos[0].poster ?? null) : null;

  return {
    media: [...images, ...videos, ...model3dSlides],
    model3dSlides,
    primaryImage: firstImage ?? firstModelPoster ?? firstVideoPoster,
  };
}

const HARDCODED_VARIANT_TO_PART_ID = new Map<string, string>(
  Object.entries(SHOPIFY_VARIANT_IDS).map(([partId, variantId]) => [
    extractNumericVariantId(variantId),
    partId,
  ]),
);

function matchHardcodedPartId(product: StorefrontProduct): string | null {
  for (const variant of product.variants) {
    const numericId = extractNumericVariantId(variant.id);
    const matchedPartId = HARDCODED_VARIANT_TO_PART_ID.get(numericId);
    if (matchedPartId) {
      return matchedPartId;
    }
  }

  const handle = product.handle.toLowerCase();
  const title = product.title.toLowerCase();
  const combined = `${handle} ${title}`;

  if (
    handle === "side-covers" ||
    handle === "puch-magnum-side-covers" ||
    (combined.includes("magnum") &&
      combined.includes("side") &&
      combined.includes("cover"))
  ) {
    return "side-covers";
  }

  if (
    handle.includes("ram-airbox") ||
    title.includes("ram-airbox") ||
    handle.includes("racing-airbox") ||
    title.includes("racing airbox")
  ) {
    return "ram-airbox";
  }

  if (PRINTED_PARTS.some((part) => part.id === handle)) {
    return handle;
  }

  return null;
}

function mergeCatalog(shopifyProducts: StorefrontProduct[]): ShopPart[] {
  const matchedByPartId = new Map<string, StorefrontProduct>();
  const dynamicProducts: StorefrontProduct[] = [];

  for (const product of shopifyProducts) {
    const matchedId = matchHardcodedPartId(product);
    if (matchedId) {
      if (!matchedByPartId.has(matchedId)) {
        matchedByPartId.set(matchedId, product);
      }
    } else {
      dynamicProducts.push(product);
    }
  }

  const mergedHardcoded: ShopPart[] = PRINTED_PARTS.map((part) => {
    const matched = matchedByPartId.get(part.id);
    if (!matched) return part;
    const anchorId = matched.handle || undefined;

    const { media: shopifyMedia, model3dSlides, primaryImage } =
      extractStorefrontMedia(matched);

    let mergedMedia = part.media ? [...part.media] : undefined;
    if (model3dSlides.length > 0) {
      const baseMedia: CarouselMedia[] =
        mergedMedia ?? (part.image ? [{ type: "image", src: part.image }] : []);
      const existingSrcs = new Set(baseMedia.map((item) => item.src));
      const newModels = model3dSlides.filter(
        (slide) => !existingSrcs.has(slide.src),
      );
      mergedMedia = [...baseMedia, ...newModels];
    }

    if (part.id === "ram-airbox") {
      const primaryVariant =
        matched.variants.find((v) => v.availableForSale) ?? matched.variants[0];
      if (primaryVariant) {
        const isAvailable =
          matched.availableForSale && primaryVariant.availableForSale;
        const parsed = parseShopifyDescription(
          matched.descriptionHtml,
          matched.description,
        );
        return {
          ...part,
          price: formatShopifyPrice(
            primaryVariant.price.amount,
            primaryVariant.price.currencyCode,
          ),
          image: part.image ?? primaryImage,
          media:
            mergedMedia && mergedMedia.length > 0
              ? mergedMedia
              : shopifyMedia.length > 0
                ? shopifyMedia
                : undefined,
          includes: part.includes ?? parsed.includes,
          includesTitle: part.includes
            ? part.includesTitle
            : parsed.includes
              ? "Specs / Details:"
              : undefined,
          availability: isAvailable ? "In Stock" : "Sold Out",
          shopifyEnabled: true,
          shopifyVariantId: primaryVariant.id,
          availableForSale: isAvailable,
          variants: toPartVariants(matched),
          anchorId,
        };
      }
    }

    if (part.shopifyEnabled) {
      const hardcodedVariantId = SHOPIFY_VARIANT_IDS[part.id];
      const hardcodedNumericId = hardcodedVariantId
        ? extractNumericVariantId(hardcodedVariantId)
        : null;
      const primaryVariant =
        (hardcodedNumericId
          ? matched.variants.find(
              (v) => extractNumericVariantId(v.id) === hardcodedNumericId,
            )
          : undefined) ??
        matched.variants.find((v) => v.availableForSale) ??
        matched.variants[0];

      if (primaryVariant) {
        const isAvailable =
          matched.availableForSale && primaryVariant.availableForSale;
        return {
          ...part,
          media: mergedMedia,
          price: formatShopifyPrice(
            primaryVariant.price.amount,
            primaryVariant.price.currencyCode,
          ),
          availability: isAvailable ? "In Stock" : "Sold Out",
          shopifyVariantId: primaryVariant.id,
          availableForSale: isAvailable,
          variants: toPartVariants(matched),
          anchorId,
        };
      }
    }

    return {
      ...part,
      media: mergedMedia,
      anchorId,
    };
  });

  const dynamicParts: ShopPart[] = dynamicProducts.map((product) => {
    const primaryVariant =
      product.variants.find((v) => v.availableForSale) ?? product.variants[0];
    const { media, primaryImage } = extractStorefrontMedia(product);
    const { description, includes } = parseShopifyDescription(
      product.descriptionHtml,
      product.description,
    );
    const isAvailable =
      product.availableForSale && (primaryVariant?.availableForSale ?? false);

    return {
      id: product.handle || product.id,
      name: product.title,
      description,
      price: primaryVariant
        ? formatShopifyPrice(
            primaryVariant.price.amount,
            primaryVariant.price.currencyCode,
          )
        : "TBD",
      image: primaryImage,
      media: media.length > 0 ? media : undefined,
      includes,
      includesTitle: "Specs / Details:",
      availability: isAvailable ? "In Stock" : "Sold Out",
      shopifyEnabled: Boolean(primaryVariant),
      shopifyVariantId: primaryVariant?.id,
      availableForSale: isAvailable,
      variants: toPartVariants(product),
    };
  });

  return [...mergedHardcoded, ...dynamicParts];
}

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

function ProductCard({ part, isPriorityCard }: { part: ShopPart; isPriorityCard: boolean }) {
  const selectId = useId();
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(
    part.shopifyVariantId,
  );

  // Keep the selection valid if the catalog refreshes underneath us.
  const selectedVariant =
    part.variants?.find((variant) => variant.id === selectedVariantId) ??
    part.variants?.find((variant) => variant.id === part.shopifyVariantId);

  const price = selectedVariant?.price ?? part.price;
  const availableForSale = selectedVariant
    ? selectedVariant.availableForSale
    : part.availableForSale;
  const availability = selectedVariant
    ? selectedVariant.availableForSale
      ? "In Stock"
      : "Sold Out"
    : part.availability;
  const variantId = selectedVariant?.id ?? part.shopifyVariantId;
  const productName = selectedVariant ? `${part.name} — ${selectedVariant.title}` : part.name;

  return (
    <Card
      id={part.anchorId ?? part.id}
      className="flex scroll-mt-24 flex-col overflow-hidden rounded-none border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
    >
      {part.media && part.media.length > 0 ? (
        <ProductImageCarousel
          media={part.media}
          alt={part.name}
          isPriorityCard={isPriorityCard}
        />
      ) : part.image ? (
        <div className="relative aspect-square w-full">
          <Image
            src={part.image}
            alt={part.name}
            fill
            sizes={CARD_IMAGE_SIZES}
            priority={isPriorityCard}
            className="object-cover"
          />
        </div>
      ) : (
        <PlaceholderImage label="Product Photo" />
      )}
      <CardContent className="flex flex-1 flex-col p-4">
        <h3 className="mb-2 text-lg font-black uppercase text-black">{part.name}</h3>

        {part.description && (
          <p className="mb-3 text-sm text-gray-700">{part.description}</p>
        )}

        {part.includes && part.includes.length > 0 && (
          <div className="mb-3 rounded-none border-2 border-dashed border-gray-500 bg-amber-50 p-2">
            <p className="mb-1 text-xs font-black uppercase text-black">
              {part.includesTitle ?? "What's in the box:"}
            </p>
            <ul className="space-y-0.5 text-xs text-gray-800">
              {part.includes.map((item, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span className="font-bold text-orange-800" aria-hidden="true">
                    +
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-auto border-t-2 border-black pt-3">
          {part.variants && part.variants.length > 1 && (
            <div className="mb-3">
              <label
                htmlFor={selectId}
                className="mb-1 block text-xs font-black uppercase text-black"
              >
                Option
              </label>
              <select
                id={selectId}
                value={selectedVariant?.id ?? ""}
                onChange={(e) => setSelectedVariantId(e.target.value)}
                className="w-full rounded-none border-2 border-black bg-white px-3 py-2 text-sm font-bold text-black focus:outline-none focus:ring-2 focus:ring-black"
              >
                {part.variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.title} — {variant.price}
                    {variant.availableForSale ? "" : " (Sold out)"}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mb-2 flex items-center justify-between">
            <span className="text-2xl font-black text-black">
              {price}
              {part.priceLabel && (
                <span className="text-sm font-bold text-gray-700"> {part.priceLabel}</span>
              )}
            </span>
            <RetroBadge color={availability === "Sold Out" ? "black" : "orange"}>
              {availability}
            </RetroBadge>
          </div>
          {part.customizable ? (
            <>
              <Link
                href="/shop/side-covers"
                className="flex w-full items-center justify-center gap-2 rounded-none border-2 border-black bg-[#FFD700] py-3 text-sm font-black uppercase text-black transition-all hover:bg-yellow-400 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              >
                Customize Yours
              </Link>
              <p className="mt-2 text-center text-xs font-bold uppercase tracking-wide text-gray-700">
                Preview your custom text before ordering
              </p>
            </>
          ) : part.shopifyEnabled ? (
            <>
              <ShopifyBuyButton
                productId={part.id}
                productName={productName}
                price={price}
                image={part.image ?? undefined}
                variantId={variantId}
                availableForSale={availableForSale}
              />
              <p className="mt-2 text-center text-xs font-bold uppercase tracking-wide text-gray-700">
                Secure checkout via Shopify
              </p>
            </>
          ) : (
            <>
              <WaitlistButton productName={part.name} productPrice={part.price} />
              <p className="mt-2 text-center text-xs font-bold uppercase tracking-wide text-gray-700">
                No payment until it&apos;s ready to ship
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface ShopProps {
  initialShopifyProducts?: StorefrontProduct[];
  /** True when the server couldn't load live Shopify products. */
  initialLoadFailed?: boolean;
}

export default function Shop({
  initialShopifyProducts = [],
  initialLoadFailed = false,
}: ShopProps) {
  const [shopifyProducts, setShopifyProducts] = useState<StorefrontProduct[]>(
    initialShopifyProducts,
  );
  const [loadState, setLoadState] = useState<"ok" | "loading" | "failed">(
    initialLoadFailed ? "loading" : "ok",
  );

  const loadProducts = useCallback(async () => {
    setLoadState("loading");
    try {
      const products = await fetchStorefrontProducts({ throwOnError: true });
      setShopifyProducts(products);
      setLoadState("ok");
    } catch (error) {
      console.error("Failed to load live Shopify products:", error);
      setLoadState("failed");
    }
  }, []);

  // Only refetch on the client when the server-side load failed; otherwise
  // the server already delivered live products.
  useEffect(() => {
    if (initialLoadFailed) {
      void loadProducts();
    }
  }, [initialLoadFailed, loadProducts]);

  const catalogParts = useMemo(
    () => mergeCatalog(shopifyProducts),
    [shopifyProducts],
  );

  const inquiryHref = mailtoHref(
    "Interested in Puch Maxi N",
    "Hi, I'm interested in the Puch Maxi N you have for sale. Is it still available?",
  );

  return (
    <>
      <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex items-center justify-center gap-3" aria-hidden="true">
            <Star className="h-8 w-8 text-black" />
            <Star className="h-6 w-6 text-orange-700" />
            <Star className="h-8 w-8 text-black" />
          </div>
          <h1 className="mb-2 text-5xl font-black uppercase tracking-tighter text-black md:text-7xl">
            Pedal Code
            <span className="mt-2 block">
              <span className="inline-block bg-black px-3 py-1 text-3xl tracking-tight text-[#FFD700] md:text-4xl">
                Speed Shop
              </span>
            </span>
          </h1>
          <p className="mx-auto mb-6 mt-4 max-w-md text-sm font-bold uppercase tracking-wide text-black">
            Keeping vintage two-strokes alive since recently
          </p>

          {/* Shipping Banner */}
          <div className="mx-auto mb-6 max-w-md rounded-none border-2 border-black bg-white px-4 py-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-sm font-black uppercase text-black">
              Free Shipping on Orders Over $99
            </p>
          </div>
        </div>

        <RetroStripe />

        {/* 3D Printed Parts Section */}
        <section className="mb-16" aria-labelledby="printed-parts-heading">
          <div className="mb-8 flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-3 rounded-none border-4 border-black bg-white px-4 py-2 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <Printer className="h-8 w-8" aria-hidden="true" />
              <h2
                id="printed-parts-heading"
                className="text-2xl font-black uppercase tracking-tight md:text-3xl"
              >
                3D Printed Parts
              </h2>
            </div>
          </div>

          <div aria-live="polite">
            {loadState === "loading" && (
              <p className="mx-auto mb-6 max-w-md rounded-none border-2 border-black bg-white px-4 py-2 text-center text-sm font-bold text-black">
                Loading live prices and availability…
              </p>
            )}
            {loadState === "failed" && (
              <div
                role="alert"
                className="mx-auto mb-6 flex max-w-xl flex-col items-center gap-3 rounded-none border-4 border-black bg-white p-4 text-center text-black sm:flex-row sm:text-left"
              >
                <p className="flex-1 text-sm font-bold">
                  We couldn&apos;t load live prices and stock from Shopify.
                  Prices shown may be out of date.
                </p>
                <button
                  type="button"
                  onClick={() => void loadProducts()}
                  className="flex items-center gap-2 rounded-none border-2 border-black bg-[#FFD700] px-4 py-2 text-sm font-black uppercase text-black hover:bg-yellow-400"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Retry
                </button>
              </div>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {catalogParts.map((part, index) => (
              <ProductCard key={part.id} part={part} isPriorityCard={index === 0} />
            ))}
          </div>
        </section>

        <RetroStripe />

        {/* Mopeds for Sale Section */}
        <section className="mb-16" aria-labelledby="mopeds-heading">
          <div className="mb-8 flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-3 rounded-none border-4 border-black bg-white px-4 py-2 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <Motorcycle className="h-8 w-8" aria-hidden="true" />
              <h2
                id="mopeds-heading"
                className="text-2xl font-black uppercase tracking-tight md:text-3xl"
              >
                Mopeds for Sale
              </h2>
            </div>
            <p className="rounded-none bg-black px-3 py-1 text-sm font-bold uppercase tracking-wide text-[#FFD700]">
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
                      sizes="(max-width: 640px) 100vw, 512px"
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
                  <p className="mb-2 text-xs font-black uppercase tracking-wider text-orange-800">
                    {moped.specs}
                  </p>
                  <p className="mb-4 text-sm text-gray-700">{moped.description}</p>
                  <div className="border-t-2 border-black pt-3">
                    <div className="mb-3 text-center">
                      <span className="text-3xl font-black text-black">
                        {moped.price}
                      </span>
                    </div>
                    <a
                      href={inquiryHref}
                      className="flex w-full items-center justify-center gap-2 rounded-none border-2 border-black bg-[#FFD700] py-3 text-sm font-black uppercase text-black transition-all hover:bg-yellow-400 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                    >
                      Inquire About This Ride
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <div className="mx-auto mb-12 max-w-2xl rounded-none border-4 border-black bg-white p-6 text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <p className="mb-4 text-gray-800">
            We design and print parts for the mopeds manufacturers forgot about.
            Hobbits, Variants, Ciaos - if it&apos;s broken and out of
            production, we can probably print it.
          </p>
          <p className="mb-4 font-bold text-black">
            Got a part that doesn&apos;t exist anymore?{" "}
            <a
              href={mailtoHref("Custom 3D Print Request")}
              className="text-orange-800 underline hover:text-black"
            >
              Hit us up for custom work.
            </a>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 border-t-2 border-black pt-4">
            <a
              href="https://instagram.com/pedalcodearmy"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 font-bold text-black transition-colors hover:text-orange-800"
            >
              <Instagram className="h-5 w-5" aria-hidden="true" />
              <span className="text-sm">@pedalcodearmy</span>
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            <a
              href="https://tiktok.com/@pedal.code"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 font-bold text-black transition-colors hover:text-orange-800"
            >
              <TikTokIcon className="h-5 w-5" />
              <span className="text-sm">@pedal.code</span>
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
        </div>

        {/* Contact CTA */}
        <section className="text-center">
          <div className="inline-block rounded-none border-4 border-black bg-black px-8 py-6 shadow-[6px_6px_0px_0px_rgba(255,165,0,1)]">
            <h3 className="mb-2 text-2xl font-black uppercase text-[#FFD700]">
              Questions?
            </h3>
            <p className="mb-3 text-sm font-bold text-white">
              Slide into our{" "}
              <a
                href="https://instagram.com/pedalcodearmy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-300 underline hover:text-[#FFD700]"
              >
                Instagram DMs
                <span className="sr-only"> (opens in a new tab)</span>
              </a>{" "}
              or{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-orange-300 underline hover:text-[#FFD700]"
              >
                shoot us an email
              </a>
            </p>
            <p className="text-sm font-bold text-white">
              Or call us:{" "}
              <a
                href="tel:+15103897975"
                className="text-orange-300 underline hover:text-[#FFD700]"
              >
                (510) 389-7975
              </a>
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
                <strong>USE AT YOUR OWN RISK:</strong> All 3D printed parts sold
                by Pedal Code Army are provided &quot;as is&quot; without any
                warranty, express or implied. These parts are not safety tested,
                certified, or approved by any regulatory agency.
              </p>
              <p>
                <strong>ASSUMPTION OF RISK:</strong> By purchasing and
                installing these parts, you acknowledge and accept full
                responsibility for any and all risks associated with their use,
                including but not limited to personal injury, death, property
                damage, or mechanical failure.
              </p>
              <p>
                <strong>NOT FOR STREET USE:</strong> These parts are intended
                for off-road, display, or novelty purposes only. Use on public
                roads is at your own risk and may not comply with local vehicle
                safety regulations.
              </p>
              <p>
                <strong>PROFESSIONAL INSTALLATION RECOMMENDED:</strong> We
                strongly recommend having all parts inspected and installed by a
                qualified mechanic. Improper installation may result in part
                failure, accidents, or injury.
              </p>
              <p>
                <strong>NO LIABILITY:</strong> Pedal Code Army, its owners,
                employees, and affiliates shall not be held liable for any
                damages, injuries, or losses resulting from the use, misuse, or
                failure of any products sold. This includes direct, indirect,
                incidental, punitive, and consequential damages.
              </p>
              <p>
                <strong>WARRANTY DISCLAIMER:</strong> Installing aftermarket
                parts may void your vehicle&apos;s manufacturer warranty. Pedal
                Code Army is not responsible for any warranty claims denied as a
                result of using our products.
              </p>
              <p className="pt-2 text-center text-xs font-bold uppercase tracking-wide text-red-700">
                By completing a purchase, you agree to these terms and
                conditions.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
