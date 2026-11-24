"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import type { GameResult, CollectibleType } from "@/lib/game/types";
import { PIXELS_PER_METER } from "@/lib/game/types";
import { MOPED_INFO } from "@/lib/game/moped-stats";

interface ResultsScreenProps {
  result: GameResult;
  isNewBest?: boolean;
  personalBest?: number;
  onPlayAgain: () => void;
  onChangeMoped: () => void;
  onViewLeaderboard: () => void;
}

const PART_LABELS: Record<CollectibleType, string> = {
  "spark-plug": "Spark Plugs",
  jet: "Jets",
  pipe: "Pipes",
  cylinder: "70cc Kits",
};

const SHOP_COLORS: Record<string, { bg: string; text: string }> = {
  treatland: { bg: "bg-green-500/20 border-green-400/50", text: "text-green-300" },
  "1977-mopeds": { bg: "bg-blue-500/20 border-blue-400/50", text: "text-blue-300" },
  "myrons-mopeds": { bg: "bg-orange-500/20 border-orange-400/50", text: "text-orange-300" },
};

const SHOP_NAMES: Record<string, string> = {
  treatland: "Treatland",
  "1977-mopeds": "1977 Mopeds",
  "myrons-mopeds": "Myron's Mopeds",
};

export function ResultsScreen({
  result,
  isNewBest = false,
  personalBest = 0,
  onPlayAgain,
  onChangeMoped,
  onViewLeaderboard,
}: ResultsScreenProps) {
  const [playerName, setPlayerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rank, setRank] = useState<number | null>(null);

  const isGoodRun = result.score >= 800;
  const mopedName = MOPED_INFO[result.mopedMake].name;

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
    <div className="flex w-full max-w-xl flex-col items-center gap-4 px-4 md:gap-5">
      <div className="text-center">
        {isNewBest && (
          <div className="mb-2 inline-flex items-center gap-1.5 border-2 border-[#FFD700] bg-[#FFD700] px-3 py-0.5 text-xs font-black uppercase tracking-widest text-black">
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
            New Personal Best!
          </div>
        )}
        <h2
          className="text-4xl tracking-wider text-[#FFD700] md:text-5xl"
          style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
        >
          {isGoodRun ? "LEGENDARY RUN!" : "WIPEOUT!"}
        </h2>
        <p className="mt-1 text-xs font-bold uppercase tracking-wider text-gray-400">
          {mopedName} &bull; Reached {result.zoneReached}
        </p>
      </div>

      {/* Score box */}
      <div className="w-full max-w-md border-4 border-[#FFD700] bg-zinc-950 px-6 py-4 text-center shadow-[5px_5px_0px_0px_rgba(255,215,0,0.45)]">
        <div className="text-xs font-bold uppercase tracking-widest text-gray-400">
          Final Score
        </div>
        <div
          className="text-4xl tabular-nums text-[#FFD700] md:text-5xl"
          style={{ fontFamily: "var(--font-orbitron), Orbitron, monospace" }}
        >
          {result.score.toLocaleString()}
        </div>
        {personalBest > 0 && !isNewBest && (
          <div className="mt-1 text-xs text-gray-400">
            Personal Best: {personalBest.toLocaleString()}
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid w-full max-w-md grid-cols-3 gap-2.5">
        <div className="border-2 border-gray-700 bg-zinc-950 p-2.5 text-center">
          <div className="text-[10px] font-bold uppercase text-gray-400">
            Distance
          </div>
          <div
            className="text-base tabular-nums text-white md:text-lg"
            style={{ fontFamily: "var(--font-orbitron), Orbitron, monospace" }}
          >
            {result.distance}m
          </div>
        </div>
        <div className="border-2 border-gray-700 bg-zinc-950 p-2.5 text-center">
          <div className="text-[10px] font-bold uppercase text-gray-400">
            Top Speed
          </div>
          <div
            className="text-base tabular-nums text-white md:text-lg"
            style={{ fontFamily: "var(--font-orbitron), Orbitron, monospace" }}
          >
            {Math.round((result.topSpeed / PIXELS_PER_METER) * 2.237)}
            <span className="ml-0.5 text-[10px] text-gray-400">MPH</span>
          </div>
        </div>
        <div className="border-2 border-gray-700 bg-zinc-950 p-2.5 text-center">
          <div className="text-[10px] font-bold uppercase text-gray-400">
            Max Combo
          </div>
          <div
            className="text-base tabular-nums text-cyan-300 md:text-lg"
            style={{ fontFamily: "var(--font-orbitron), Orbitron, monospace" }}
          >
            {result.maxCombo}
          </div>
        </div>
        <div className="border-2 border-gray-700 bg-zinc-950 p-2.5 text-center">
          <div className="text-[10px] font-bold uppercase text-gray-400">
            Wheelies
          </div>
          <div
            className="text-base tabular-nums text-[#FFD700] md:text-lg"
            style={{ fontFamily: "var(--font-orbitron), Orbitron, monospace" }}
          >
            {result.wheelieClears}
          </div>
        </div>
        <div className="border-2 border-gray-700 bg-zinc-950 p-2.5 text-center">
          <div className="text-[10px] font-bold uppercase text-gray-400">
            Close Calls
          </div>
          <div
            className="text-base tabular-nums text-orange-300 md:text-lg"
            style={{ fontFamily: "var(--font-orbitron), Orbitron, monospace" }}
          >
            {result.closeCalls}
          </div>
        </div>
        <div className="border-2 border-gray-700 bg-zinc-950 p-2.5 text-center">
          <div className="text-[10px] font-bold uppercase text-gray-400">
            Shops
          </div>
          <div
            className="text-base tabular-nums text-green-300 md:text-lg"
            style={{ fontFamily: "var(--font-orbitron), Orbitron, monospace" }}
          >
            {result.shopsVisited.length}/3
          </div>
        </div>
      </div>

      {/* Parts breakdown */}
      <div className="w-full max-w-md">
        <div className="mb-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">
          Parts Scavenged ({result.totalParts})
        </div>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(PART_LABELS) as CollectibleType[]).map((type) => (
            <div
              key={type}
              className="border-2 border-gray-800 bg-zinc-950 px-2 py-2 text-center"
            >
              <div className="text-[10px] text-gray-400">
                {PART_LABELS[type]}
              </div>
              <div className="text-sm font-black text-[#FFD700]">
                {result.partsCollected[type]}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Shops visited */}
      {result.shopsVisited.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {result.shopsVisited.map((shop) => {
            const colors = SHOP_COLORS[shop] ?? {
              bg: "bg-gray-500/20 border-gray-500/40",
              text: "text-gray-300",
            };
            return (
              <span
                key={shop}
                className={`border px-3 py-0.5 text-xs font-bold uppercase ${colors.bg} ${colors.text}`}
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
              placeholder="Enter rider name for leaderboard..."
              aria-label="Your name for the leaderboard"
              maxLength={30}
              className="flex-1 border-2 border-gray-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-gray-400 focus:border-[#FFD700] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#FFD700]"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSubmit();
              }}
            />
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!playerName.trim() || submitting}
              className="border-2 border-[#FFD700] bg-[#FFD700] px-4 py-2 text-sm font-black uppercase text-black transition-colors hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-50"
            >
              {submitting ? "..." : "Submit"}
            </button>
          </div>
          {submitError && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 border border-red-500/60 bg-red-950/50 px-3 py-2 text-xs text-red-300"
            >
              <span>{submitError}</span>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting || !playerName.trim()}
                className="shrink-0 border border-red-400 px-2.5 py-1 font-bold text-red-200 transition-colors hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-50"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="border-2 border-green-500/60 bg-green-950/30 px-5 py-2 text-center">
          <p className="text-sm font-bold uppercase text-green-300">
            Score submitted!
          </p>
          {rank && (
            <p className="text-lg font-black text-[#FFD700]">Rank #{rank}</p>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onPlayAgain}
          className="border-2 border-[#FFD700] bg-[#FFD700] px-6 py-2.5 font-bold uppercase text-black shadow-[3px_3px_0px_0px_rgba(255,255,255,0.8)] transition-colors hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          style={{
            fontFamily: "var(--font-russo-one), 'Russo One', sans-serif",
          }}
        >
          Run It Back
        </button>
        <button
          type="button"
          onClick={onChangeMoped}
          className="border-2 border-gray-600 bg-black px-5 py-2.5 font-bold uppercase text-white transition-colors hover:border-[#FFD700] hover:text-[#FFD700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          style={{
            fontFamily: "var(--font-russo-one), 'Russo One', sans-serif",
          }}
        >
          Garage
        </button>
        <button
          type="button"
          onClick={onViewLeaderboard}
          className="border-2 border-gray-600 bg-black px-5 py-2.5 font-bold uppercase text-white transition-colors hover:border-[#FFD700] hover:text-[#FFD700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          style={{
            fontFamily: "var(--font-russo-one), 'Russo One', sans-serif",
          }}
        >
          Leaderboard
        </button>
      </div>
    </div>
  );
}
