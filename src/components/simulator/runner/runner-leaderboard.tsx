"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Trophy } from "lucide-react";
import type { SimBikeMake } from "@/lib/simulator/contract";

interface LeaderboardEntry {
  id: number;
  playerName: string;
  mopedMake: string;
  score: number;
  distance: number;
  partsCollected: number;
  createdAt: string;
}

const MAKE_LABELS: Record<SimBikeMake, string> = {
  "puch-maxi": "Puch Maxi",
  "honda-hobbit": "Honda Hobbit",
  "derbi-variant": "Derbi Variant",
  "tomos-a35": "Tomos A35",
};

const ALL_MAKES: SimBikeMake[] = [
  "puch-maxi",
  "honda-hobbit",
  "derbi-variant",
  "tomos-a35",
];

interface RunnerLeaderboardProps {
  initialMake?: SimBikeMake | "all";
  refreshKey?: number;
}

export function RunnerLeaderboard({
  initialMake = "all",
  refreshKey = 0,
}: RunnerLeaderboardProps) {
  const [scores, setScores] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMake, setFilterMake] = useState<string>(initialMake);
  const abortRef = useRef<AbortController | null>(null);

  const fetchScores = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterMake !== "all") params.set("moped", filterMake);
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
      if (err instanceof DOMException && err.name === "AbortError") return;
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
  }, [filterMake]);

  useEffect(() => {
    void fetchScores();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchScores, refreshKey]);

  return (
    <section
      aria-label="Global Street Runner leaderboard"
      className="border-4 border-[#FFD700] bg-zinc-950 p-4 shadow-[6px_6px_0px_0px_#000] sm:p-5"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-[#FFD700]" aria-hidden="true" />
          <h3
            className="text-2xl tracking-wider text-[#FFD700]"
            style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
          >
            EAST BAY LEADERBOARD
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="Filter leaderboard by moped"
            value={filterMake}
            onChange={(e) => setFilterMake(e.target.value)}
            className="border-2 border-zinc-700 bg-black px-3 py-1.5 text-xs font-black uppercase text-white focus:border-[#FFD700] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
          >
            <option value="all">All Mopeds</option>
            {ALL_MAKES.map((make) => (
              <option key={make} value={make}>
                {MAKE_LABELS[make]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void fetchScores()}
            aria-label="Refresh leaderboard"
            className="inline-flex items-center gap-1 border-2 border-zinc-700 bg-black px-2.5 py-1.5 text-xs font-black uppercase text-zinc-300 hover:border-[#FFD700] hover:text-[#FFD700]"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        {loading ? (
          <div className="py-10 text-center text-xs font-bold uppercase tracking-wider text-zinc-400">
            Loading East Bay scores…
          </div>
        ) : error ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-3 border-2 border-red-500/50 bg-red-950/30 px-4 py-6 text-center"
          >
            <p className="text-xs font-bold text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => void fetchScores()}
              className="border-2 border-[#FFD700] bg-[#FFD700] px-4 py-1.5 text-xs font-black uppercase text-black hover:bg-yellow-300"
            >
              Retry
            </button>
          </div>
        ) : scores.length === 0 ? (
          <div className="py-10 text-center text-xs font-bold uppercase tracking-wider text-zinc-400">
            No runs posted yet. Tune your bike and claim #1!
          </div>
        ) : (
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b-2 border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-400">
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Rider</th>
                <th className="px-2 py-2">Score</th>
                <th className="px-2 py-2">Distance</th>
                <th className="hidden px-2 py-2 sm:table-cell">Parts</th>
                <th className="hidden px-2 py-2 md:table-cell">Moped</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((entry, idx) => (
                <tr
                  key={entry.id}
                  className={`border-b border-zinc-900 ${
                    idx === 0
                      ? "bg-[#FFD700]/10 text-[#FFD700]"
                      : idx < 3
                        ? "text-yellow-200"
                        : "text-zinc-100"
                  }`}
                >
                  <td className="px-2 py-2 font-black">{idx + 1}</td>
                  <td className="px-2 py-2 font-bold">{entry.playerName}</td>
                  <td
                    className="px-2 py-2 font-bold tabular-nums"
                    style={{
                      fontFamily: "var(--font-orbitron), Orbitron, monospace",
                    }}
                  >
                    {entry.score.toLocaleString()}
                  </td>
                  <td className="px-2 py-2 tabular-nums">{entry.distance}m</td>
                  <td className="hidden px-2 py-2 tabular-nums sm:table-cell">
                    {entry.partsCollected}
                  </td>
                  <td className="hidden px-2 py-2 text-zinc-400 md:table-cell">
                    {MAKE_LABELS[entry.mopedMake as SimBikeMake] ??
                      entry.mopedMake}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
