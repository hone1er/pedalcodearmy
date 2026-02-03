import type { Metadata } from "next";
import Troubleshooter from "@/components/troubleshooter";

export const metadata: Metadata = {
  title: "Wrench Roulette",
  description:
    "Interactive moped troubleshooting guide. Diagnose common problems: won't start, bogs at high RPM, transmission issues, leaks. Get step-by-step fixes and parts recommendations.",
  keywords: [
    "moped troubleshooting",
    "moped won't start",
    "moped repair guide",
    "2-stroke troubleshooting",
    "moped no spark",
    "moped fuel problems",
    "moped transmission",
    "moped diagnosis",
    "DIY moped repair",
  ],
  openGraph: {
    title: "Wrench Roulette | Pedal Code Army",
    description:
      "Interactive moped troubleshooting guide. Diagnose problems and get step-by-step fixes.",
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

export default function WrenchRoulettePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#FFD700] to-[#15162c]">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-black py-16 text-[#FFD700]">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-black uppercase tracking-tight md:text-6xl">
            Wrench Roulette
          </h1>
          <RetroStripe />
          <p className="mx-auto mt-4 max-w-2xl text-xl text-white/80">
            Moped acting up? Spin the wheel and let&apos;s figure out
            what&apos;s wrong. Click through the symptoms and we&apos;ll help
            you diagnose the problem.
          </p>
        </div>

        {/* Decorative wrench emoji */}
        <div className="absolute -left-10 top-10 text-6xl opacity-20">🔧</div>
        <div className="absolute -right-10 bottom-10 text-6xl opacity-20">
          🛠️
        </div>
      </section>

      {/* Troubleshooter Section */}
      <section className="py-8">
        <Troubleshooter />
      </section>

      {/* Help Section */}
      <section className="bg-black py-16 text-center text-[#FFD700]">
        <div className="container mx-auto px-4">
          <h2 className="mb-4 text-3xl font-black uppercase">Still Stuck?</h2>
          <p className="mx-auto mb-8 max-w-xl text-white/70">
            Some problems need hands-on help. Join the Moped Army forums or hit
            us up directly - we love talking about broken mopeds.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="https://www.mopedarmy.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-none border-4 border-[#FFD700] bg-transparent px-8 py-3 font-black uppercase text-[#FFD700] transition-all hover:bg-[#FFD700] hover:text-black"
            >
              Moped Army Forums
            </a>
            <a
              href="https://www.instagram.com/pedalcodearmy"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-none border-4 border-[#FFD700] bg-[#FFD700] px-8 py-3 font-black uppercase text-black transition-all hover:bg-transparent hover:text-[#FFD700]"
            >
              DM Us on Instagram
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
