import { type Metadata } from "next";
import { ArcadeHub } from "@/components/arcade/arcade-hub";

export const metadata: Metadata = {
  title: "Arcade - Pedal Code Army",
  description:
    "Play Pedal Code Army's East Bay moped games: Ran When Parked 2-stroke moped simulator and East Bay Runner 3D endless arcade.",
  openGraph: {
    title: "Pedal Code Army Arcade",
    description:
      "Two East Bay moped games: diagnose & wrench in Ran When Parked, or dodge Oakland traffic in East Bay Runner.",
  },
};

export default function GameArcadePage() {
  return (
    <main id="main-content">
      <ArcadeHub />
    </main>
  );
}
