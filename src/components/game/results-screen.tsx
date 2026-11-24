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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rank, setRank] = useState<number | null>(null);

  const isGoodRun = result.score > 500;

  const handleSubmit = async () => {
    if (!playerName.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

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
      } else {
        const errData = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (res.status === 429) {
          setSubmitError(
            errData?.error ?? "Too many submissions. Please wait a moment and retry.",
          );
        } else {
          setSubmitError(
            errData?.error ?? `Failed to submit score (${res.status}).`,
          );
        }
      }
    } catch {
      setSubmitError("Network error while submitting score. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 px-4 md:gap-6">
      <h2
        className="text-3xl text-[#FFD700] md:text-4xl"
        style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
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
          style={{ fontFamily: "var(--font-orbitron), Orbitron, monospace" }}
        >
          {result.score.toLocaleString()}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid w-full max-w-md grid-cols-2 gap-3">
        <div className="rounded border-2 border-gray-700 bg-black/80 p-3 text-center">
          <div className="text-[10px] uppercase text-gray-400">Distance</div>
          <div
            className="text-lg text-white"
            style={{ fontFamily: "var(--font-orbitron), Orbitron, monospace" }}
          >
            {result.distance}m
          </div>
        </div>
        <div className="rounded border-2 border-gray-700 bg-black/80 p-3 text-center">
          <div className="text-[10px] uppercase text-gray-400">Top Speed</div>
          <div
            className="text-lg text-white"
            style={{ fontFamily: "var(--font-orbitron), Orbitron, monospace" }}
          >
            {Math.round((result.topSpeed / PIXELS_PER_METER) * 2.237)}
            <span className="ml-1 text-xs text-gray-400">MPH</span>
          </div>
        </div>
        <div className="rounded border-2 border-gray-700 bg-black/80 p-3 text-center">
          <div className="text-[10px] uppercase text-gray-400">Parts</div>
          <div
            className="text-lg text-white"
            style={{ fontFamily: "var(--font-orbitron), Orbitron, monospace" }}
          >
            {result.totalParts}
          </div>
        </div>
        <div className="rounded border-2 border-gray-700 bg-black/80 p-3 text-center">
          <div className="text-[10px] uppercase text-gray-400">Shops</div>
          <div
            className="text-lg text-white"
            style={{ fontFamily: "var(--font-orbitron), Orbitron, monospace" }}
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
              <div className="text-[10px] text-gray-400">{PART_LABELS[type]}</div>
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
        <div className="w-full max-w-md space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value.slice(0, 30))}
              placeholder="Enter your name..."
              aria-label="Your name for the leaderboard"
              maxLength={30}
              className="flex-1 rounded border-2 border-gray-700 bg-black/80 px-3 py-2 text-white placeholder-gray-400 focus:border-[#FFD700] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#FFD700]"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSubmit();
              }}
            />
            <button
              onClick={() => void handleSubmit()}
              disabled={!playerName.trim() || submitting}
              className="rounded border-2 border-[#FFD700] bg-[#FFD700] px-4 py-2 font-bold text-black transition-colors hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-50"
            >
              {submitting ? "..." : "Submit"}
            </button>
          </div>
          {submitError && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded border border-red-500/60 bg-red-950/50 px-3 py-2 text-xs text-red-300"
            >
              <span>{submitError}</span>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting || !playerName.trim()}
                className="shrink-0 rounded border border-red-400 px-2.5 py-1 font-bold text-red-200 transition-colors hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-50"
              >
                Retry
              </button>
            </div>
          )}
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
          className="rounded border-2 border-[#FFD700] bg-[#FFD700] px-5 py-2.5 font-bold text-black transition-colors hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          style={{ fontFamily: "var(--font-russo-one), 'Russo One', sans-serif" }}
        >
          Play Again
        </button>
        <button
          onClick={onChangeMoped}
          className="rounded border-2 border-gray-600 bg-black px-5 py-2.5 font-bold text-white transition-colors hover:border-[#FFD700] hover:text-[#FFD700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          style={{ fontFamily: "var(--font-russo-one), 'Russo One', sans-serif" }}
        >
          Change Moped
        </button>
        <button
          onClick={onViewLeaderboard}
          className="rounded border-2 border-gray-600 bg-black px-5 py-2.5 font-bold text-white transition-colors hover:border-[#FFD700] hover:text-[#FFD700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          style={{ fontFamily: "var(--font-russo-one), 'Russo One', sans-serif" }}
        >
          Leaderboard
        </button>
      </div>
    </div>
  );
}
