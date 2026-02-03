import type { Metadata } from "next";
import BuildCalculator from "@/components/build-calculator";

export const metadata: Metadata = {
  title: "Build Calculator",
  description:
    "Plan your moped build with our interactive cost calculator. Get recommended parts lists for Puch, Honda, Derbi, and Tomos builds - from stock tune-ups to full kitted setups.",
  keywords: [
    "moped build calculator",
    "moped parts list",
    "Puch Maxi build",
    "Honda Hobbit kit",
    "moped performance parts",
    "moped upgrade guide",
    "2-stroke moped build",
    "moped speed upgrades",
    "Treatland parts",
    "moped exhaust",
    "moped carburetor",
  ],
  openGraph: {
    title: "Build Calculator | Pedal Code Army",
    description:
      "Plan your moped build with recommended parts lists and cost estimates for every performance tier.",
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

export default function BuildCalculatorPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#FFD700] to-[#15162c]">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-black py-16 text-[#FFD700]">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-black uppercase tracking-tight md:text-6xl">
            Build Calculator
          </h1>
          <RetroStripe />
          <p className="mx-auto mt-4 max-w-2xl text-xl text-white/80">
            Planning your next build? Select your moped and performance tier to
            get a recommended parts list with cost estimates.
          </p>
        </div>

        {/* Decorative elements */}
        <div className="absolute -left-10 top-10 text-6xl opacity-20">💨</div>
        <div className="absolute -right-10 bottom-10 text-6xl opacity-20">
          🏎️
        </div>
      </section>

      {/* Calculator Section */}
      <section className="py-8">
        <BuildCalculator />
      </section>

      {/* Info Section */}
      <section className="bg-black py-16 text-[#FFD700]">
        <div className="container mx-auto px-4">
          <h2 className="mb-8 text-center text-3xl font-black uppercase">
            Build Wisdom
          </h2>
          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
            <div className="rounded-none border-4 border-[#FFD700] bg-black p-6 text-center">
              <div className="mb-4 text-4xl">🔧</div>
              <h3 className="mb-2 font-black uppercase">Start Stock</h3>
              <p className="text-sm text-white/70">
                Always dial in your stock setup before adding performance parts.
                A clean carb beats a dirty kit every time.
              </p>
            </div>
            <div className="rounded-none border-4 border-[#FFD700] bg-black p-6 text-center">
              <div className="mb-4 text-4xl">⚙️</div>
              <h3 className="mb-2 font-black uppercase">Match Your Parts</h3>
              <p className="text-sm text-white/70">
                Pipe needs bigger jets. Kit needs bigger carb. Everything works
                together - plan your full setup, not just one part.
              </p>
            </div>
            <div className="rounded-none border-4 border-[#FFD700] bg-black p-6 text-center">
              <div className="mb-4 text-4xl">🛑</div>
              <h3 className="mb-2 font-black uppercase">Brakes First</h3>
              <p className="text-sm text-white/70">
                Going fast is fun. Stopping is mandatory. Upgrade your brakes
                before you upgrade your speed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Resources Section */}
      <section className="bg-[#15162c] py-16 text-center text-white">
        <div className="container mx-auto px-4">
          <h2 className="mb-4 text-3xl font-black uppercase text-[#FFD700]">
            Trusted Vendors
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-white/70">
            These are the shops we trust for quality moped parts. Support the
            community - buy from moped specialists.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="https://www.treatland.tv"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-none border-4 border-[#FFD700] bg-[#FFD700] px-8 py-3 font-black uppercase text-black transition-all hover:bg-transparent hover:text-[#FFD700]"
            >
              Treatland
            </a>
            <a
              href="https://www.1977mopeds.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-none border-4 border-white bg-transparent px-8 py-3 font-black uppercase text-white transition-all hover:bg-white hover:text-black"
            >
              1977 Mopeds
            </a>
            <a
              href="https://www.myronsmopeds.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-none border-4 border-white bg-transparent px-8 py-3 font-black uppercase text-white transition-all hover:bg-white hover:text-black"
            >
              Myron&apos;s Mopeds
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
