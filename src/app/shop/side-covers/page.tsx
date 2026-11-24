import SideCoverCustomizer from "@/components/side-cover-customizer";
import { type Metadata } from "next";

const PAGE_URL = "https://pedalcodearmy.com/shop/side-covers";
const OG_IMAGE = {
  url: "/images/products/SideCoverRight.png",
  width: 2446,
  height: 1206,
  alt: "Custom Puch Magnum 3D Printed Side Cover",
};

export const metadata: Metadata = {
  // The root layout's title template appends "| Pedal Code Army".
  title: "Custom Puch Magnum Side Covers — 3D Printed",
  description:
    "Design your own custom Puch Magnum side covers with embossed text. 3D printed in durable PETG. Preview your design before ordering. $50 plain, $60 custom.",
  keywords: [
    "Puch Magnum side covers",
    "custom moped side covers",
    "3D printed side covers",
    "Puch moped parts",
    "custom embossed side covers",
    "Puch Magnum replacement parts",
    "vintage moped customization",
  ],
  openGraph: {
    title: "Custom Puch Magnum Side Covers | Pedal Code Army",
    description:
      "Design your own 3D printed Puch Magnum side covers with custom embossed text. Preview your design in real-time before ordering.",
    url: PAGE_URL,
    siteName: "Pedal Code Army",
    type: "website",
    locale: "en_US",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Custom Puch Magnum Side Covers | Pedal Code Army",
    description:
      "Design your own 3D printed side covers with custom embossed text.",
    images: [OG_IMAGE.url],
  },
  alternates: {
    canonical: PAGE_URL,
  },
  robots: {
    index: true,
    follow: true,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Custom Puch Magnum Side Covers",
  description:
    "3D printed side covers for Puch Magnum mopeds with optional custom embossed text. Made from durable PETG material. Preview your design before ordering.",
  image: "https://pedalcodearmy.com/images/products/SideCoverRight.png",
  url: PAGE_URL,
  brand: {
    "@type": "Brand",
    name: "Pedal Code Army",
  },
  manufacturer: {
    "@type": "Organization",
    name: "Pedal Code Army",
    url: "https://pedalcodearmy.com",
  },
  offers: {
    "@type": "AggregateOffer",
    lowPrice: "50",
    highPrice: "60",
    priceCurrency: "USD",
    availability: "https://schema.org/PreOrder",
    seller: {
      "@type": "Organization",
      name: "Pedal Code Army",
    },
  },
  additionalProperty: [
    {
      "@type": "PropertyValue",
      name: "Material",
      value: "PETG",
    },
    {
      "@type": "PropertyValue",
      name: "Customization",
      value: "Custom embossed text available",
    },
  ],
};

export default function SideCoversPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#FFD700] to-[#15162c] text-white focus:outline-none"
      >
        <SideCoverCustomizer />
      </main>
    </>
  );
}
