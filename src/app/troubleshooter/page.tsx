import type { Metadata } from "next";
import Troubleshooter from "@/components/troubleshooter";

export const metadata: Metadata = {
  title: "Troubleshooter",
  description:
    "Step-by-step moped diagnostic tool for Pedal Code Army riders. Troubleshoot no-start, high-RPM bogging, clutch/variator issues, and fluid leaks.",
  keywords: [
    "moped troubleshooter",
    "moped won't start",
    "2-stroke moped repair",
    "moped bogging high rpm",
    "moped clutch slipping",
    "Puch Hobbit troubleshooting",
  ],
  openGraph: {
    title: "Troubleshooter | Pedal Code Army",
    description:
      "Interactive two-stroke moped diagnostic guide for no-starts, bogging, transmission trouble, and leaks.",
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

export default function TroubleshooterPage() {
  return (
    <main
      id="main-content"
      className="min-h-screen bg-gradient-to-b from-[#FFD700] to-[#15162c] text-black"
    >
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-black py-16 text-[#FFD700]">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-black uppercase tracking-tight md:text-6xl">
            Moped Troubleshooter
          </h1>
          <RetroStripe />
          <p className="mx-auto mt-4 max-w-2xl text-xl text-white/80">
            Stranded on the curb or wrenching in the garage? Answer a few quick
            questions to track down what&apos;s keeping your two-stroke off the
            road.
          </p>
        </div>

        <div className="absolute -left-20 top-0 h-40 w-40 rotate-45 bg-orange-500/10" />
        <div className="absolute -right-20 bottom-0 h-40 w-40 rotate-45 bg-[#FFD700]/10" />
      </section>

      {/* Diagnostic Flow */}
      <section className="py-8">
        <Troubleshooter />
      </section>
    </main>
  );
}
