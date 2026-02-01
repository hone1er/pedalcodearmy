import Shop from "@/components/shop";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "3D Printed Moped Parts | Pedal Code Army Speed Shop",
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
    url: "https://pedalcodearmy.com/shop",
    siteName: "Pedal Code Army",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/images/products/SideCoverRight.png",
        width: 800,
        height: 800,
        alt: "Puch Magnum 3D Printed Side Cover",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "3D Printed Moped Parts | Pedal Code Army",
    description:
      "Custom 3D printed parts for vintage mopeds. Honda Hobbit, Puch Magnum, and more.",
    images: ["/images/products/SideCoverRight.png"],
  },
  alternates: {
    canonical: "https://pedalcodearmy.com/shop",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://pedalcodearmy.com/#organization",
      name: "Pedal Code Army",
      url: "https://pedalcodearmy.com",
      logo: "https://pedalcodearmy.com/images/pedalcode.jpeg",
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
      "@id": "https://pedalcodearmy.com/shop/#webpage",
      url: "https://pedalcodearmy.com/shop",
      name: "3D Printed Moped Parts | Pedal Code Army Speed Shop",
      description:
        "Shop 3D printed replacement parts for vintage mopeds including Honda Hobbit, Puch Magnum, Derbi Variant, and Piaggio Ciao.",
      isPartOf: { "@id": "https://pedalcodearmy.com/#website" },
      about: { "@id": "https://pedalcodearmy.com/#organization" },
    },
    {
      "@type": "Product",
      name: "Puch Magnum Side Covers",
      description:
        "3D printed side covers for Puch Magnum mopeds. Available plain or with custom embossed text. Durable PETG material.",
      image: "https://pedalcodearmy.com/images/products/SideCoverRight.png",
      brand: { "@type": "Brand", name: "Pedal Code Army" },
      offers: {
        "@type": "AggregateOffer",
        lowPrice: "50",
        highPrice: "60",
        priceCurrency: "USD",
        availability: "https://schema.org/PreOrder",
        seller: { "@id": "https://pedalcodearmy.com/#organization" },
      },
    },
    {
      "@type": "Product",
      name: "Honda Hobbit Fork Spacers",
      description:
        "3D printed fork spacers that increase the rake/trail of Honda Hobbit forks for improved stability. Includes 2 spacers, bolts, and washers.",
      image: "https://pedalcodearmy.com/images/products/forkSpacers.JPG",
      brand: { "@type": "Brand", name: "Pedal Code Army" },
      offers: {
        "@type": "Offer",
        price: "25",
        priceCurrency: "USD",
        availability: "https://schema.org/PreOrder",
        seller: { "@id": "https://pedalcodearmy.com/#organization" },
      },
    },
    {
      "@type": "Product",
      name: "Honda Hobbit Chain Tensioner",
      description:
        "3D printed replacement chain tensioner for Honda Hobbit mopeds. Keeps your pedal chain tight and pedals spinning smooth.",
      image: "https://pedalcodearmy.com/images/products/chainTensioner.JPG",
      brand: { "@type": "Brand", name: "Pedal Code Army" },
      offers: {
        "@type": "Offer",
        price: "20",
        priceCurrency: "USD",
        availability: "https://schema.org/PreOrder",
        seller: { "@id": "https://pedalcodearmy.com/#organization" },
      },
    },
  ],
};

export default function ShopPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#FFD700] to-[#15162c] text-white">
        <Shop />
      </main>
    </>
  );
}
