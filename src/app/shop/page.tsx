import Shop from "@/components/shop";
import { fetchStorefrontProducts, type StorefrontProduct } from "@/lib/shopify";
import { type Metadata } from "next";

export const revalidate = 60;

const SITE_URL = "https://pedalcodearmy.com";
const SHOP_URL = `${SITE_URL}/shop`;
const OG_IMAGE = {
  url: "/images/products/SideCoverRight.png",
  width: 2446,
  height: 1206,
  alt: "Puch Magnum 3D Printed Side Cover",
};

export const metadata: Metadata = {
  // The root layout's title template appends "| Pedal Code Army".
  title: "3D Printed Moped Parts — Speed Shop",
  description:
    "Shop 3D printed replacement parts for vintage mopeds. Honda Hobbit fork spacers, chain tensioners, Puch Magnum side covers, and custom parts. Free shipping over $99.",
  keywords: [
    "3D printed moped parts",
    "Honda Hobbit parts",
    "Puch Magnum side covers",
    "vintage moped parts",
    "moped fork spacers",
    "moped chain tensioner",
    "custom moped parts",
    "Derbi Variant parts",
    "Piaggio Ciao parts",
    "moped replacement parts",
  ],
  openGraph: {
    title: "3D Printed Moped Parts | Pedal Code Army Speed Shop",
    description:
      "Custom 3D printed replacement parts for vintage mopeds. Honda Hobbit, Puch Magnum, Derbi Variant, and more. Free shipping over $99.",
    url: SHOP_URL,
    siteName: "Pedal Code Army",
    type: "website",
    locale: "en_US",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "3D Printed Moped Parts | Pedal Code Army",
    description:
      "Custom 3D printed parts for vintage mopeds. Honda Hobbit, Puch Magnum, and more.",
    images: [OG_IMAGE.url],
  },
  alternates: {
    canonical: SHOP_URL,
  },
  robots: {
    index: true,
    follow: true,
  },
};

const ORGANIZATION_ID = `${SITE_URL}/#organization`;

type JsonLdNode = Record<string, unknown>;

const SIDE_COVERS_PRODUCT: JsonLdNode = {
  "@type": "Product",
  name: "Puch Magnum Side Covers",
  description:
    "3D printed side covers for Puch Magnum mopeds. Available plain or with custom embossed text. Durable PETG material.",
  image: `${SITE_URL}/images/products/SideCoverRight.png`,
  url: `${SITE_URL}/shop/side-covers`,
  brand: { "@type": "Brand", name: "Pedal Code Army" },
  offers: {
    "@type": "AggregateOffer",
    lowPrice: "50",
    highPrice: "60",
    priceCurrency: "USD",
    availability: "https://schema.org/PreOrder",
    seller: { "@id": ORGANIZATION_ID },
  },
};

// Used only when live Shopify products can't be loaded.
const FALLBACK_PRODUCTS: JsonLdNode[] = [
  {
    "@type": "Product",
    name: "Honda Hobbit Fork Spacers",
    description:
      "3D printed fork spacers that increase the rake/trail of Honda Hobbit forks for improved stability. Includes 2 spacers, bolts, and washers.",
    image: `${SITE_URL}/images/products/forkSpacers.JPG`,
    url: `${SHOP_URL}#fork-spacers`,
    brand: { "@type": "Brand", name: "Pedal Code Army" },
    offers: {
      "@type": "Offer",
      price: "25",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: `${SHOP_URL}#fork-spacers`,
      seller: { "@id": ORGANIZATION_ID },
    },
  },
  {
    "@type": "Product",
    name: "Honda Hobbit Chain Tensioner",
    description:
      "3D printed replacement chain tensioner for Honda Hobbit mopeds. Keeps your pedal chain tight and pedals spinning smooth.",
    image: `${SITE_URL}/images/products/chainTensioner.JPG`,
    url: `${SHOP_URL}#chain-tensioner`,
    brand: { "@type": "Brand", name: "Pedal Code Army" },
    offers: {
      "@type": "Offer",
      price: "20",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: `${SHOP_URL}#chain-tensioner`,
      seller: { "@id": ORGANIZATION_ID },
    },
  },
  {
    "@type": "Product",
    name: "Honda PA50 4.5\" Headlight Bracket",
    description:
      "Mount a 4.5 inch Euro-style headlight on your Honda PA50, with an integrated mount for a Trail Tech temp gauge. 3D printed from PAHT-CF for stiffness and heat resistance.",
    image: `${SITE_URL}/images/products/headlightBracketPA50.jpg`,
    url: `${SHOP_URL}#headlight-bracket-pa50`,
    brand: { "@type": "Brand", name: "Pedal Code Army" },
    offers: {
      "@type": "Offer",
      price: "20",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: `${SHOP_URL}#headlight-bracket-pa50`,
      seller: { "@id": ORGANIZATION_ID },
    },
  },
];

