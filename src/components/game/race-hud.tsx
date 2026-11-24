"use client";

import { useEffect, useRef } from "react";
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
  isPaused: boolean;
  onTogglePause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onChangeMoped: () => void;
}

export function RaceHUD({
  score,
  distance,
  health,
  maxHealth,
  effects,
  elapsedTime,
  phase,
  isPaused,
  onTogglePause,
  onResume,
  onRestart,
  onChangeMoped,
}: RaceHUDProps) {
  const distanceMeters = Math.floor(distance / PIXELS_PER_METER);
  const showHint = elapsedTime < 5 && phase === "running" && !isPaused;
  const canPause = phase !== "dead";
  const pauseOpen = isPaused && canPause;

  const pauseButtonRef = useRef<HTMLButtonElement>(null);
  const resumeButtonRef = useRef<HTMLButtonElement>(null);
  const pauseDialogRef = useRef<HTMLDivElement>(null);
  const wasPausedRef = useRef(false);

  useEffect(() => {
    if (pauseOpen) {
      wasPausedRef.current = true;
      // Avoid stealing focus if another modal (e.g. CartDrawer) triggered the auto-pause
      if (!document.querySelector('[role="dialog"]:not([data-game-pause])')) {
        resumeButtonRef.current?.focus();
      }
    } else if (wasPausedRef.current) {
      wasPausedRef.current = false;
      if (canPause) {
        pauseButtonRef.current?.focus();
      }
    }
  }, [pauseOpen, canPause]);

  const handlePauseKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const dialog = pauseDialogRef.current;
    if (!dialog) return;
    const buttons = Array.from(
      dialog.querySelectorAll<HTMLButtonElement>("button:not([disabled])"),
    );
    if (buttons.length === 0) return;

    const first = buttons[0]!;
    const last = buttons[buttons.length - 1]!;

    if (e.shiftKey) {
      if (
        document.activeElement === first ||
        !dialog.contains(document.activeElement)
      ) {
        e.preventDefault();
        last.focus();
      }
    } else if (
      document.activeElement === last ||
      !dialog.contains(document.activeElement)
    ) {
      e.preventDefault();
      first.focus();
    }
  };

  const stopTouchPropagation = (e: React.TouchEvent) => {
    e.stopPropagation();
  };

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
            style={{ fontFamily: "var(--font-orbitron), Orbitron, monospace" }}
          >
            {score.toLocaleString()}
          </div>
        </div>

        {/* Health + Pause + Distance */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {/* Health hearts */}
            <div className="flex gap-1">
              <span className="sr-only">
                Health {health} of {maxHealth}
              </span>
              {Array.from({ length: maxHealth }).map((_, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className={`text-lg ${
                    i < health ? "text-[#FFD700]" : "text-gray-500"
                  }`}
                >
                  {i < health ? "\u2665" : "\u2661"}
                </span>
              ))}
            </div>

            {/* Pause button */}
            {canPause && (
              <button
                ref={pauseButtonRef}
                type="button"
                onClick={onTogglePause}
                onTouchStart={stopTouchPropagation}
                onTouchEnd={stopTouchPropagation}
                aria-label={isPaused ? "Resume game" : "Pause game"}
                className="pointer-events-auto rounded border-2 border-[#FFD700] bg-black/85 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[#FFD700] transition-colors hover:bg-[#FFD700] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                style={{ fontFamily: "var(--font-russo-one), 'Russo One', sans-serif" }}
              >
                {isPaused ? "PLAY" : "PAUSE"}
              </button>
            )}
          </div>

          {/* Distance */}
          <div className="rounded border-2 border-[#FFD700] bg-black/80 px-3 py-1.5 text-right">
            <div className="text-[10px] uppercase tracking-wider text-gray-400">
              Distance
            </div>
            <div
              className="text-lg tabular-nums text-white md:text-xl"
              style={{ fontFamily: "var(--font-orbitron), Orbitron, monospace" }}
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
            {effects.map((effect) => (
              <div
                key={effect.type}
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
              UP/DOWN/W/S
            </kbd>{" "}
            lanes &mdash;{" "}
            <kbd className="rounded border border-gray-700 bg-gray-800 px-1 py-0.5 font-mono text-gray-400">
              SPACE/RIGHT
            </kbd>{" "}
            wheelie &mdash;{" "}
            <kbd className="rounded border border-gray-700 bg-gray-800 px-1 py-0.5 font-mono text-gray-400">
              P/ESC
            </kbd>{" "}
            pause
          </div>
        )}
      </div>

      {/* Pause Overlay */}
      {pauseOpen && (
        <div
          ref={pauseDialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Game Paused"
          data-game-pause="true"
          tabIndex={-1}
          onKeyDown={handlePauseKeyDown}
          onTouchStart={stopTouchPropagation}
          onTouchEnd={stopTouchPropagation}
          className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div className="flex w-full max-w-xs flex-col items-center gap-5 rounded-lg border-4 border-[#FFD700] bg-black/95 px-6 py-7 text-center shadow-[0_0_30px_rgba(255,215,0,0.25)]">
            <h2
              className="text-4xl tracking-wider text-[#FFD700]"
              style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
            >
              PAUSED
            </h2>

            <div className="flex w-full flex-col gap-3">
              <button
                ref={resumeButtonRef}
                type="button"
                onClick={onResume}
                className="w-full rounded border-2 border-[#FFD700] bg-[#FFD700] px-5 py-2.5 text-base font-bold text-black transition-colors hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                style={{ fontFamily: "var(--font-russo-one), 'Russo One', sans-serif" }}
              >
                Resume
              </button>
              <button
                type="button"
                onClick={onRestart}
                className="w-full rounded border-2 border-gray-600 bg-black px-5 py-2.5 text-base font-bold text-white transition-colors hover:border-[#FFD700] hover:text-[#FFD700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                style={{ fontFamily: "var(--font-russo-one), 'Russo One', sans-serif" }}
              >
                Restart
              </button>
              <button
                type="button"
                onClick={onChangeMoped}
                className="w-full rounded border-2 border-gray-600 bg-black px-5 py-2.5 text-base font-bold text-white transition-colors hover:border-[#FFD700] hover:text-[#FFD700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                style={{ fontFamily: "var(--font-russo-one), 'Russo One', sans-serif" }}
              >
                Change Moped
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
