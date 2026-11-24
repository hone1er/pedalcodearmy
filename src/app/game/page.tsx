import { type Metadata } from "next";
import { SimulatorRoot } from "@/components/simulator/simulator-root";

export const metadata: Metadata = {
  title: "Ran When Parked - Moped Simulator & Street Runner",
  description:
    "Diagnose real 2-stroke moped symptoms, tune carbs & wrench in the garage, shakedown on East Bay routes, and dodge Oakland traffic in endless Street Runner mode.",
  openGraph: {
    title: "Ran When Parked | Pedal Code Army",
    description:
      "Wrench on finicky 2-strokes, dial in your jetting on East Bay tuning rides, then take your build into endless Oakland Street Runner mode.",
  },
};

export default function GamePage() {
  return (
    <main id="main-content">
      <SimulatorRoot />
    </main>
  );
}
