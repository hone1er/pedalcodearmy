import { type Metadata } from "next";
import { GameContainer } from "@/components/game/game-container";

export const metadata: Metadata = {
  title: "East Bay Runner - Arcade Moped Game",
  description:
    "Endless 3D arcade moped game. Dodge Oakland traffic, pop wheelies, chain x4 combos, collect parts, and climb the global leaderboard.",
  openGraph: {
    title: "East Bay Runner - Arcade Moped Game",
    description:
      "Dodge Oakland traffic, pop wheelies, chain combos, and hit the shops. How far can you ride?",
  },
};

export default function EastBayRunnerPage() {
  return (
    <main id="main-content">
      <GameContainer />
    </main>
  );
}
