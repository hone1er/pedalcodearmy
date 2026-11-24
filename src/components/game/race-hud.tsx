"use client";

import { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Volume2, VolumeX, Zap } from "lucide-react";
import type {
  ActiveEffect,
  ComboState,
  GamePopup,
  RunnerGameState,
} from "@/lib/game/types";
import { PIXELS_PER_METER } from "@/lib/game/types";

interface RaceHUDProps {
  score: number;
  distance: number;
  health: number;
  maxHealth: number;
  speed: number;
  effects: ActiveEffect[];
  combo: ComboState;
  popups: GamePopup[];
  zoneName: string;
  zoneAccent: string;
  speedBoostActive: boolean;
  elapsedTime: number;
  phase: RunnerGameState["phase"];
  countdownTimer: number;
  isPaused: boolean;
  isMuted: boolean;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onResume: () => void;
  onRestart: () => void;
  onChangeMoped: () => void;
  onLaneUp: () => void;
  onLaneDown: () => void;
  onWheelie: () => void;
}

const POPUP_STYLES: Record<GamePopup["tone"], string> = {
  gold: "border-[#FFD700] bg-black/90 text-[#FFD700]",
  green: "border-green-400 bg-black/90 text-green-300",
  cyan: "border-cyan-400 bg-black/90 text-cyan-300",
  orange: "border-orange-400 bg-black/90 text-orange-300",
  red: "border-red-500 bg-red-950/90 text-red-300",
};

