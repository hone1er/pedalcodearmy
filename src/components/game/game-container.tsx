"use client";

import { useState, useCallback } from "react";
import type { GamePhase, MopedMake, GameResult } from "@/lib/game/types";
import { MopedSelect } from "./moped-select";
import { RaceCanvas } from "./race-canvas";
import { ResultsScreen } from "./results-screen";
import { Leaderboard } from "./leaderboard";

export function GameContainer() {
  const [phase, setPhase] = useState<GamePhase>("MENU");
  const [selectedMoped, setSelectedMoped] = useState<MopedMake>("puch-maxi");
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [gameKey, setGameKey] = useState(0);

  const handleMopedSelect = useCallback((make: MopedMake) => {
    setSelectedMoped(make);
    setGameKey((k) => k + 1);
    setPhase("PLAYING");
  }, []);

  const handleGameOver = useCallback((result: GameResult) => {
    setGameResult(result);
    setPhase("GAME_OVER");
  }, []);

  return (
    <div className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center bg-black py-8">
      {/* MENU */}
      {phase === "MENU" && (
        <div className="flex flex-col items-center gap-8 px-4 text-center">
          <div>
            <h1
              className="text-4xl text-[#FFD700] md:text-6xl"
              style={{ fontFamily: "Bangers, cursive" }}
            >
              EAST BAY RUNNER
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Dodge traffic. Collect parts. Hit the shops.
            </p>
          </div>

          {/* How to play */}
          <div className="w-full max-w-sm rounded-lg border-2 border-gray-700 bg-gray-900/80 px-5 py-4">
            <h3 className="mb-3 text-center text-sm uppercase tracking-widest text-gray-400">
              How to Play
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-3">
                <kbd className="inline-flex min-w-[4.5rem] items-center justify-center rounded border border-gray-600 bg-gray-800 px-2 py-1 font-mono text-xs text-white">
                  UP / DOWN
                </kbd>
                <span className="text-gray-300">Change lanes</span>
              </div>
              <div className="flex items-center gap-3">
                <kbd className="inline-flex min-w-[4.5rem] items-center justify-center rounded border border-gray-600 bg-gray-800 px-2 py-1 font-mono text-xs text-white">
                  SPACE
                </kbd>
                <span className="text-gray-300">Wheelie over obstacles</span>
              </div>
              <div className="flex items-center gap-3">
                <kbd className="inline-flex min-w-[4.5rem] items-center justify-center rounded border border-gray-600 bg-gray-800 px-2 py-1 font-mono text-xs text-white">
                  SWIPE / TAP
                </kbd>
                <span className="text-gray-300">Mobile controls</span>
              </div>
              <div className="mt-3 border-t border-gray-700 pt-3 text-xs text-gray-500">
                Dodge <span className="text-red-400">cars</span> and obstacles.
                Wheelie over <span className="text-yellow-400">potholes</span> and{" "}
                <span className="text-orange-400">cones</span>. Collect{" "}
                <span className="text-[#FFD700]">parts</span> and hit the{" "}
                <span className="text-green-400">shops</span> for bonuses!
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <button
              onClick={() => setPhase("MOPED_SELECT")}
              className="rounded-lg border-4 border-[#FFD700] bg-[#FFD700] px-10 py-4 text-2xl font-bold text-black transition-all hover:scale-105 hover:bg-yellow-400"
              style={{ fontFamily: "Bangers, cursive" }}
            >
              START
            </button>
            <button
              onClick={() => setPhase("LEADERBOARD")}
              className="rounded-lg border-4 border-gray-600 bg-black px-10 py-3 text-lg font-bold text-white transition-all hover:border-[#FFD700] hover:text-[#FFD700]"
              style={{ fontFamily: "Russo One, sans-serif" }}
            >
              LEADERBOARD
            </button>
          </div>
        </div>
      )}

      {/* MOPED SELECT */}
      {phase === "MOPED_SELECT" && (
        <div className="w-full">
          <button
            onClick={() => setPhase("MENU")}
            className="mb-4 ml-4 text-sm text-gray-400 hover:text-[#FFD700]"
          >
            &larr; Main Menu
          </button>
          <MopedSelect onSelect={handleMopedSelect} />
        </div>
      )}

      {/* PLAYING */}
      {phase === "PLAYING" && (
        <div className="h-[60vh] w-full max-w-4xl md:h-[70vh]">
          <RaceCanvas
            key={gameKey}
            mopedMake={selectedMoped}
            onGameOver={handleGameOver}
          />
        </div>
      )}

      {/* GAME OVER */}
      {phase === "GAME_OVER" && gameResult && (
        <ResultsScreen
          result={gameResult}
          onPlayAgain={() => {
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