function firstProductImage(product: StorefrontProduct): string | undefined {
  for (const item of product.media) {
    if (item.mediaContentType === "IMAGE" && item.image?.url) {
      return item.image.url;
    }
  }
  for (const item of product.media) {
    if (
      (item.mediaContentType === "MODEL_3D" || item.mediaContentType === "VIDEO") &&
      item.previewImage?.url
    ) {
      return item.previewImage.url;
    }
  }
  return undefined;
}

function storefrontProductToJsonLd(product: StorefrontProduct): JsonLdNode | null {
  if (product.variants.length === 0) return null;

  const url = `${SHOP_URL}#${encodeURIComponent(product.handle)}`;
  const offers = product.variants.map((variant) => ({
    "@type": "Offer",
    ...(product.variants.length > 1 ? { name: variant.title } : {}),
    ...(variant.sku ? { sku: variant.sku } : {}),
    price: variant.price.amount,
    priceCurrency: variant.price.currencyCode,
    availability:
      product.availableForSale && variant.availableForSale
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    url,
    seller: { "@id": ORGANIZATION_ID },
  }));

  const image = firstProductImage(product);
  return {
    "@type": "Product",
    name: product.title,
    description: product.description || undefined,
    ...(image ? { image } : {}),
    url,
    brand: { "@type": "Brand", name: "Pedal Code Army" },
    offers: offers.length === 1 ? offers[0] : offers,
  };
}

function buildJsonLd(products: StorefrontProduct[]) {
  const liveProducts = products
    .map(storefrontProductToJsonLd)
    .filter((node): node is JsonLdNode => node !== null);

  const hasLiveSideCovers = products.some((product) => {
    const text = `${product.handle} ${product.title}`.toLowerCase();
    return text.includes("magnum") && text.includes("side") && text.includes("cover");
  });

  const productNodes =
    liveProducts.length > 0
      ? [...liveProducts, ...(hasLiveSideCovers ? [] : [SIDE_COVERS_PRODUCT])]
      : [SIDE_COVERS_PRODUCT, ...FALLBACK_PRODUCTS];

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: "Pedal Code Army",
        url: SITE_URL,
        logo: `${SITE_URL}/images/pedalcode.jpeg`,
        sameAs: [
          "https://instagram.com/pedalcodearmy",
          "https://tiktok.com/@pedal.code",
        ],
        contactPoint: {
          "@type": "ContactPoint",
          email: "pedalcodearmy@gmail.com",
          contactType: "customer service",
        },
      },
      {
        "@type": "WebPage",
        "@id": `${SHOP_URL}/#webpage`,
        url: SHOP_URL,
        name: "3D Printed Moped Parts | Pedal Code Army Speed Shop",
        description:
          "Shop 3D printed replacement parts for vintage mopeds including Honda Hobbit, Puch Magnum, Derbi Variant, and Piaggio Ciao.",
        about: { "@id": ORGANIZATION_ID },
      },
      ...productNodes,
    ],
  };
}

/** Serialize JSON-LD safely for inline <script> (prevents `</script>` breakouts). */
function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default async function ShopPage() {
  let shopifyProducts: StorefrontProduct[] = [];
  let initialLoadFailed = false;
  try {
    shopifyProducts = await fetchStorefrontProducts({ throwOnError: true });
  } catch (error) {
    console.error("Failed to fetch Shopify products for /shop:", error);
    initialLoadFailed = true;
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildJsonLd(shopifyProducts)) }}
      />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#FFD700] to-[#15162c] text-white focus:outline-none"
      >
        <Shop
          initialShopifyProducts={shopifyProducts}
          initialLoadFailed={initialLoadFailed}
        />
      </main>
    </>
  );
}
