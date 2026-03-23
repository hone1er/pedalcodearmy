import { type Metadata } from "next";
import { GameContainer } from "@/components/game/game-container";

export const metadata: Metadata = {
  title: "East Bay Runner - City Moped Game",
  description:
    "Endless runner moped game. Dodge traffic, collect parts, hit real moped shops. Ride through the East Bay!",
  openGraph: {
    title: "East Bay Runner - Moped City Game",
    description: "Dodge traffic, collect parts, hit the shops. How far can you ride?",
  },
};

export default function GamePage() {
  return <GameContainer />;
}
