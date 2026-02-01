import PedalCodeArmyLanding from "@/components/pedal-code-army-landing-v2";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Pedal Code Army | East Bay Moped Gang & 3D Printed Parts",
  description:
    "Join the East Bay's premier moped gang! Weekly rides, vintage moped repairs, and custom 3D printed parts. Ride together, wrench together, and embrace the two-stroke madness.",
  keywords: [
    "East Bay moped gang",
    "moped community",
    "vintage mopeds",
    "moped rides Oakland",
    "3D printed moped parts",
    "moped repairs",
    "two-stroke mopeds",
  ],
  openGraph: {
    title: "Pedal Code Army | East Bay Moped Gang & 3D Printed Parts",
    description:
      "Join the East Bay's premier moped gang! Weekly rides, vintage moped repairs, and custom 3D printed parts.",
    url: "https://pedalcodearmy.com",
    siteName: "Pedal Code Army",
    images: [
      {
        url: "/images/mili-magnum-grizzly.JPG",
        width: 1200,
        height: 630,
        alt: "Pedal Code Army moped gang",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pedal Code Army | East Bay Moped Gang & 3D Printed Parts",
    description:
      "Join the East Bay's premier moped gang! Weekly rides, vintage moped repairs, and custom 3D printed parts.",
    images: ["/images/mili-magnum-grizzly.JPG"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Pedal Code Army",
  description:
    "East Bay moped gang dedicated to weekly rides, vintage moped repairs, and custom 3D printed parts.",
  url: "https://pedalcodearmy.com",
  logo: "https://pedalcodearmy.com/images/pedalcode.jpeg",
  areaServed: {
    "@type": "Place",
    name: "East Bay, California",
  },
  foundingLocation: {
    "@type": "Place",
    name: "Oakland, California",
  },
};

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#FFD700] to-[#15162c] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PedalCodeArmyLanding />
    </main>
  );
}
