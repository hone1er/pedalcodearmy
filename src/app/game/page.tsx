import { type Metadata } from "next";
import { Bangers, Orbitron, Russo_One } from "next/font/google";
import { GameContainer } from "@/components/game/game-container";

const bangers = Bangers({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bangers",
});

const orbitron = Orbitron({
  weight: "700",
  subsets: ["latin"],
  variable: "--font-orbitron",
});

const russoOne = Russo_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-russo-one",
});

export const metadata: Metadata = {
  title: "East Bay Runner - City Moped Game",
  description:
    "Endless runner moped game. Dodge traffic, collect parts, hit real moped shops. Ride through the East Bay!",
  openGraph: {
    title: "East Bay Runner - City Moped Game",
    description: "Dodge traffic, collect parts, hit the shops. How far can you ride?",
  },
};

export default function GamePage() {
  return (
    <main
      id="main-content"
      className={`${bangers.variable} ${orbitron.variable} ${russoOne.variable}`}
    >
      <GameContainer />
    </main>
  );
}
