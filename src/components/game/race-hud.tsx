"use client";

import type { ActiveEffect, RunnerGameState } from "@/lib/game/types";
import { PIXELS_PER_METER } from "@/lib/game/types";

interface RaceHUDProps {
  score: number;
  distance: number;
  health: number;
  maxHealth: number;
  speed: number;
  effects: ActiveEffect[];
  elapsedTime: number;
  phase: RunnerGameState["phase"];
}

export function RaceHUD({
  score,
  distance,
  health,
  maxHealth,
  effects,
  elapsedTime,
  phase,
}: RaceHUDProps) {
  const distanceMeters = Math.floor(distance / PIXELS_PER_METER);
  const showHint = elapsedTime < 5 && phase === "running";

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 md:p-4">
      {/* Top section */}
      <div className="flex items-start justify-between">
        {/* Score */}
        <div className="rounded border-2 border-[#FFD700] bg-black/80 px-3 py-1.5">
          <div className="text-[10px] uppercase tracking-wider text-gray-400">
            Score
          </div>
          <div
            className="text-2xl tabular-nums text-[#FFD700] md:text-3xl"
            style={{ fontFamily: "Orbitron, monospace" }}
          >
            {score.toLocaleString()}
          </div>
        </div>

        {/* Health + Distance */}
        <div className="flex flex-col items-end gap-2">
          {/* Health hearts */}
          <div className="flex gap-1">
            {Array.from({ length: maxHealth }).map((_, i) => (
              <span
                key={i}
                className={`text-lg ${
                  i < health ? "text-[#FFD700]" : "text-gray-700"
                }`}
              >
                {i < health ? "\u2665" : "\u2661"}
              </span>
            ))}
          </div>

          {/* Distance */}
          <div className="rounded border-2 border-[#FFD700] bg-black/80 px-3 py-1.5 text-right">
            <div className="text-[10px] uppercase tracking-wider text-gray-400">
              Distance
            </div>
            <div
              className="text-lg tabular-nums text-white md:text-xl"
              style={{ fontFamily: "Orbitron, monospace" }}
            >
              {distanceMeters}
              <span className="ml-1 text-sm text-gray-400">m</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom section */}
      <div className="space-y-2">
        {/* Active effects */}
        {effects.length > 0 && (
          <div className="flex justify-center gap-3">
            {effects.map((effect, i) => (
              <div
                key={i}
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  effect.type === "speed-boost"
                    ? "border border-yellow-500 bg-yellow-500/20 text-yellow-300"
                    : "border border-blue-500 bg-blue-500/20 text-blue-300"
                }`}
              >
                {effect.type === "speed-boost" ? "SPEED BOOST" : "MAGNET"}
                <span className="ml-1 tabular-nums">
                  {Math.ceil(effect.timer / 1000)}s
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Control hint (fades after 5 seconds) */}
        {showHint && (
          <div
            className="text-center text-[10px] text-gray-500 transition-opacity"
            style={{ opacity: Math.max(0, 1 - elapsedTime / 5) }}
          >
            <kbd className="rounded border border-gray-700 bg-gray-800 px-1 py-0.5 font-mono text-gray-400">
              UP/DOWN
            </kbd>{" "}
            change lanes &mdash;{" "}
            <kbd className="rounded border border-gray-700 bg-gray-800 px-1 py-0.5 font-mono text-gray-400">
              SPACE
            </kbd>{" "}
            wheelie
          </div>
        )}
      </div>
    </div>
  );
}
