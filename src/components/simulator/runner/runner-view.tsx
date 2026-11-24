"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Flame,
  Gauge,
  Heart,
  Magnet,
  OctagonAlert,
  Pause,
  Play,
  RotateCcw,
  Send,
  Trophy,
  Volume2,
  VolumeX,
  Wrench,
  Zap,
} from "lucide-react";
import { PulseSynth } from "@/lib/simulator/audio/pulse-synth";
import type { RunnerRunSummary, SimBikeMake } from "@/lib/simulator/contract";
import { getPartById } from "@/lib/simulator/economy/catalog";
import { RunnerRenderer } from "@/lib/simulator/runner/runner-renderer";
import {
  NEUTRAL_RUNNER_INPUT,
  SEIZE_CLUTCH_WINDOW_MS,
  type RunnerHudSnapshot,
  type RunnerInput,
  type RunnerState,
  buildRunnerAudioTelemetry,
  buildRunnerHudSnapshot,
  createRunnerState,
  finalizeRunnerRun,
  stepRunner,
} from "@/lib/simulator/runner/runner-sim";
import { getActiveBike, useSimStore } from "@/lib/simulator/store/sim-store";
import { RunnerLeaderboard } from "./runner-leaderboard";

const MAKE_NAMES: Record<SimBikeMake, string> = {
  "puch-maxi": "Puch Maxi (E50)",
  "honda-hobbit": "Honda Hobbit (PA50)",
  "derbi-variant": "Derbi Variant SL",
  "tomos-a35": "Tomos A35",
};

const STEP_SEC = 1 / 60;

/** Crisp arcade one-shot chimes using a shared AudioContext when running */
function playArcadeTone(
  ctx: AudioContext | null,
  freq: number,
  endFreq: number,
  durSec: number,
  type: OscillatorType = "triangle",
  gainPeak = 0.12,
): void {
  if (ctx?.state !== "running") return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + durSec);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(gainPeak, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0008, now + durSec);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
  osc.start(now);
  osc.stop(now + durSec + 0.02);
}

function endReasonMeta(reason: RunnerRunSummary["endReason"]): {
  title: string;
  subtitle: string;
  bannerClass: string;
} {
  switch (reason) {
    case "seized":
      return {
        title: "PISTON SEIZED IN TRAFFIC!",
        subtitle: "Your top end cooked and locked the rear wheel. Pull the plug and check jetting/premix in the Garage!",
        bannerClass: "bg-red-600 text-white border-red-400",
      };
    case "stalled":
      return {
        title: "STALLED OUT ON THE STREET",
        subtitle: "Your bike refused to keep running. Roll it back onto the workbench and diagnose the symptom.",
        bannerClass: "bg-orange-500 text-black border-orange-300",
      };
    case "crashed":
      return {
        title: "OAKLAND WIPEOUT!",
        subtitle: "Out of hearts — dust off your jacket, pocket your street cash, and send it again.",
        bannerClass: "bg-[#FFD700] text-black border-[#FFD700]",
      };
    default:
      return {
        title: "RUN ENDED",
        subtitle: "Pulled off the avenue with your earnings intact.",
        bannerClass: "bg-zinc-200 text-black border-zinc-300",
      };
  }
}

