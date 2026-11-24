"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { LeaderboardEntry, MopedMake } from "@/lib/game/types";
import { MOPED_INFO } from "@/lib/game/moped-stats";

interface LeaderboardProps {
  onBack: () => void;
  initialMoped?: MopedMake;
}

export function Leaderboard({ onBack, initialMoped }: LeaderboardProps) {
  const [scores, setScores] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMoped, setFilterMoped] = useState<string>(initialMoped ?? "all");
  const abortRef = useRef<AbortController | null>(null);

  const fetchScores = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterMoped !== "all") params.set("moped", filterMoped);
      params.set("limit", "50");

      const res = await fetch(`/api/game/leaderboard?${params.toString()}`, {
        signal: controller.signal,
      });
      if (!res.ok) {
        const errData = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          errData?.error ?? `Failed to load leaderboard (${res.status}).`,
        );
      }
      const data = (await res.json()) as { scores?: LeaderboardEntry[] };
      setScores(data.scores ?? []);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setScores([]);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load leaderboard. Please try again.",
      );
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
      }
    }
  }, [filterMoped]);

  useEffect(() => {
    void fetchScores();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchScores]);

  return (
    <div className="flex flex-col items-center gap-4 px-4">
      <button
        onClick={onBack}
        className="self-start rounded px-2 py-1 text-sm text-gray-400 hover:text-[#FFD700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      >
        &larr; Back
      </button>

      <h2
        className="text-3xl text-[#FFD700] md:text-4xl"
        style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
      >
        LEADERBOARD
      </h2>

      {/* Filter */}
      <div className="flex justify-center">
        <select
          value={filterMoped}
          onChange={(e) => setFilterMoped(e.target.value)}
          className="rounded border-2 border-gray-700 bg-black px-3 py-1.5 text-sm text-white focus:border-[#FFD700] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
        >
          <option value="all">All Mopeds</option>
          {(Object.keys(MOPED_INFO) as MopedMake[]).map((make) => (
            <option key={make} value={make}>
              {MOPED_INFO[make].name}
            </option>
          ))}
        </select>
      </div>

      {/* Scores table */}
      <div className="w-full max-w-2xl overflow-x-auto">
        {loading ? (
          <div className="py-12 text-center text-gray-400">Loading...</div>
        ) : error ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-3 rounded-lg border-2 border-red-500/50 bg-red-950/30 px-4 py-8 text-center"
          >
            <p className="text-sm text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => void fetchScores()}
              className="rounded border-2 border-[#FFD700] bg-[#FFD700] px-4 py-1.5 text-sm font-bold text-black transition-colors hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Retry
            </button>
          </div>
        ) : scores.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            No scores yet. Be the first!
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b-2 border-gray-700 text-xs uppercase text-gray-400">
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Score</th>
                <th className="px-2 py-2">Distance</th>
                <th className="hidden px-2 py-2 md:table-cell">Parts</th>
                <th className="hidden px-2 py-2 md:table-cell">Moped</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((score, i) => (
                <tr
                  key={score.id}
                  className={`border-b border-gray-800 ${
                    i < 3 ? "text-[#FFD700]" : "text-white"
                  }`}
                >
                  <td className="px-2 py-2 font-bold">{i + 1}</td>
                  <td className="px-2 py-2">{score.playerName}</td>
                  <td
                    className="px-2 py-2 tabular-nums"
                    style={{ fontFamily: "var(--font-orbitron), Orbitron, monospace" }}
                  >
                    {score.score.toLocaleString()}
                  </td>
                  <td className="px-2 py-2 tabular-nums">
                    {score.distance}m
                  </td>
                  <td className="hidden px-2 py-2 tabular-nums md:table-cell">
                    {score.partsCollected}
                  </td>
                  <td className="hidden px-2 py-2 text-gray-400 md:table-cell">
                    {MOPED_INFO[score.mopedMake as MopedMake]?.name ?? score.mopedMake}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