export function RaceHUD({
  score,
  distance,
  health,
  maxHealth,
  speed,
  effects,
  combo,
  popups,
  zoneName,
  zoneAccent,
  speedBoostActive,
  elapsedTime,
  phase,
  countdownTimer,
  isPaused,
  isMuted,
  onTogglePause,
  onToggleMute,
  onResume,
  onRestart,
  onChangeMoped,
  onLaneUp,
  onLaneDown,
  onWheelie,
}: RaceHUDProps) {
  const distanceMeters = Math.floor(distance / PIXELS_PER_METER);
  const mph = Math.round((speed / PIXELS_PER_METER) * 2.237);
  const showHint = elapsedTime < 6 && phase === "running" && !isPaused;
  const canPause = phase !== "dead";
  const pauseOpen = isPaused && canPause;
  const countdownNumber = Math.ceil(countdownTimer);

  const pauseButtonRef = useRef<HTMLButtonElement>(null);
  const resumeButtonRef = useRef<HTMLButtonElement>(null);
  const pauseDialogRef = useRef<HTMLDivElement>(null);
  const wasPausedRef = useRef(false);

  useEffect(() => {
    if (pauseOpen) {
      wasPausedRef.current = true;
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

  const comboRatio =
    combo.maxTimer > 0 ? Math.max(0, Math.min(1, combo.timer / combo.maxTimer)) : 0;

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-2.5 md:p-4">
      {/* Top Bar */}
      <div className="flex items-start justify-between gap-2">
        {/* Left: Score + Combo Multiplier */}
        <div className="flex flex-col gap-1.5">
          <div className="border-2 border-[#FFD700] bg-black/85 px-3 py-1.5 shadow-[3px_3px_0px_0px_rgba(255,215,0,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Score
              </span>
              <span
                className="text-[10px] font-black uppercase tracking-wider"
                style={{ color: zoneAccent }}
              >
                {zoneName}
              </span>
            </div>
            <div
              className="text-2xl tabular-nums text-[#FFD700] md:text-3xl"
              style={{ fontFamily: "var(--font-orbitron), Orbitron, monospace" }}
            >
              {score.toLocaleString()}
            </div>
          </div>

          {/* Combo Meter */}
          {combo.count >= 2 && (
            <div className="w-fit border-2 border-cyan-400 bg-black/90 px-2.5 py-1">
              <div className="flex items-center gap-2">
                <span
                  className="text-sm font-black text-cyan-300"
                  style={{ fontFamily: "var(--font-orbitron), Orbitron, monospace" }}
                >
                  x{combo.multiplier}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300">
                  {combo.count} Streak
                </span>
              </div>
              <div className="mt-1 h-1 w-24 overflow-hidden bg-gray-800">
                <div
                  className="h-full bg-cyan-400 transition-[width] duration-75"
                  style={{ width: `${Math.round(comboRatio * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right: Health + Controls + Speed & Distance */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            {/* Health hearts */}
            <div className="flex items-center gap-1 border-2 border-gray-700 bg-black/85 px-2 py-1">
              <span className="sr-only">
                Health {health} of {maxHealth}
              </span>
              {Array.from({ length: maxHealth }).map((_, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className={`text-base leading-none md:text-lg ${
                    i < health ? "text-[#FFD700]" : "text-gray-500"
                  }`}
                >
                  {i < health ? "\u2665" : "\u2661"}
                </span>
              ))}
            </div>

            {/* Mute button */}
            <button
              type="button"
              onClick={onToggleMute}
              onTouchStart={stopTouchPropagation}
              onTouchEnd={stopTouchPropagation}
              aria-label={isMuted ? "Unmute sound effects" : "Mute sound effects"}
              className="pointer-events-auto flex items-center justify-center border-2 border-gray-600 bg-black/85 p-1.5 text-gray-300 transition-colors hover:border-[#FFD700] hover:text-[#FFD700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Volume2 className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            {/* Pause button */}
            {canPause && (
              <button
                ref={pauseButtonRef}
                type="button"
                onClick={onTogglePause}
                onTouchStart={stopTouchPropagation}
                onTouchEnd={stopTouchPropagation}
                aria-label={isPaused ? "Resume game" : "Pause game"}
                className="pointer-events-auto border-2 border-[#FFD700] bg-black/85 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[#FFD700] transition-colors hover:bg-[#FFD700] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                style={{
                  fontFamily: "var(--font-russo-one), 'Russo One', sans-serif",
                }}
              >
                {isPaused ? "PLAY" : "PAUSE"}
              </button>
            )}
          </div>

          {/* Speedometer + Distance pill */}
          <div className="flex items-stretch gap-1.5">
            <div
              className={`border-2 bg-black/85 px-2.5 py-1 text-right transition-colors ${
                speedBoostActive
                  ? "border-yellow-400 shadow-[0_0_12px_rgba(255,215,0,0.45)]"
                  : "border-gray-700"
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Speed
              </div>
              <div
                className={`text-base tabular-nums md:text-lg ${
                  speedBoostActive ? "text-[#FFD700]" : "text-white"
                }`}
                style={{ fontFamily: "var(--font-orbitron), Orbitron, monospace" }}
              >
                {mph}
                <span className="ml-0.5 text-[10px] text-gray-400">MPH</span>
              </div>
            </div>

            <div className="border-2 border-[#FFD700] bg-black/85 px-2.5 py-1 text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Dist
              </div>
              <div
                className="text-base tabular-nums text-white md:text-lg"
                style={{ fontFamily: "var(--font-orbitron), Orbitron, monospace" }}
              >
                {distanceMeters}
                <span className="ml-0.5 text-xs text-gray-400">m</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Center: Countdown Overlay & Floating Action Popups */}
      <div className="relative flex flex-1 flex-col items-center justify-center">
        {phase === "countdown" && !isPaused && countdownNumber >= 1 && (
          <div className="flex flex-col items-center">
            <span className="mb-1 border-2 border-[#FFD700] bg-black/90 px-3 py-0.5 text-xs font-black uppercase tracking-widest text-[#FFD700]">
              GET READY
            </span>
            <div
              className="text-7xl text-[#FFD700] drop-shadow-[0_6px_0_rgba(0,0,0,1)] md:text-8xl"
              style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
            >
              {countdownNumber}
            </div>
          </div>
        )}

        {/* Floating Callout Popups */}
        {popups.length > 0 && phase !== "countdown" && (
          <div className="flex flex-col items-center gap-1.5">
            {popups.slice(-2).map((popup) => {
              const lifeRatio = Math.max(0, Math.min(1, popup.timer / popup.maxTimer));
              return (
                <div
                  key={popup.id}
                  style={{
                    opacity: Math.min(1, lifeRatio * 2.2),
                    transform: `translateY(${Math.round((1 - lifeRatio) * -14)}px)`,
                  }}
                  className={`border-2 px-3 py-1 text-center shadow-[3px_3px_0px_0px_rgba(0,0,0,0.9)] ${POPUP_STYLES[popup.tone]}`}
                >
                  <div
                    className="text-sm font-black uppercase tracking-wider md:text-base"
                    style={{
                      fontFamily: "var(--font-russo-one), 'Russo One', sans-serif",
                    }}
                  >
                    {popup.text}
                  </div>
                  {popup.subtext && (
                    <div className="text-[10px] font-bold uppercase tracking-wider text-white/90">
                      {popup.subtext}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom section: Active Buffs, Touch Controls & Control Hint */}
      <div className="space-y-2">
        {effects.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {effects.map((effect) => (
              <div
                key={effect.type}
                className={`flex items-center gap-1.5 border-2 px-3 py-1 text-xs font-black uppercase ${
                  effect.type === "speed-boost"
                    ? "border-[#FFD700] bg-black/90 text-[#FFD700]"
                    : "border-cyan-400 bg-black/90 text-cyan-300"
                }`}
              >
                <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                {effect.type === "speed-boost" ? "TURBO BOOST" : "PART MAGNET"}
                <span className="tabular-nums">
                  {Math.ceil(effect.timer / 1000)}s
                </span>
              </div>
            ))}
          </div>
        )}

        {/* On-screen touch buttons for mobile viewports (alongside swipe/tap) */}
        {phase === "running" && !isPaused && (
          <div className="flex items-end justify-between md:hidden">
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onTouchStart={(e) => {
                  e.stopPropagation();
                  onLaneUp();
                }}
                onTouchEnd={stopTouchPropagation}
                onClick={onLaneUp}
                aria-label="Move up a lane"
                className="pointer-events-auto flex h-11 w-12 items-center justify-center border-2 border-[#FFD700]/80 bg-black/75 text-[#FFD700] active:bg-[#FFD700] active:text-black"
              >
                <ChevronUp className="h-6 w-6" aria-hidden="true" />
              </button>
              <button
                type="button"
                onTouchStart={(e) => {
                  e.stopPropagation();
                  onLaneDown();
                }}
                onTouchEnd={stopTouchPropagation}
                onClick={onLaneDown}
                aria-label="Move down a lane"
                className="pointer-events-auto flex h-11 w-12 items-center justify-center border-2 border-[#FFD700]/80 bg-black/75 text-[#FFD700] active:bg-[#FFD700] active:text-black"
              >
                <ChevronDown className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>

            <button
              type="button"
              onTouchStart={(e) => {
                e.stopPropagation();
                onWheelie();
              }}
              onTouchEnd={stopTouchPropagation}
              onClick={onWheelie}
              aria-label="Pop wheelie"
              className="pointer-events-auto flex h-14 items-center justify-center border-2 border-[#FFD700] bg-black/80 px-4 text-xs font-black uppercase tracking-wider text-[#FFD700] active:bg-[#FFD700] active:text-black"
              style={{
                fontFamily: "var(--font-russo-one), 'Russo One', sans-serif",
              }}
            >
              WHEELIE
            </button>
          </div>
        )}

        {/* Desktop control hint */}
        {showHint && (
          <div
            className="hidden text-center text-[11px] text-gray-300 transition-opacity md:block"
            style={{ opacity: Math.max(0, 1 - elapsedTime / 6) }}
          >
            <span className="inline-block border border-gray-700 bg-black/80 px-3 py-1">
              <kbd className="font-mono text-[#FFD700]">W/S or UP/DOWN</kbd>{" "}
              lanes &bull;{" "}
              <kbd className="font-mono text-[#FFD700]">SPACE / RIGHT</kbd>{" "}
              wheelie &bull;{" "}
              <kbd className="font-mono text-[#FFD700]">M</kbd> mute &bull;{" "}
              <kbd className="font-mono text-[#FFD700]">P / ESC</kbd> pause
            </span>
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
          <div className="flex w-full max-w-xs flex-col items-center gap-5 border-4 border-[#FFD700] bg-black/95 px-6 py-7 text-center shadow-[6px_6px_0px_0px_rgba(255,215,0,0.45)]">
            <h2
              className="text-4xl tracking-wider text-[#FFD700]"
              style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
            >
              PAUSED
            </h2>

            <div className="flex w-full flex-col gap-2.5">
              <button
                ref={resumeButtonRef}
                type="button"
                onClick={onResume}
                className="w-full border-2 border-[#FFD700] bg-[#FFD700] px-5 py-2.5 text-base font-bold uppercase text-black transition-colors hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                style={{
                  fontFamily: "var(--font-russo-one), 'Russo One', sans-serif",
                }}
              >
                Resume
              </button>
              <button
                type="button"
                onClick={onToggleMute}
                className="w-full border-2 border-gray-600 bg-black px-5 py-2 text-sm font-bold uppercase text-gray-200 transition-colors hover:border-[#FFD700] hover:text-[#FFD700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                style={{
                  fontFamily: "var(--font-russo-one), 'Russo One', sans-serif",
                }}
              >
                Sound: {isMuted ? "OFF" : "ON"}
              </button>
              <button
                type="button"
                onClick={onRestart}
                className="w-full border-2 border-gray-600 bg-black px-5 py-2.5 text-base font-bold uppercase text-white transition-colors hover:border-[#FFD700] hover:text-[#FFD700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                style={{
                  fontFamily: "var(--font-russo-one), 'Russo One', sans-serif",
                }}
              >
                Restart
              </button>
              <button
                type="button"
                onClick={onChangeMoped}
                className="w-full border-2 border-gray-600 bg-black px-5 py-2.5 text-base font-bold uppercase text-white transition-colors hover:border-[#FFD700] hover:text-[#FFD700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                style={{
                  fontFamily: "var(--font-russo-one), 'Russo One', sans-serif",
                }}
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
