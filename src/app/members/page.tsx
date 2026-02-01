import MemberShowcase from "@/components/member-showcase";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Meet the Crew | Pedal Code Army Members",
  description:
    "Meet the members of Pedal Code Army and their vintage moped collections. From Puch Magnums to Tomos Targas, see the machines and the riders who keep the two-stroke dream alive.",
  keywords: [
    "moped enthusiasts",
    "moped collectors",
    "vintage moped community",
    "Puch Magnum",
    "Tomos Targa",
    "moped riders",
  ],
  openGraph: {
    title: "Meet the Crew | Pedal Code Army Members",
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
    title: "Meet the Crew | Pedal Code Army Members",
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

export default function MembersPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#FFD700] to-[#15162c] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MemberShowcase />
    </main>
  );
}
