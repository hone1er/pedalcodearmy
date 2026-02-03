import type { Metadata } from "next";
import FleetGallery from "@/components/fleet-gallery";

export const metadata: Metadata = {
  title: "The Stable",
  description:
    "Browse the complete Pedal Code Army fleet - 27+ mopeds across all members. Filter by make, owner, and explore detailed build specs. Puch, Honda, Derbi, Tomos, and more.",
  keywords: [
    "moped collection",
    "moped gallery",
    "Puch Maxi",
    "Puch Magnum",
    "Honda Hobbit",
    "Derbi Variant",
    "moped builds",
    "moped specs",
    "East Bay mopeds",
  ],
  openGraph: {
    title: "The Stable | Pedal Code Army",
    description:
      "Browse the complete Pedal Code Army fleet - 27+ mopeds with detailed build specs.",
    type: "website",
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

export default function StablePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#FFD700] to-[#15162c]">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-black py-16 text-[#FFD700]">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-black uppercase tracking-tight md:text-6xl">
            The Stable
          </h1>
          <RetroStripe />
          <p className="mx-auto mt-4 max-w-2xl text-xl text-white/80">
            Every moped in the Pedal Code Army fleet. Browse builds, compare
            specs, and get inspired for your next project.
          </p>
        </div>

        {/* Decorative elements */}
        <div className="absolute -left-20 top-0 h-40 w-40 rotate-45 bg-orange-500/10" />
        <div className="absolute -right-20 bottom-0 h-40 w-40 rotate-45 bg-[#FFD700]/10" />
      </section>

      {/* Gallery Section */}
      <section className="py-8">
        <FleetGallery />
      </section>

      {/* CTA Section */}
      <section className="bg-black py-16 text-center text-[#FFD700]">
        <div className="container mx-auto px-4">
          <h2 className="mb-4 text-3xl font-black uppercase">
            Got a Moped to Add?
          </h2>
          <p className="mb-8 text-white/70">
            Want to see your moped in The Stable? Hit us up on Instagram!
          </p>
          <a
            href="https://www.instagram.com/pedalcodearmy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-none border-4 border-[#FFD700] bg-[#FFD700] px-8 py-3 font-black uppercase text-black transition-all hover:bg-transparent hover:text-[#FFD700]"
          >
            @pedalcodearmy
          </a>
        </div>
      </section>
    </main>
  );
}
