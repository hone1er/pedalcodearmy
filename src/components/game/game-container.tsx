"use client";

import { useState, useCallback, useEffect } from "react";
import { Flame, Shield, Trophy, Zap } from "lucide-react";
import type { GamePhase, MopedMake, GameResult } from "@/lib/game/types";
import { MopedSelect } from "./moped-select";
import { RaceCanvas } from "./race-canvas";
import { ResultsScreen } from "./results-screen";
import { Leaderboard } from "./leaderboard";

const PERSONAL_BEST_KEY = "pca-runner-best-score";

function loadPersonalBest(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(PERSONAL_BEST_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function savePersonalBest(score: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PERSONAL_BEST_KEY, String(score));
  } catch {
    // Ignore storage errors
  }
}

export function GameContainer() {
  const [phase, setPhase] = useState<GamePhase>("MENU");
  const [selectedMoped, setSelectedMoped] = useState<MopedMake>("puch-maxi");
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [personalBest, setPersonalBest] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [gameKey, setGameKey] = useState(0);

  useEffect(() => {
    setPersonalBest(loadPersonalBest());
  }, []);

  const handleMopedSelect = useCallback((make: MopedMake) => {
    setSelectedMoped(make);
    setIsNewBest(false);
    setGameKey((k) => k + 1);
    setPhase("PLAYING");
  }, []);

  const handleGameOver = useCallback((result: GameResult) => {
    setGameResult(result);
    setPersonalBest((prev) => {
      if (result.score > prev) {
        savePersonalBest(result.score);
        setIsNewBest(true);
        return result.score;
      }
      setIsNewBest(false);
      return prev;
    });
    setPhase("GAME_OVER");
  }, []);

  return (
    <div className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center bg-black py-6 md:py-8">
      {/* MENU */}
      {phase === "MENU" && (
        <div className="flex w-full max-w-2xl flex-col items-center gap-6 px-4 text-center">
          <div>
            <span className="inline-block border-2 border-[#FFD700] bg-[#FFD700] px-3 py-0.5 text-xs font-black uppercase tracking-widest text-black">
              Pedal Code Army Arcade
            </span>
            <h1
              className="mt-2 text-5xl tracking-wider text-[#FFD700] drop-shadow-[4px_4px_0_rgba(249,115,22,0.75)] md:text-7xl"
              style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
            >
              EAST BAY RUNNER
            </h1>
            <p className="mt-2 text-sm text-gray-300 md:text-base">
              Weave through Oakland traffic, wheelie potholes, chain combos, and hit the shops.
            </p>
            {personalBest > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 border-2 border-[#FFD700]/60 bg-[#FFD700]/10 px-4 py-1 text-xs font-bold uppercase tracking-wider text-[#FFD700]">
                <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                Personal Best:{" "}
                <span
                  className="tabular-nums"
                  style={{
                    fontFamily: "var(--font-orbitron), Orbitron, monospace",
                  }}
                >
                  {personalBest.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Primary CTAs */}
          <div className="flex flex-wrap justify-center gap-4">
            <button
              type="button"
              onClick={() => setPhase("MOPED_SELECT")}
              className="border-4 border-[#FFD700] bg-[#FFD700] px-10 py-3.5 text-3xl tracking-wider text-black shadow-[5px_5px_0px_0px_rgba(255,255,255,0.9)] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
            >
              RIDE NOW
            </button>
            <button
              type="button"
              onClick={() => setPhase("LEADERBOARD")}
              className="border-4 border-gray-600 bg-black px-8 py-3.5 text-lg font-bold uppercase text-white transition-all hover:border-[#FFD700] hover:text-[#FFD700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              style={{
                fontFamily: "var(--font-russo-one), 'Russo One', sans-serif",
              }}
            >
              LEADERBOARD
            </button>
          </div>

          {/* Controls + Street Guide */}
          <div className="grid w-full gap-4 text-left md:grid-cols-2">
            {/* Controls Card */}
            <div className="border-4 border-gray-800 bg-zinc-950 p-4">
              <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-[#FFD700]">
                Controls
              </h2>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <kbd className="border border-gray-600 bg-gray-900 px-2 py-0.5 font-mono text-white">
                    UP / DOWN / W / S
                  </kbd>
                  <span className="text-gray-300">Snap lanes (buffered)</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <kbd className="border border-gray-600 bg-gray-900 px-2 py-0.5 font-mono text-white">
                    SPACE / RIGHT / D
                  </kbd>
                  <span className="text-gray-300">Wheelie over hazards</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <kbd className="border border-gray-600 bg-gray-900 px-2 py-0.5 font-mono text-white">
                    P / ESC &bull; M
                  </kbd>
                  <span className="text-gray-300">Pause &bull; Mute SFX</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <kbd className="border border-gray-600 bg-gray-900 px-2 py-0.5 font-mono text-white">
                    SWIPE / BUTTONS
                  </kbd>
                  <span className="text-gray-300">Mobile touch ready</span>
                </div>
              </div>
            </div>

            {/* Scoring & Shops Guide */}
            <div className="border-4 border-gray-800 bg-zinc-950 p-4">
              <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-[#FFD700]">
                Street Rules &amp; Combos
              </h2>
              <ul className="space-y-2 text-xs text-gray-300">
                <li className="flex items-start gap-2">
                  <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-400" aria-hidden="true" />
                  <span>
                    <strong className="text-white">Wheelie Clears &amp; Close Calls</strong>{" "}
                    build up to a <strong className="text-cyan-300">x4 Combo</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FFD700]" aria-hidden="true" />
                  <span>
                    Ride through neon <strong className="text-green-400">Treatland</strong>{" "}
                    (Turbo), <strong className="text-blue-400">1977</strong> (+1 HP), and{" "}
                    <strong className="text-orange-400">Myron&apos;s</strong> (Magnet) arches.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden="true" />
                  <span>
                    Dodge moving <strong className="text-red-400">cars</strong>; wheelie{" "}
                    <strong className="text-yellow-300">potholes, cones, oil &amp; dogs</strong>.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* MOPED SELECT */}
      {phase === "MOPED_SELECT" && (
        <div className="w-full max-w-4xl">
          <button
            type="button"
            onClick={() => setPhase("MENU")}
            className="mb-4 ml-4 border border-gray-700 px-3 py-1 text-xs font-bold uppercase tracking-wider text-gray-300 hover:border-[#FFD700] hover:text-[#FFD700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            &larr; Main Menu
          </button>
          <MopedSelect onSelect={handleMopedSelect} />
        </div>
      )}

      {/* PLAYING */}
      {phase === "PLAYING" && (
        <div className="h-[64vh] w-full max-w-5xl px-2 md:h-[74vh] md:px-4">
          <RaceCanvas
            key={gameKey}
            mopedMake={selectedMoped}
            onGameOver={handleGameOver}
            onRestart={() => {
              setIsNewBest(false);
              setGameKey((k) => k + 1);
            }}
            onChangeMoped={() => setPhase("MOPED_SELECT")}
          />
        </div>
      )}

      {/* GAME OVER */}
      {phase === "GAME_OVER" && gameResult && (
        <ResultsScreen
          result={gameResult}
          isNewBest={isNewBest}
          personalBest={personalBest}
          onPlayAgain={() => {
            setIsNewBest(false);
            setGameKey((k) => k + 1);
            setPhase("PLAYING");
          }}
          onChangeMoped={() => setPhase("MOPED_SELECT")}
          onViewLeaderboard={() => setPhase("LEADERBOARD")}
        />
      )}

      {/* LEADERBOARD */}
      {phase === "LEADERBOARD" && (
        <Leaderboard
          onBack={() => setPhase(gameResult ? "GAME_OVER" : "MENU")}
          initialMoped={gameResult?.mopedMake}
        />
      )}
    </div>
  );
}
