import { type Metadata } from "next";
import { SimulatorRoot } from "@/components/simulator/simulator-root";

export const metadata: Metadata = {
  title: "Ran When Parked - Moped Simulator",
  description:
    "Ride until it breaks, diagnose real 2-stroke moped symptoms, read spark plugs, jet carbs in the garage, score Craigslist finds, and conquer East Bay routes.",
  openGraph: {
    title: "Ran When Parked - Moped Simulator",
    description:
      "Pedal Code Army's 2-stroke moped simulator. Diagnose real mechanical faults, wrench in the garage, and blast through the East Bay.",
  },
};

export default function RanWhenParkedPage() {
  return (
    <main id="main-content">
      <SimulatorRoot />
    </main>
  );
}
