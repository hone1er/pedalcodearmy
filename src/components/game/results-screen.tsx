"use client";

import { useState } from "react";
import type { GameResult, CollectibleType } from "@/lib/game/types";
import { PIXELS_PER_METER } from "@/lib/game/types";

interface ResultsScreenProps {
  result: GameResult;
  onPlayAgain: () => void;
  onChangeMoped: () => void;
  onViewLeaderboard: () => void;
}

const PART_LABELS: Record<CollectibleType, string> = {
  "spark-plug": "Spark Plugs",
  jet: "Jets",
  pipe: "Pipes",
  cylinder: "Cylinders",
};

const SHOP_COLORS: Record<string, { bg: string; text: string }> = {
  treatland: { bg: "bg-green-500/20", text: "text-green-400" },
  "1977-mopeds": { bg: "bg-blue-500/20", text: "text-blue-400" },
  "myrons-mopeds": { bg: "bg-orange-500/20", text: "text-orange-400" },
};

const SHOP_NAMES: Record<string, string> = {
  treatland: "Treatland",
  "1977-mopeds": "1977 Mopeds",
  "myrons-mopeds": "Myron's Mopeds",
};

export function ResultsScreen({
  result,
  onPlayAgain,
  onChangeMoped,
  onViewLeaderboard,
}: ResultsScreenProps) {
  const [playerName, setPlayerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [rank, setRank] = useState<number | null>(null);

  const isGoodRun = result.score > 500;

  const handleSubmit = async () => {
    if (!playerName.trim() || submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/game/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerName: playerName.trim(),
          mopedMake: result.mopedMake,
          score: result.score,
          distance: result.distance,
          partsCollected: result.totalParts,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { rank?: number };
        setRank(data.rank ?? null);
        setSubmitted(true);
      }
    } catch {
      // Silently fail
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 px-4 md:gap-6">
      <h2
        className="text-3xl text-[#FFD700] md:text-4xl"
        style={{ fontFamily: "Bangers, cursive" }}
      >
        {isGoodRun ? "NICE RUN!" : "GAME OVER"}
      </h2>

      {/* Score box */}
      <div className="rounded-lg border-4 border-[#FFD700] bg-black/90 px-6 py-4 text-center">
        <div className="text-xs uppercase tracking-wider text-gray-400">
          Score
        </div>
        <div
          className="text-4xl text-[#FFD700] md:text-5xl"
          style={{ fontFamily: "Orbitron, monospace" }}
        >
          {result.score.toLocaleString()}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid w-full max-w-md grid-cols-2 gap-3">
        <div className="rounded border-2 border-gray-700 bg-black/80 p-3 text-center">
          <div className="text-[10px] uppercase text-gray-500">Distance</div>
          <div
            className="text-lg text-white"
            style={{ fontFamily: "Orbitron, monospace" }}
          >
            {result.distance}m
          </div>
        </div>
        <div className="rounded border-2 border-gray-700 bg-black/80 p-3 text-center">
          <div className="text-[10px] uppercase text-gray-500">Top Speed</div>
          <div
            className="text-lg text-white"
            style={{ fontFamily: "Orbitron, monospace" }}
          >
            {Math.round(result.topSpeed / PIXELS_PER_METER)}
          </div>
        </div>
        <div className="rounded border-2 border-gray-700 bg-black/80 p-3 text-center">
          <div className="text-[10px] uppercase text-gray-500">Parts</div>
          <div
            className="text-lg text-white"
            style={{ fontFamily: "Orbitron, monospace" }}
          >
            {result.totalParts}
          </div>
        </div>
        <div className="rounded border-2 border-gray-700 bg-black/80 p-3 text-center">
          <div className="text-[10px] uppercase text-gray-500">Shops</div>
          <div
            className="text-lg text-white"
            style={{ fontFamily: "Orbitron, monospace" }}
          >
            {result.shopsVisited.length}/3
          </div>
        </div>
      </div>

      {/* Parts breakdown */}
      <div className="w-full max-w-md">
        <div className="mb-2 text-center text-xs uppercase tracking-wider text-gray-400">
          Parts Collected
        </div>
        <div className="flex justify-center gap-3">
          {(Object.keys(PART_LABELS) as CollectibleType[]).map((type) => (
            <div
              key={type}
              className="rounded border-2 border-gray-700 bg-black/80 px-3 py-2 text-center"
            >
              <div className="text-[10px] text-gray-500">{PART_LABELS[type]}</div>
              <div className="text-sm font-bold text-[#FFD700]">
                {result.partsCollected[type]}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Shops visited */}
      {result.shopsVisited.length > 0 && (
        <div className="flex justify-center gap-2">
          {result.shopsVisited.map((shop) => {
            const colors = SHOP_COLORS[shop] ?? {
              bg: "bg-gray-500/20",
              text: "text-gray-400",
            };
            return (
              <span
                key={shop}
                className={`rounded-full ${colors.bg} px-3 py-1 text-xs font-bold ${colors.text}`}
              >
                {SHOP_NAMES[shop] ?? shop}
              </span>
            );
          })}
        </div>
      )}

      {/* Score submission */}
      {!submitted ? (
        <div className="w-full max-w-md">
          <div className="flex gap-2">
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value.slice(0, 30))}
              placeholder="Enter your name..."
              maxLength={30}
              className="flex-1 rounded border-2 border-gray-700 bg-black/80 px-3 py-2 text-white placeholder-gray-600 focus:border-[#FFD700] focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSubmit();
              }}
            />
            <button
              onClick={() => void handleSubmit()}
              disabled={!playerName.trim() || submitting}
              className="rounded border-2 border-[#FFD700] bg-[#FFD700] px-4 py-2 font-bold text-black transition-colors hover:bg-yellow-400 disabled:opacity-50"
            >
              {submitting ? "..." : "Submit"}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-green-400">Score submitted!</p>
          {rank && (
            <p className="text-lg text-[#FFD700]">Rank #{rank}</p>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={onPlayAgain}
          className="rounded border-2 border-[#FFD700] bg-[#FFD700] px-5 py-2.5 font-bold text-black transition-colors hover:bg-yellow-400"
          style={{ fontFamily: "Russo One, sans-serif" }}
        >
          Play Again
        </button>
        <button
          onClick={onChangeMoped}
          className="rounded border-2 border-gray-600 bg-black px-5 py-2.5 font-bold text-white transition-colors hover:border-[#FFD700] hover:text-[#FFD700]"
          style={{ fontFamily: "Russo One, sans-serif" }}
        >
          Change Moped
        </button>
        <button
          onClick={onViewLeaderboard}
          className="rounded border-2 border-gray-600 bg-black px-5 py-2.5 font-bold text-white transition-colors hover:border-[#FFD700] hover:text-[#FFD700]"
          style={{ fontFamily: "Russo One, sans-serif" }}
        >
          Leaderboard
        </button>
      </div>
    </div>
  );
}
