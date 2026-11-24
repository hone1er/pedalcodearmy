import MemberShowcase from "@/components/member-showcase";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "The Dudes",
  description:
    "Meet the members of Pedal Code Army and their vintage moped collections. From Puch Magnums to Honda Hobbits, see the machines and the riders who keep the two-stroke dream alive.",
  keywords: [
    "moped enthusiasts",
    "moped collectors",
    "vintage moped community",
    "Puch Magnum",
    "Honda Hobbit",
    "moped riders",
  ],
  openGraph: {
    title: "The Dudes | Pedal Code Army",
    description:
      "Meet the members of Pedal Code Army and their vintage moped collections.",
    url: "https://pedalcodearmy.com/members",
    siteName: "Pedal Code Army",
    images: [
      {
        url: "/images/pedalcode.jpeg",
        width: 1200,
        height: 630,
        alt: "Pedal Code Army members",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Dudes | Pedal Code Army",
    description:
      "Meet the members of Pedal Code Army and their vintage moped collections.",
    images: ["/images/pedalcode.jpeg"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Pedal Code Army",
  url: "https://pedalcodearmy.com",
  member: {
    "@type": "OrganizationRole",
    roleName: "Member",
  },
};

function RetroStripe() {
  return (
    <div className="flex items-center justify-center gap-1 py-2">
      <div className="h-2 w-16 bg-orange-500" />
      <div className="h-2 w-8 bg-black" />
      <div className="h-2 w-16 bg-[#FFD700]" />
      <div className="h-2 w-8 bg-black" />
      <div className="h-2 w-16 bg-orange-500" />
    </div>
  );
}

export default function MembersPage() {
  return (
    <main
      id="main-content"
      className="min-h-screen bg-gradient-to-b from-[#FFD700] to-[#15162c] text-black"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-black py-16 text-[#FFD700]">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-black uppercase tracking-tight md:text-6xl">
            Meet the Pedal Code Army
          </h1>
          <RetroStripe />
          <p className="mx-auto mt-4 max-w-2xl text-xl text-white/80">
            The riders, wrenchers, and builders behind the two-stroke madness
            — from the East Bay to our European Division.
          </p>
        </div>

        <div className="absolute -left-20 top-0 h-40 w-40 rotate-45 bg-orange-500/10" />
        <div className="absolute -right-20 bottom-0 h-40 w-40 rotate-45 bg-[#FFD700]/10" />
      </section>

      <MemberShowcase />
    </main>
  );
}