export function RunnerView() {
  const {
    save,
    bikeNeedsAttention,
    lastRunnerSummary,
    setPhase,
    completeRunnerRun,
    dismissRunnerSummary,
  } = useSimStore();

  const bike = getActiveBike(save);

  const [mode, setMode] = useState<"lobby" | "playing">("lobby");
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [hud, setHud] = useState<RunnerHudSnapshot | null>(null);
  const [lbRefreshKey, setLbRefreshKey] = useState(0);

  // Leaderboard submission state
  const [riderName, setRiderName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedRank, setSubmittedRank] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<RunnerRenderer | null>(null);
  const synthRef = useRef<PulseSynth | null>(null);
  const sfxCtxRef = useRef<AudioContext | null>(null);

  const runnerRef = useRef<RunnerState | null>(null);
  const inputRef = useRef<RunnerInput>({ ...NEUTRAL_RUNNER_INPUT });
  const pausedRef = useRef(false);
  const mutedRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    pausedRef.current = paused;
    synthRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    mutedRef.current = muted;
    synthRef.current?.setMuted(muted);
  }, [muted]);

  const ensureAudio = useCallback(() => {
    if (!synthRef.current) {
      synthRef.current = new PulseSynth();
      synthRef.current.setMuted(mutedRef.current);
    }
    synthRef.current.unlock();
    if (!sfxCtxRef.current && typeof window !== "undefined") {
      const AudioCtor = window.AudioContext;
      if (AudioCtor) sfxCtxRef.current = new AudioCtor();
    }
    if (sfxCtxRef.current?.state === "suspended") {
      void sfxCtxRef.current.resume();
    }
  }, []);

  const stopAudio = useCallback(() => {
    synthRef.current?.destroy();
    synthRef.current = null;
    if (sfxCtxRef.current) {
      void sfxCtxRef.current.close();
      sfxCtxRef.current = null;
    }
  }, []);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [stopAudio]);

  const finishActiveRun = useCallback(
    (overrideReason?: RunnerRunSummary["endReason"]) => {
      const state = runnerRef.current;
      if (!state) return;
      runnerRef.current = null;
      const result = finalizeRunnerRun(
        state,
        overrideReason ?? state.endReason ?? "aborted",
      );
      stopAudio();
      setPaused(false);
      setHud(null);
      setMode("lobby");
      setSubmittedRank(null);
      setSubmitError(null);
      completeRunnerRun(result);
    },
    [completeRunnerRun, stopAudio],
  );

  const startRun = useCallback(() => {
    dismissRunnerSummary();
    setSubmittedRank(null);
    setSubmitError(null);
    setPaused(false);
    setShowLeaderboard(false);
    ensureAudio();

    const activeBike = getActiveBike(save);
    const seed =
      ((save.seed ^ Date.now() ^ Math.imul(save.stats.totalRides + 7, 2654435761)) >>> 0) || 1;
    const state = createRunnerState(activeBike, {
      hasTach: save.upgrades.includes("gauge-tach"),
      hasChtGauge: save.upgrades.includes("gauge-cht"),
      hasStethoscope: save.upgrades.includes("tool-stethoscope"),
      seed,
    });
    runnerRef.current = state;
    inputRef.current = { ...NEUTRAL_RUNNER_INPUT };
    setHud(buildRunnerHudSnapshot(state));
    setMode("playing");
  }, [dismissRunnerSummary, ensureAudio, save]);

  // Canvas & 60 Hz Game Loop while playing
  useEffect(() => {
    if (mode !== "playing") return;
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    const renderer = new RunnerRenderer(canvas);
    rendererRef.current = renderer;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        renderer.resize(entry.contentRect.width, entry.contentRect.height);
      }
    });
    ro.observe(stage);

    const onVisibility = () => {
      if (document.hidden) {
        setPaused(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    let rafId = 0;
    let lastTime = performance.now();
    let acc = 0;
    let lastHudMs = 0;

    const frame = (now: number) => {
      const state = runnerRef.current;
      if (!state) return;

      const dtMs = Math.min(80, Math.max(0, now - lastTime));
      lastTime = now;

      if (!pausedRef.current) {
        acc += dtMs / 1000;
        let steps = 0;
        while (acc >= STEP_SEC && steps < 6) {
          acc -= STEP_SEC;
          steps++;
          const stepInput: RunnerInput = { ...inputRef.current };
          // Consume one-shot pulses
          inputRef.current.laneDir = 0;
          inputRef.current.wheeliePulse = false;
          inputRef.current.kickstartPulse = false;

          const events = stepRunner(state, stepInput, STEP_SEC);
          const sfx = mutedRef.current ? null : sfxCtxRef.current;

          for (const ev of events) {
            if (ev.type === "sim") {
              synthRef.current?.playEvent(ev.event);
            } else if (ev.type === "wheelie") {
              playArcadeTone(sfx, ev.strong ? 260 : 180, ev.strong ? 520 : 280, 0.11, "sawtooth", 0.08);
            } else if (ev.type === "wheelie-clear") {
              playArcadeTone(sfx, 520, 880, 0.14, "triangle", 0.12);
              renderer.spawnBurst(canvas.clientWidth * 0.22, canvas.clientHeight * 0.65, "#FFD700", 10);
            } else if (ev.type === "close-call") {
              playArcadeTone(sfx, 640, 960, 0.1, "sine", 0.09);
            } else if (ev.type === "pickup") {
              playArcadeTone(sfx, 660, 1120, 0.09, "triangle", 0.1);
              renderer.spawnBurst(canvas.clientWidth * 0.22, canvas.clientHeight * 0.62, "#22D3EE", 8);
            } else if (ev.type === "shop-arch") {
              playArcadeTone(sfx, 440, 990, 0.24, "square", 0.1);
              renderer.spawnBurst(canvas.clientWidth * 0.25, canvas.clientHeight * 0.55, "#4ADE80", 14);
            } else if (ev.type === "hit") {
              playArcadeTone(sfx, 180, 55, 0.22, "sawtooth", 0.16);
              renderer.spawnBurst(canvas.clientWidth * 0.22, canvas.clientHeight * 0.66, "#EF4444", 14);
            }
          }

          if (state.finished) {
            finishActiveRun();
            return;
          }
        }
        if (steps >= 6) acc = 0;

        // Feed real 2-stroke firing-pulse synth
        synthRef.current?.update(
          buildRunnerAudioTelemetry(state, inputRef.current.brake, inputRef.current.clutch),
        );

        renderer.render(state, dtMs / 1000);

        if (now - lastHudMs >= 66) {
          lastHudMs = now;
          setHud(buildRunnerHudSnapshot(state));
        }
      }

      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      rendererRef.current = null;
    };
  }, [finishActiveRun, mode]);

  // Keyboard controls while playing
  useEffect(() => {
    if (mode !== "playing") return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      ensureAudio();

      if (e.code === "KeyP" || e.code === "Escape") {
        e.preventDefault();
        setPaused((p) => !p);
        return;
      }
      if (e.code === "KeyM") {
        e.preventDefault();
        setMuted((m) => !m);
        return;
      }
      if (pausedRef.current) return;

      if (e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        if (!e.repeat) inputRef.current.laneDir = -1;
      } else if (e.code === "ArrowDown" || e.code === "KeyS") {
        e.preventDefault();
        if (!e.repeat) inputRef.current.laneDir = 1;
      } else if (e.code === "Space" || e.code === "ArrowRight" || e.code === "KeyD") {
        e.preventDefault();
        if (!e.repeat) inputRef.current.wheeliePulse = true;
      } else if (e.code === "KeyQ") {
        e.preventDefault();
        inputRef.current.clutch = true;
      } else if (e.code === "KeyB" || e.code === "ShiftLeft" || e.code === "ShiftRight") {
        e.preventDefault();
        inputRef.current.brake = true;
      } else if (e.code === "KeyR") {
        e.preventDefault();
        if (!e.repeat) inputRef.current.kickstartPulse = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "KeyQ") inputRef.current.clutch = false;
      if (e.code === "KeyB" || e.code === "ShiftLeft" || e.code === "ShiftRight") {
        inputRef.current.brake = false;
      }
    };

    const onBlur = () => {
      inputRef.current.clutch = false;
      inputRef.current.brake = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [ensureAudio, mode]);

  const handleSubmitScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lastRunnerSummary || submitting || submittedRank !== null) return;
    const trimmed = riderName.trim();
    if (!trimmed) {
      setSubmitError("Enter a rider tag to post your score.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/game/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerName: trimmed.slice(0, 30),
          mopedMake: lastRunnerSummary.bikeMake,
          score: lastRunnerSummary.score,
          distance: lastRunnerSummary.distanceM,
          partsCollected: lastRunnerSummary.partsCollected,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        rank?: number;
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(data?.error ?? `Could not post score (${res.status}).`);
      }
      setSubmittedRank(data?.rank ?? 1);
      setLbRefreshKey((k) => k + 1);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to submit score.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── PLAYING VIEW ────────────────────────────────────────────────────────
  if (mode === "playing" && hud) {
    const seizePct = Math.min(
      100,
      Math.max(0, (hud.seizeClutchWindowMs / SEIZE_CLUTCH_WINDOW_MS) * 100),
    );
    const pipeName = getPartById(bike.parts.exhaust)?.name ?? "Stock Pipe";

    return (
      <div className="space-y-3">
        {/* Top Arcade HUD Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-4 border-[#FFD700] bg-zinc-950 px-3 py-2 shadow-[4px_4px_0px_0px_#000]">
          <div className="flex flex-wrap items-center gap-3">
            {/* Score */}
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                Score
              </div>
              <div
                className="text-xl font-black leading-none text-[#FFD700] tabular-nums sm:text-2xl"
                style={{ fontFamily: "var(--font-orbitron), Orbitron, monospace" }}
              >
                {hud.score.toLocaleString()}
              </div>
            </div>

            {/* Combo */}
            <div className="min-w-[84px] border-l-2 border-zinc-800 pl-3">
              <div className="flex items-center justify-between text-[10px] font-black uppercase">
                <span className="text-zinc-400">Combo</span>
                <span
                  className={
                    hud.comboMultiplier >= 3
                      ? "text-[#FFD700]"
                      : hud.comboMultiplier === 2
                        ? "text-cyan-300"
                        : "text-zinc-400"
                  }
                >
                  x{hud.comboMultiplier}
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden border border-zinc-700 bg-black">
                <div
                  className="h-full bg-[#FFD700] transition-all duration-75"
                  style={{ width: `${hud.comboPct}%` }}
                />
              </div>
            </div>

            {/* Hearts */}
            <div className="flex items-center gap-1 border-l-2 border-zinc-800 pl-3" aria-label={`Health ${hud.health} of ${hud.maxHealth}`}>
              {Array.from({ length: hud.maxHealth }).map((_, idx) => (
                <Heart
                  key={idx}
                  className={`h-5 w-5 ${
                    idx < hud.health
                      ? "fill-red-500 text-red-500"
                      : "text-zinc-700"
                  }`}
                />
              ))}
            </div>

            {/* Zone & Distance */}
            <div className="hidden border-l-2 border-zinc-800 pl-3 md:block">
              <div
                className="text-[11px] font-black uppercase tracking-wider"
                style={{ color: hud.zoneAccentHex }}
              >
                {hud.zoneName}
              </div>
              <div className="text-[11px] font-bold text-zinc-400 tabular-nums">
                {hud.distanceM}m • {hud.partsCollected} parts
              </div>
            </div>
          </div>

          {/* Right: Speed, Powerups & Controls */}
          <div className="flex items-center gap-2">
            {hud.turboSec > 0 && (
              <span className="inline-flex items-center gap-1 border-2 border-black bg-[#FFD700] px-2 py-0.5 text-[10px] font-black uppercase text-black">
                <Zap className="h-3 w-3" />
                TURBO {hud.turboSec.toFixed(1)}s
              </span>
            )}
            {hud.magnetSec > 0 && (
              <span className="inline-flex items-center gap-1 border-2 border-black bg-cyan-400 px-2 py-0.5 text-[10px] font-black uppercase text-black">
                <Magnet className="h-3 w-3" />
                MAGNET {hud.magnetSec.toFixed(1)}s
              </span>
            )}

            <div className="border-2 border-zinc-700 bg-black px-2.5 py-1 text-right">
              <span
                className="text-base font-black text-white tabular-nums"
                style={{ fontFamily: "var(--font-orbitron), Orbitron, monospace" }}
              >
                {Math.round(hud.speedMph)}
              </span>
              <span className="ml-1 text-[10px] font-black uppercase text-zinc-400">
                MPH
              </span>
            </div>

            {hud.hasChtGauge && (
              <div
                className={`hidden border-2 px-2 py-1 text-[11px] font-black tabular-nums sm:block ${
                  hud.chtC > 195
                    ? "border-red-500 bg-red-950 text-red-200"
                    : "border-zinc-700 bg-black text-orange-300"
                }`}
              >
                {Math.round(hud.chtC)}°C
              </div>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                setMuted((m) => !m);
              }}
              aria-label={muted ? "Unmute audio" : "Mute audio"}
              className="border-2 border-zinc-700 bg-black p-1.5 text-zinc-200 hover:border-[#FFD700] hover:text-[#FFD700]"
            >
              {muted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4 text-[#FFD700]" />}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                setPaused((p) => !p);
              }}
              aria-label={paused ? "Resume run" : "Pause run"}
              className="border-2 border-zinc-700 bg-black p-1.5 text-zinc-200 hover:border-[#FFD700] hover:text-[#FFD700]"
            >
              {paused ? <Play className="h-4 w-4 text-emerald-400" /> : <Pause className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                finishActiveRun("aborted");
              }}
              className="border-2 border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-[11px] font-black uppercase text-zinc-200 hover:border-red-400 hover:text-red-300"
            >
              Quit
            </button>
          </div>
        </div>

        {/* Main 3-Lane Canvas Stage */}
        <div
          ref={stageRef}
          onTouchStart={(e) => {
            ensureAudio();
            const t = e.touches[0];
            if (t) touchStartRef.current = { x: t.clientX, y: t.clientY };
          }}
          onTouchEnd={(e) => {
            const start = touchStartRef.current;
            const t = e.changedTouches[0];
            touchStartRef.current = null;
            if (!start || !t || pausedRef.current) return;
            const dy = t.clientY - start.y;
            const dx = t.clientX - start.x;
            if (Math.abs(dy) > 26 && Math.abs(dy) > Math.abs(dx)) {
              inputRef.current.laneDir = dy < 0 ? -1 : 1;
            } else if (Math.abs(dx) < 25 && Math.abs(dy) < 25) {
              inputRef.current.wheeliePulse = true;
            }
          }}
          className="relative h-[320px] w-full min-w-0 touch-none overflow-hidden border-4 border-black bg-zinc-950 shadow-[6px_6px_0px_0px_#000] sm:h-[400px] md:h-[440px]"
        >
          <canvas ref={canvasRef} className="block h-full w-full" />

          {/* Floating Arcade & Diagnostic Popups (upper-center safe band) */}
          <div className="pointer-events-none absolute inset-x-0 top-3 z-[25] flex flex-col items-center gap-1.5 px-4">
            {hud.popups.map((p) => {
              const toneClass =
                p.tone === "red"
                  ? "border-black bg-red-600 text-white"
                  : p.tone === "orange"
                    ? "border-black bg-orange-500 text-black"
                    : p.tone === "cyan"
                      ? "border-black bg-cyan-400 text-black"
                      : p.tone === "green"
                        ? "border-black bg-emerald-400 text-black"
                        : "border-black bg-[#FFD700] text-black";
              return (
                <div
                  key={p.id}
                  className={`max-w-[90%] border-[3px] px-3 py-1 text-center shadow-[4px_4px_0px_0px_#000] ${toneClass}`}
                >
                  <div className="text-xs font-black uppercase tracking-wider sm:text-sm">
                    {p.text}
                  </div>
                  {p.subtext && (
                    <div className="text-[10px] font-bold opacity-90">
                      {p.subtext}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* URGENT SEIZE CLUTCH-SAVE ALERT */}
          {hud.seizeActive && (
            <div className="absolute inset-x-4 top-1/2 z-30 -translate-y-1/2 border-4 border-black bg-red-600 p-4 text-center text-white shadow-[8px_8px_0px_#000] sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2">
              <div className="flex items-center justify-center gap-2 text-lg font-black uppercase tracking-wider sm:text-xl">
                <OctagonAlert className="h-6 w-6 animate-bounce text-[#FFD700]" />
                <span>ENGINE SEIZING! PULL [Q] CLUTCH!</span>
              </div>
              <div className="mt-2 h-3 w-full overflow-hidden border-2 border-black bg-black">
                <div className="h-full bg-[#FFD700]" style={{ width: `${seizePct}%` }} />
              </div>
              <button
                type="button"
                onContextMenu={(e) => e.preventDefault()}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    // synthetic event
                  }
                  inputRef.current.clutch = true;
                }}
                onPointerUp={() => {
                  inputRef.current.clutch = false;
                }}
                onPointerCancel={() => {
                  inputRef.current.clutch = false;
                }}
                className="mt-3 w-full touch-none border-[3px] border-black bg-[#FFD700] px-4 py-2 text-sm font-black uppercase text-black shadow-[4px_4px_0px_#000]"
              >
                PULL CLUTCH [Q] — SAVE THE TOP END!
              </button>
            </div>
          )}

          {/* STALLED PROMPT */}
          {hud.stalled && !hud.seizeActive && !hud.seizedHard && (
            <div className="absolute inset-x-4 bottom-3 z-20 flex flex-wrap items-center justify-between gap-2 border-[3px] border-black bg-orange-500 px-3 py-2 text-black shadow-[4px_4px_0px_#000]">
              <div className="text-xs font-black uppercase">
                {hud.seizeCooldownHot
                  ? "CLUTCH SAVED! COASTING TO COOL DOWN…"
                  : "ENGINE STALLED — TAP [R] TO KICKSTART!"}
              </div>
              <button
                type="button"
                onClick={() => {
                  ensureAudio();
                  inputRef.current.kickstartPulse = true;
                }}
                className="border-2 border-black bg-black px-3 py-1 text-xs font-black uppercase text-[#FFD700]"
              >
                KICK [R]
              </button>
            </div>
          )}

          {/* PAUSE OVERLAY */}
          {paused && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/80 p-4 text-center backdrop-blur-sm">
              <div
                className="text-5xl tracking-wider text-[#FFD700]"
                style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
              >
                PAUSED
              </div>
              <p className="text-xs font-bold uppercase text-zinc-300">
                {bike.nickname} • {pipeName} • Main Jet #{bike.tuning.mainJet}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setPaused(false)}
                  className="border-4 border-[#FFD700] bg-[#FFD700] px-6 py-2 text-sm font-black uppercase text-black shadow-[4px_4px_0px_0px_#FFF]"
                >
                  Resume Run
                </button>
                <button
                  type="button"
                  onClick={() => finishActiveRun("aborted")}
                  className="border-2 border-zinc-600 bg-zinc-900 px-5 py-2 text-sm font-black uppercase text-zinc-200 hover:border-red-400 hover:text-red-300"
                >
                  End Run & Keep Cash
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Arcade Control Deck (Desktop hints + Mobile touch controls) */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-4 border-black bg-[#FFD700] p-2.5 text-black shadow-[4px_4px_0px_0px_#000]">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={() => {
                ensureAudio();
                inputRef.current.laneDir = -1;
              }}
              className="inline-flex touch-none items-center gap-1 border-[3px] border-black bg-white px-3 py-2 text-xs font-black uppercase shadow-[3px_3px_0px_#000] active:translate-y-0.5"
            >
              <ArrowUp className="h-4 w-4" />
              Up [W]
            </button>
            <button
              type="button"
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={() => {
                ensureAudio();
                inputRef.current.laneDir = 1;
              }}
              className="inline-flex touch-none items-center gap-1 border-[3px] border-black bg-white px-3 py-2 text-xs font-black uppercase shadow-[3px_3px_0px_#000] active:translate-y-0.5"
            >
              <ArrowDown className="h-4 w-4" />
              Down [S]
            </button>
          </div>

          <div className="hidden text-center text-[11px] font-black uppercase tracking-wide lg:block">
            W/S or ↑/↓ Switch Lanes • Space Wheelie Ground Hazards • Q Clutch Save • B Coast/Cool • R Kick
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={(e) => {
                ensureAudio();
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  // synthetic
                }
                inputRef.current.brake = true;
              }}
              onPointerUp={() => {
                inputRef.current.brake = false;
              }}
              onPointerCancel={() => {
                inputRef.current.brake = false;
              }}
              className="touch-none border-[3px] border-black bg-zinc-200 px-3 py-2 text-xs font-black uppercase shadow-[3px_3px_0px_#000] active:translate-y-0.5"
            >
              Coast [B]
            </button>
            <button
              type="button"
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={(e) => {
                ensureAudio();
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  // synthetic
                }
                inputRef.current.clutch = true;
              }}
              onPointerUp={() => {
                inputRef.current.clutch = false;
              }}
              onPointerCancel={() => {
                inputRef.current.clutch = false;
              }}
              className="touch-none border-[3px] border-black bg-cyan-300 px-3 py-2 text-xs font-black uppercase shadow-[3px_3px_0px_#000] active:translate-y-0.5"
            >
              Clutch [Q]
            </button>
            <button
              type="button"
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={() => {
                ensureAudio();
                inputRef.current.wheeliePulse = true;
              }}
              className="touch-none border-[3px] border-black bg-black px-4 py-2 text-xs font-black uppercase text-[#FFD700] shadow-[3px_3px_0px_#FFF] active:translate-y-0.5"
            >
              WHEELIE [SPACE]
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── LOBBY + POST-RUN RESULTS + LEADERBOARD ──────────────────────────────
  const exhaustPart = getPartById(bike.parts.exhaust);
  const carbPart = getPartById(bike.parts.carburetor);
  const cylPart = getPartById(bike.parts.cylinder);

  const warnings: string[] = [];
  if (bike.tuning.killSwitchOn) {
    warnings.push("Kill switch is OFF (KILLED) — your bike won't start on the line!");
  }
  if (!bike.tuning.hasPremixOil) {
    warnings.push("No 2-stroke premix oil in the tank — it'll run dry and seize fast!");
  }
  if (bikeNeedsAttention && !bike.tuning.killSwitchOn && bike.tuning.hasPremixOil) {
    warnings.push(
      "Your bike still needs wrenching — expect sluggish speed, boggy wheelies, or stalling in traffic until you tune it in the Garage.",
    );
  }

  return (
    <div className="space-y-6">
      {/* Post-Run Summary & Leaderboard Submission Banner */}
      {lastRunnerSummary && (() => {
        const meta = endReasonMeta(lastRunnerSummary.endReason);
        return (
          <section
            aria-label="Street Runner run summary"
            className="border-4 border-[#FFD700] bg-zinc-950 shadow-[8px_8px_0px_0px_#000]"
          >
            <div className={`border-b-4 px-5 py-4 ${meta.bannerClass}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2
                    className="text-3xl leading-none tracking-wider sm:text-4xl"
                    style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
                  >
                    {meta.title}
                  </h2>
                  <p className="mt-1 text-xs font-bold opacity-90 sm:text-sm">
                    {meta.subtitle}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black uppercase tracking-widest opacity-80">
                    Final Score
                  </div>
                  <div
                    className="text-3xl font-black tabular-nums"
                    style={{ fontFamily: "var(--font-orbitron), Orbitron, monospace" }}
                  >
                    {lastRunnerSummary.score.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              {/* Key Stats Grid */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: "Distance", val: `${lastRunnerSummary.distanceM}m`, accent: "text-white" },
                  { label: "Top Speed", val: `${lastRunnerSummary.topSpeedMph} mph`, accent: "text-[#FFD700]" },
                  { label: "Max Combo", val: `x${lastRunnerSummary.maxCombo}`, accent: "text-cyan-300" },
                  { label: "Wheelie Clears", val: String(lastRunnerSummary.wheelieClears), accent: "text-orange-300" },
                  { label: "Cash Earned", val: `+$${lastRunnerSummary.cashEarned}`, accent: "text-emerald-400" },
                  { label: "Street Rep", val: `+${lastRunnerSummary.repEarned} REP`, accent: "text-cyan-400" },
                ].map((s) => (
                  <div key={s.label} className="border-2 border-zinc-800 bg-black p-2.5">
                    <div className="text-[10px] font-black uppercase text-zinc-500">
                      {s.label}
                    </div>
                    <div
                      className={`mt-1 text-base font-black tabular-nums ${s.accent}`}
                      style={{ fontFamily: "var(--font-orbitron), Orbitron, monospace" }}
                    >
                      {s.val}
                    </div>
                  </div>
                ))}
              </div>

              {/* Mechanical Observations */}
              {lastRunnerSummary.notes.length > 0 && (
                <div className="border-2 border-zinc-800 bg-black p-3">
                  <div className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-[#FFD700]">
                    Street Mechanical Notes ({lastRunnerSummary.bikeNickname})
                  </div>
                  <ul className="space-y-1 text-xs text-zinc-200">
                    {lastRunnerSummary.notes.map((n, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FFD700]" />
                        <span>{n}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Submit to Global Leaderboard */}
              {lastRunnerSummary.score > 0 && (
                <div className="border-2 border-zinc-800 bg-black p-3.5">
                  {submittedRank !== null ? (
                    <div className="flex items-center justify-between gap-2 text-sm font-black text-emerald-400">
                      <span className="inline-flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-[#FFD700]" />
                        Posted to East Bay Leaderboard — Ranked #{submittedRank}!
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowLeaderboard(true)}
                        className="border border-emerald-400 px-2.5 py-1 text-[11px] uppercase text-emerald-200 hover:bg-emerald-950"
                      >
                        View Board
                      </button>
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => void handleSubmitScore(e)}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <label htmlFor="runner-lb-name" className="sr-only">
                        Rider name for global leaderboard
                      </label>
                      <input
                        id="runner-lb-name"
                        type="text"
                        maxLength={30}
                        value={riderName}
                        onChange={(e) => setRiderName(e.target.value)}
                        placeholder="Enter rider tag for global leaderboard…"
                        className="min-w-[200px] flex-1 border-2 border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-bold text-white placeholder:text-zinc-500 focus:border-[#FFD700] focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex items-center gap-1.5 border-2 border-[#FFD700] bg-[#FFD700] px-4 py-2 text-xs font-black uppercase text-black hover:bg-yellow-300 disabled:opacity-50"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {submitting ? "Posting…" : "Post Score"}
                      </button>
                      {submitError && (
                        <p className="w-full text-xs font-bold text-red-400">
                          {submitError}
                        </p>
                      )}
                    </form>
                  )}
                </div>
              )}

              {/* Post-Run CTAs */}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={startRun}
                  className="inline-flex items-center gap-2 border-4 border-[#FFD700] bg-[#FFD700] px-6 py-2.5 text-xl tracking-wider text-black shadow-[4px_4px_0px_0px_#FFF] hover:bg-yellow-300"
                  style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
                >
                  <RotateCcw className="h-5 w-5" />
                  SEND IT AGAIN
                </button>
                <button
                  type="button"
                  onClick={() => {
                    dismissRunnerSummary();
                    setPhase("GARAGE");
                  }}
                  className="inline-flex items-center gap-2 border-2 border-zinc-600 bg-zinc-900 px-5 py-2.5 text-xs font-black uppercase text-white hover:border-[#FFD700] hover:text-[#FFD700]"
                >
                  <Wrench className="h-4 w-4" />
                  Back to Garage Workbench
                </button>
              </div>
            </div>
          </section>
        );
      })()}

      {/* Runner Hero & Active Bike Launchpad */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 border-4 border-[#FFD700] bg-zinc-950 p-5 shadow-[6px_6px_0px_0px_#000] lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 border-2 border-[#FFD700] bg-[#FFD700] px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-black">
              <Flame className="h-3.5 w-3.5" />
              ENDLESS ARCADE MODE
            </span>
            <button
              type="button"
              onClick={() => setShowLeaderboard((v) => !v)}
              className="inline-flex items-center gap-1.5 border-2 border-zinc-700 bg-black px-3 py-1 text-xs font-black uppercase text-zinc-200 hover:border-[#FFD700] hover:text-[#FFD700]"
            >
              <Trophy className="h-3.5 w-3.5 text-[#FFD700]" />
              {showLeaderboard ? "Hide Leaderboard" : "Global Leaderboard"}
            </button>
          </div>

          <div>
            <h2
              className="text-4xl leading-none tracking-wider text-[#FFD700] sm:text-5xl"
              style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
            >
              EAST BAY STREET RUNNER
            </h2>
            <p className="mt-2 text-sm text-zinc-300">
              Take your actual garage build straight into 3-lane Oakland traffic. Dodge cars,
              pop wheelies over potholes &amp; dogs, hit Treatland / 1977 / Myron&apos;s boost
              arches, stack garage cash &amp; rep, and climb the global leaderboard — powered by
              your bike&apos;s <strong className="text-white">real 2-stroke tune</strong>.
            </p>
          </div>

          {/* Active Bike Spec Strip */}
          <div className="border-2 border-zinc-800 bg-black p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span
                  className="h-4 w-4 border-2 border-white"
                  style={{ backgroundColor: bike.colorHex }}
                />
                <div>
                  <div className="text-sm font-black uppercase text-white">
                    {bike.nickname}
                  </div>
                  <div className="text-[11px] font-bold text-zinc-400">
                    {MAKE_NAMES[bike.make]} • Main Jet #{bike.tuning.mainJet}
                  </div>
                </div>
              </div>
              <div className="text-right text-[11px] font-bold text-zinc-400">
                <div>{cylPart?.name ?? "Stock 50cc"}</div>
                <div>
                  {exhaustPart?.name ?? "Stock Pipe"} • {carbPart?.name ?? "Bing 12mm"}
                </div>
              </div>
            </div>
          </div>

          {/* Readiness / Tune Warning */}
          {warnings.length > 0 ? (
            <div className="space-y-1.5 border-2 border-orange-500 bg-orange-950/50 p-3 text-xs font-bold text-orange-100">
              {warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 border-2 border-emerald-500/70 bg-emerald-950/40 p-3 text-xs font-bold text-emerald-200">
              <Gauge className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>
                Your build feels dialed — full speed, crisp wheelies, and clean 2-stroke power ready for traffic!
              </span>
            </div>
          )}

          {/* Launch Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={startRun}
              className="inline-flex flex-1 items-center justify-center gap-2 border-4 border-[#FFD700] bg-[#FFD700] px-6 py-3.5 text-2xl tracking-wider text-black shadow-[5px_5px_0px_0px_#FFF] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-yellow-300"
              style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
            >
              <Play className="h-6 w-6 fill-black" />
              SEND IT — START RUN
            </button>
            <button
              type="button"
              onClick={() => setPhase("GARAGE")}
              className="inline-flex items-center gap-2 border-2 border-zinc-700 bg-black px-4 py-3.5 text-xs font-black uppercase text-zinc-200 hover:border-[#FFD700] hover:text-[#FFD700]"
            >
              <Wrench className="h-4 w-4" />
              Tune in Garage
            </button>
          </div>
        </div>

        {/* How Tune Affects Runner Mode + Controls Card */}
        <div className="space-y-4 border-4 border-zinc-800 bg-zinc-950 p-5 shadow-[6px_6px_0px_0px_#000] lg:col-span-5">
          <h3
            className="text-2xl tracking-wider text-[#FFD700]"
            style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
          >
            WHY YOUR TUNE MATTERS
          </h3>
          <ul className="space-y-2 text-xs text-zinc-300">
            <li className="border-l-2 border-[#FFD700] pl-2.5">
              <strong className="text-white">Real 2-Stroke Physics:</strong> Untuned bikes
              four-stroke, lose top speed, bog on wheelies, slip clutches, or seize if too lean.
            </li>
            <li className="border-l-2 border-cyan-400 pl-2.5">
              <strong className="text-white">Upgrades = Higher Scores:</strong> Pipes, 15mm
              carbs, and 70cc kits push faster speeds &amp; longer wheelies for bigger x4 combos.
            </li>
            <li className="border-l-2 border-emerald-400 pl-2.5">
              <strong className="text-white">Shop Arches:</strong> Pass{" "}
              <span className="text-[#FFD700]">Treatland</span> (Turbo),{" "}
              <span className="text-emerald-400">1977 Mopeds</span> (+1 HP &amp; CHT cool), and{" "}
              <span className="text-cyan-300">Myron&apos;s</span> (Part Magnet).
            </li>
          </ul>

          <div className="border-t-2 border-zinc-800 pt-3">
            <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-zinc-400">
              Controls (Keyboard + Touch Swipe)
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="border border-zinc-800 bg-black p-2">
                <span className="font-black text-[#FFD700]">W / S or ↑ / ↓</span>
                <div className="text-zinc-400">Switch 3 lanes</div>
              </div>
              <div className="border border-zinc-800 bg-black p-2">
                <span className="font-black text-[#FFD700]">SPACE / D / →</span>
                <div className="text-zinc-400">Wheelie ground hazards</div>
              </div>
              <div className="border border-zinc-800 bg-black p-2">
                <span className="font-black text-cyan-300">Q (CLUTCH)</span>
                <div className="text-zinc-400">Save a seizing top end</div>
              </div>
              <div className="border border-zinc-800 bg-black p-2">
                <span className="font-black text-orange-300">B / R</span>
                <div className="text-zinc-400">Coast to cool / Kickstart</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Global Leaderboard Drawer */}
      {showLeaderboard && (
        <RunnerLeaderboard initialMake="all" refreshKey={lbRefreshKey} />
      )}
    </div>
  );
}
