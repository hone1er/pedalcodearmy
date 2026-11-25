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
import {
  PulseSynth,
  loadSimMutedPreference,
} from "@/lib/simulator/audio/pulse-synth";
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
    bikeVerdict,
    lastRunnerSummary,
    setPhase,
    setRunnerPlaying,
    completeRunnerRun,
    dismissRunnerSummary,
  } = useSimStore();

  const bike = getActiveBike(save);

  const [mode, setMode] = useState<"lobby" | "playing">("lobby");
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(() => loadSimMutedPreference());
  const [keyLegendVisible, setKeyLegendVisible] = useState(false);
  const [hud, setHud] = useState<RunnerHudSnapshot | null>(null);
  const [lbRefreshKey, setLbRefreshKey] = useState(0);
  const [padState, setPadState] = useState({
    brake: false,
    clutch: false,
    wheelie: false,
  });

  // Leaderboard submission state
  const [riderName, setRiderName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedRank, setSubmittedRank] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<RunnerRenderer | null>(null);
  const synthRef = useRef<PulseSynth | null>(null);

  const runnerRef = useRef<RunnerState | null>(null);
  const inputRef = useRef<RunnerInput>({ ...NEUTRAL_RUNNER_INPUT });
  const pausedRef = useRef(false);
  const mutedRef = useRef(muted);
  const touchGestureRef = useRef<{
    startX: number;
    startY: number;
    lastSwipeY: number;
    swiped: boolean;
    holdingWheelie: boolean;
    holdTimer: number | null;
  } | null>(null);
  const completeRunnerRunRef = useRef(completeRunnerRun);
  completeRunnerRunRef.current = completeRunnerRun;

  const clearCanvasTouchGesture = useCallback(() => {
    const g = touchGestureRef.current;
    if (!g) return;
    if (g.holdTimer !== null) {
      window.clearTimeout(g.holdTimer);
    }
    if (g.holdingWheelie) {
      inputRef.current.wheelieHeld = false;
      setPadState((s) => (s.wheelie ? { ...s, wheelie: false } : s));
    }
    touchGestureRef.current = null;
  }, []);

  useEffect(() => {
    pausedRef.current = paused;
    synthRef.current?.setPaused(paused);
    if (paused) {
      clearCanvasTouchGesture();
      inputRef.current.brake = false;
      inputRef.current.clutch = false;
      inputRef.current.wheelieHeld = false;
      setPadState({ brake: false, clutch: false, wheelie: false });
    }
  }, [clearCanvasTouchGesture, paused]);

  useEffect(() => {
    mutedRef.current = muted;
    synthRef.current?.setMuted(muted);
  }, [muted]);

  const ensureAudio = useCallback(() => {
    synthRef.current ??= new PulseSynth(mutedRef.current);
    synthRef.current.setMuted(mutedRef.current);
    synthRef.current.unlock();
  }, []);

  const stopAudio = useCallback(() => {
    synthRef.current?.destroy();
    synthRef.current = null;
  }, []);

  // Finalize any active run and clean up audio if RunnerView unmounts mid-run
  useEffect(() => {
    return () => {
      const activeState = runnerRef.current;
      if (activeState) {
        runnerRef.current = null;
        completeRunnerRunRef.current(finalizeRunnerRun(activeState, "aborted"));
      }
      clearCanvasTouchGesture();
      stopAudio();
    };
  }, [clearCanvasTouchGesture, stopAudio]);

  // Auto-fade the 3-second start-of-run key legend overlay
  useEffect(() => {
    if (mode !== "playing" || !keyLegendVisible) return;
    const timer = window.setTimeout(() => {
      setKeyLegendVisible(false);
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [keyLegendVisible, mode]);

  const finishActiveRun = useCallback(
    (overrideReason?: RunnerRunSummary["endReason"]) => {
      const state = runnerRef.current;
      if (!state) return;
      runnerRef.current = null;
      const result = finalizeRunnerRun(
        state,
        overrideReason ?? state.endReason ?? "aborted",
      );
      clearCanvasTouchGesture();
      setPadState({ brake: false, clutch: false, wheelie: false });
      stopAudio();
      setKeyLegendVisible(false);
      setPaused(false);
      setHud(null);
      setMode("lobby");
      setRunnerPlaying(false);
      setSubmittedRank(null);
      setSubmitError(null);
      completeRunnerRun(result);
    },
    [clearCanvasTouchGesture, completeRunnerRun, setRunnerPlaying, stopAudio],
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
    setKeyLegendVisible(true);
    setRunnerPlaying(true);
    setMode("playing");
  }, [dismissRunnerSummary, ensureAudio, save, setRunnerPlaying]);

  // Canvas & 60 Hz Game Loop while playing
  useEffect(() => {
    if (mode !== "playing") return;
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    const renderer = new RunnerRenderer(canvas);
    rendererRef.current = renderer;

    const initialRect = stage.getBoundingClientRect();
    if (initialRect.width > 0 && initialRect.height > 0) {
      renderer.resize(initialRect.width, initialRect.height);
    }

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

          for (const ev of events) {
            switch (ev.type) {
              case "sim":
                synthRef.current?.playEvent(ev.event);
                break;
              case "lane-shift":
                synthRef.current?.playArcade("lane-shift");
                break;
              case "wheelie":
                synthRef.current?.playArcade("wheelie", { strong: ev.strong });
                break;
              case "wheelie-clear":
                synthRef.current?.playArcade("wheelie-clear");
                renderer.spawnBurstAtPlayer(state, "#FFD700", 10);
                break;
              case "close-call":
                synthRef.current?.playArcade("close-call");
                break;
              case "pickup":
                synthRef.current?.playArcade("pickup", {
                  comboStep: ev.comboStep,
                });
                renderer.spawnBurstAtPlayer(state, "#22D3EE", 8);
                break;
              case "shop-arch":
                synthRef.current?.playArcade("shop-arch", { shop: ev.shop });
                renderer.spawnBurstAtPlayer(state, "#4ADE80", 14);
                break;
              case "hit":
                synthRef.current?.playArcade("hit");
                renderer.spawnBurstAtPlayer(state, "#EF4444", 14);
                break;
              case "car-horn":
                synthRef.current?.playArcade("car-horn");
                break;
              case "dog-bark":
                synthRef.current?.playArcade("dog-bark");
                break;
              case "zone-change":
                synthRef.current?.playArcade("zone-change");
                break;
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

      if (e.code === "Escape") {
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
        inputRef.current.wheelieHeld = true;
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
      if (e.code === "Space" || e.code === "ArrowRight" || e.code === "KeyD") {
        inputRef.current.wheelieHeld = false;
      }
      if (e.code === "KeyQ") inputRef.current.clutch = false;
      if (e.code === "KeyB" || e.code === "ShiftLeft" || e.code === "ShiftRight") {
        inputRef.current.brake = false;
      }
    };

    const onBlur = () => {
      inputRef.current.wheelieHeld = false;
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
      <div className="flex h-full w-full min-w-0 flex-col gap-1.5 p-1.5 select-none md:h-auto md:gap-3 md:p-0">
        {/* Mobile Ultra-Compact Arcade HUD Strip */}
        <div className="flex shrink-0 items-center justify-between gap-1.5 border-2 border-[#FFD700] bg-zinc-950 px-2 py-1.5 md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            {/* Score + Combo */}
            <div className="min-w-0">
              <div className="flex items-baseline gap-1">
                <span
                  className="text-base font-black leading-none text-[#FFD700] tabular-nums"
                  style={{ fontFamily: "var(--font-orbitron), Orbitron, monospace" }}
                >
                  {hud.score.toLocaleString()}
                </span>
                <span
                  className={`text-[10px] font-black uppercase ${
                    hud.comboMultiplier >= 3
                      ? "text-[#FFD700]"
                      : hud.comboMultiplier === 2
                        ? "text-cyan-300"
                        : "text-zinc-400"
                  }`}
                >
                  x{hud.comboMultiplier}
                </span>
              </div>
              <div className="mt-0.5 h-1.5 w-16 overflow-hidden border border-zinc-700 bg-black">
                <div
                  className="h-full bg-[#FFD700] transition-all duration-75"
                  style={{ width: `${hud.comboPct}%` }}
                />
              </div>
            </div>

            {/* Hearts */}
            <div
              className="flex items-center gap-0.5 border-l border-zinc-800 pl-2"
              aria-label={`Health ${hud.health} of ${hud.maxHealth}`}
            >
              {Array.from({ length: hud.maxHealth }).map((_, idx) => (
                <Heart
                  key={idx}
                  className={`h-4 w-4 ${
                    idx < hud.health
                      ? "fill-red-500 text-red-500"
                      : "text-zinc-700"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Right: Speed, CHT / Powerup, Mute, Pause, Quit */}
          <div className="flex shrink-0 items-center gap-1">
            {hud.turboSec > 0 && (
              <span className="border border-black bg-[#FFD700] px-1 py-0.5 text-[9px] font-black uppercase text-black">
                TURBO
              </span>
            )}
            {hud.magnetSec > 0 && hud.turboSec <= 0 && (
              <span className="border border-black bg-cyan-400 px-1 py-0.5 text-[9px] font-black uppercase text-black">
                MAG
              </span>
            )}
            {hud.hasChtGauge && hud.chtC >= 180 && (
              <span
                className={`border px-1 py-0.5 text-[9px] font-black tabular-nums ${
                  hud.chtC > 195
                    ? "border-red-500 bg-red-950 text-red-200"
                    : "border-orange-500 bg-black text-orange-300"
                }`}
              >
                {Math.round(hud.chtC)}°C
              </span>
            )}
            <div className="border border-zinc-700 bg-black px-1.5 py-0.5 text-right">
              <span
                className="text-sm font-black text-white tabular-nums"
                style={{ fontFamily: "var(--font-orbitron), Orbitron, monospace" }}
              >
                {Math.round(hud.speedMph)}
              </span>
              <span className="ml-0.5 text-[9px] font-black uppercase text-zinc-400">
                MPH
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                setMuted((m) => !m);
              }}
              aria-label={muted ? "Unmute audio" : "Mute audio"}
              className="flex h-8 w-8 items-center justify-center border-2 border-zinc-700 bg-black text-zinc-200"
            >
              {muted ? (
                <VolumeX className="h-3.5 w-3.5 text-red-400" />
              ) : (
                <Volume2 className="h-3.5 w-3.5 text-[#FFD700]" />
              )}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                setPaused((p) => !p);
              }}
              aria-label={paused ? "Resume run" : "Pause run"}
              className="flex h-8 w-8 items-center justify-center border-2 border-zinc-700 bg-black text-zinc-200"
            >
              {paused ? (
                <Play className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Pause className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                finishActiveRun("aborted");
              }}
              className="flex h-8 items-center border-2 border-zinc-700 bg-zinc-900 px-2 text-[10px] font-black uppercase text-zinc-200"
            >
              Quit
            </button>
          </div>
        </div>

        {/* Desktop Top Arcade HUD Strip */}
        <div className="hidden flex-wrap items-center justify-between gap-2 border-4 border-[#FFD700] bg-zinc-950 px-3 py-2 shadow-[4px_4px_0px_0px_#000] md:flex">
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

            {/* Grade / Headwind Chips */}
            {(Math.abs(hud.gradePct) >= 2 || hud.headwindActive) && (
              <div className="flex flex-wrap items-center gap-1.5 border-l-2 border-zinc-800 pl-3">
                {hud.gradePct >= 2 && (
                  <span className="border-2 border-black bg-orange-500 px-2 py-0.5 text-[10px] font-black uppercase text-black tabular-nums">
                    CLIMB +{Math.round(hud.gradePct)}%
                  </span>
                )}
                {hud.gradePct <= -2 && (
                  <span className="border-2 border-black bg-cyan-400 px-2 py-0.5 text-[10px] font-black uppercase text-black tabular-nums">
                    DOWNHILL {Math.round(hud.gradePct)}%
                  </span>
                )}
                {hud.headwindActive && (
                  <span className="border-2 border-black bg-indigo-400 px-2 py-0.5 text-[10px] font-black uppercase text-black">
                    HEADWIND
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right: Speed, Tach, Powerups & Controls */}
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

            {hud.hasTach && (() => {
              const rpmPct = Math.min(
                100,
                Math.max(0, (hud.rpm / Math.max(1000, hud.maxRpm)) * 100),
              );
              return (
                <div
                  className={`hidden min-w-[92px] border-2 px-2 py-1 transition-colors sm:block ${
                    hud.powerbandActive
                      ? "border-[#FFD700] bg-[#FFD700]/15 text-[#FFD700] shadow-[0_0_12px_rgba(255,215,0,0.45)]"
                      : "border-zinc-700 bg-black text-cyan-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 text-[10px] font-black tabular-nums">
                    <span>{Math.round(hud.rpm)}</span>
                    <span className="text-[9px] opacity-80">RPM</span>
                  </div>
                  <div className="mt-0.5 h-1.5 w-full overflow-hidden bg-zinc-900">
                    <div
                      className={`h-full transition-all duration-75 ${
                        rpmPct > 88
                          ? "bg-red-500"
                          : hud.powerbandActive
                            ? "bg-[#FFD700]"
                            : "bg-cyan-400"
                      }`}
                      style={{ width: `${rpmPct}%` }}
                    />
                  </div>
                </div>
              );
            })()}

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
            if (pausedRef.current) return;
            const t = e.touches[0];
            if (!t) return;
            clearCanvasTouchGesture();
            const holdTimer = window.setTimeout(() => {
              const g = touchGestureRef.current;
              if (!g || g.swiped || pausedRef.current) return;
              g.holdingWheelie = true;
              inputRef.current.wheeliePulse = true;
              inputRef.current.wheelieHeld = true;
              setPadState((s) => ({ ...s, wheelie: true }));
            }, 140);
            touchGestureRef.current = {
              startX: t.clientX,
              startY: t.clientY,
              lastSwipeY: t.clientY,
              swiped: false,
              holdingWheelie: false,
              holdTimer,
            };
          }}
          onTouchMove={(e) => {
            const g = touchGestureRef.current;
            const t = e.touches[0];
            if (!g || !t || pausedRef.current) return;
            const dy = t.clientY - g.lastSwipeY;
            if (Math.abs(dy) >= 22) {
              if (g.holdTimer !== null) {
                window.clearTimeout(g.holdTimer);
                g.holdTimer = null;
              }
              if (g.holdingWheelie) {
                g.holdingWheelie = false;
                inputRef.current.wheelieHeld = false;
                setPadState((s) => (s.wheelie ? { ...s, wheelie: false } : s));
              }
              inputRef.current.laneDir = dy < 0 ? -1 : 1;
              g.swiped = true;
              g.lastSwipeY = t.clientY;
            }
          }}
          onTouchEnd={(e) => {
            const g = touchGestureRef.current;
            const t = e.changedTouches[0];
            if (!g) return;
            const wasSwiped = g.swiped;
            const wasHolding = g.holdingWheelie;
            const startX = g.startX;
            const startY = g.startY;
            clearCanvasTouchGesture();
            if (pausedRef.current || wasSwiped || wasHolding || !t) return;
            const dx = Math.abs(t.clientX - startX);
            const dy = Math.abs(t.clientY - startY);
            if (dx < 24 && dy < 24) {
              inputRef.current.wheeliePulse = true;
            }
          }}
          onTouchCancel={clearCanvasTouchGesture}
          className="relative min-h-0 w-full min-w-0 flex-1 touch-none overflow-hidden border-2 border-black bg-zinc-950 md:h-[440px] md:flex-none md:border-4 md:shadow-[6px_6px_0px_0px_#000]"
        >
          <canvas ref={canvasRef} className="block h-full w-full" />

          {/* Subtle "ON THE PIPE" / Turbo screen-edge glow */}
          {(hud.powerbandActive || hud.turboSec > 0) && !hud.dying && (
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 z-10 transition-opacity duration-200 ${
                hud.turboSec > 0
                  ? "shadow-[inset_0_0_36px_rgba(255,215,0,0.45)]"
                  : "shadow-[inset_0_0_28px_rgba(56,189,248,0.35)]"
              }`}
            />
          )}

          {/* Start-of-Run 3-Second Auto-Fading Key / Touch Legend Pill */}
          {keyLegendVisible && !paused && !hud.seizeActive && !hud.dying && (
            <div className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex justify-center px-2 transition-opacity duration-500 md:bottom-3 md:px-3">
              <div className="border-2 border-[#FFD700] bg-black/85 px-2.5 py-1 text-center text-[10px] font-black uppercase tracking-wide text-[#FFD700] shadow-[3px_3px_0px_#000] md:hidden">
                Swipe Up/Down or Use Pads &bull; Hold Wheelie &bull; Clutch If Hot
              </div>
              <div className="hidden border-2 border-[#FFD700] bg-black/85 px-3 py-1.5 text-center text-[11px] font-black uppercase tracking-wide text-[#FFD700] shadow-[3px_3px_0px_#000] md:block">
                W/S Lanes &bull; Space Hold/Tap Wheelie &bull; Q Clutch &bull; B
                Coast &bull; R Kick &bull; Esc Pause
              </div>
            </div>
          )}

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

          {/* URGENT SEIZE CLUTCH-SAVE TOP-BAND ALERT + EDGE VIGNETTE (lanes stay visible!) */}
          {hud.seizeActive && !hud.dying && (
            <>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-20 animate-pulse border-4 border-red-500 shadow-[inset_0_0_48px_rgba(239,68,68,0.85)]"
              />
              <div className="absolute inset-x-3 top-2 z-30 flex flex-wrap items-center justify-between gap-2 border-4 border-black bg-red-600 px-3 py-2 text-white shadow-[5px_5px_0px_#000]">
                <div className="min-w-[180px] flex-1">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider sm:text-sm">
                    <OctagonAlert className="h-4 w-4 shrink-0 animate-bounce text-[#FFD700]" />
                    <span>ENGINE SEIZING! PULL CLUTCH [Q] NOW!</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden border border-black bg-black">
                    <div
                      className="h-full bg-[#FFD700]"
                      style={{ width: `${seizePct}%` }}
                    />
                  </div>
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
                  onLostPointerCapture={() => {
                    inputRef.current.clutch = false;
                  }}
                  className="touch-none border-[3px] border-black bg-[#FFD700] px-3.5 py-1.5 text-xs font-black uppercase text-black shadow-[3px_3px_0px_#000] active:translate-y-0.5"
                >
                  PULL CLUTCH [Q]
                </button>
              </div>
            </>
          )}

          {/* STALLED PROMPT */}
          {hud.stalled && !hud.seizeActive && !hud.seizedHard && !hud.dying && (
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

        {/* Mobile Dual-Thumb Arcade Gamepad */}
        <div className="grid shrink-0 grid-cols-12 gap-1.5 border-2 border-black bg-[#FFD700] p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] text-black md:hidden">
          {/* Left Thumb: Big Up & Down Lane Pads */}
          <div className="col-span-5 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={(e) => {
                e.preventDefault();
                ensureAudio();
                inputRef.current.laneDir = -1;
              }}
              aria-label="Switch lane up"
              className="flex min-h-[64px] touch-none flex-col items-center justify-center border-[3px] border-black bg-white px-2 py-2 text-xs font-black uppercase shadow-[2px_2px_0px_#000] active:translate-y-0.5 active:bg-zinc-200 active:shadow-none"
            >
              <ArrowUp className="h-6 w-6" />
              <span className="text-[10px]">UP</span>
            </button>
            <button
              type="button"
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={(e) => {
                e.preventDefault();
                ensureAudio();
                inputRef.current.laneDir = 1;
              }}
              aria-label="Switch lane down"
              className="flex min-h-[64px] touch-none flex-col items-center justify-center border-[3px] border-black bg-white px-2 py-2 text-xs font-black uppercase shadow-[2px_2px_0px_#000] active:translate-y-0.5 active:bg-zinc-200 active:shadow-none"
            >
              <ArrowDown className="h-6 w-6" />
              <span className="text-[10px]">DOWN</span>
            </button>
          </div>

          {/* Center: Coast + Clutch (or Kick when stalled) */}
          <div className="col-span-3 flex flex-col gap-1">
            {hud.stalled && !hud.seizeActive && !hud.seizedHard ? (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  ensureAudio();
                  inputRef.current.kickstartPulse = true;
                }}
                className="flex min-h-[30px] flex-1 animate-pulse touch-none items-center justify-center border-2 border-black bg-orange-500 px-1 text-[11px] font-black uppercase text-black"
              >
                KICK!
              </button>
            ) : (
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
                  setPadState((s) => ({ ...s, brake: true }));
                }}
                onPointerUp={() => {
                  inputRef.current.brake = false;
                  setPadState((s) => ({ ...s, brake: false }));
                }}
                onPointerCancel={() => {
                  inputRef.current.brake = false;
                  setPadState((s) => ({ ...s, brake: false }));
                }}
                onLostPointerCapture={() => {
                  inputRef.current.brake = false;
                  setPadState((s) => ({ ...s, brake: false }));
                }}
                className={`flex min-h-[30px] flex-1 touch-none items-center justify-center border-2 border-black px-1 text-[10px] font-black uppercase ${
                  padState.brake
                    ? "bg-zinc-800 text-white"
                    : "bg-zinc-200 text-black"
                }`}
              >
                COAST
              </button>
            )}
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
                setPadState((s) => ({ ...s, clutch: true }));
              }}
              onPointerUp={() => {
                inputRef.current.clutch = false;
                setPadState((s) => ({ ...s, clutch: false }));
              }}
              onPointerCancel={() => {
                inputRef.current.clutch = false;
                setPadState((s) => ({ ...s, clutch: false }));
              }}
              onLostPointerCapture={() => {
                inputRef.current.clutch = false;
                setPadState((s) => ({ ...s, clutch: false }));
              }}
              className={`flex min-h-[30px] flex-1 touch-none items-center justify-center border-2 border-black px-1 text-[10px] font-black uppercase ${
                padState.clutch
                  ? "bg-orange-500 text-black"
                  : hud.seizeActive
                    ? "animate-pulse bg-red-600 text-white"
                    : "bg-cyan-300 text-black"
              }`}
            >
              {hud.seizeActive ? "CLUTCH!" : "CLUTCH"}
            </button>
          </div>

          {/* Right Thumb: Giant Hold/Tap Wheelie Pad */}
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
              inputRef.current.wheeliePulse = true;
              inputRef.current.wheelieHeld = true;
              setPadState((s) => ({ ...s, wheelie: true }));
            }}
            onPointerUp={() => {
              inputRef.current.wheelieHeld = false;
              setPadState((s) => ({ ...s, wheelie: false }));
            }}
            onPointerCancel={() => {
              inputRef.current.wheelieHeld = false;
              setPadState((s) => ({ ...s, wheelie: false }));
            }}
            onLostPointerCapture={() => {
              inputRef.current.wheelieHeld = false;
              setPadState((s) => ({ ...s, wheelie: false }));
            }}
            className={`col-span-4 flex min-h-[64px] touch-none flex-col items-center justify-center border-[3px] border-black px-2 py-2 text-sm font-black uppercase shadow-[2px_2px_0px_#FFF] ${
              padState.wheelie
                ? "translate-y-0.5 bg-emerald-400 text-black shadow-none"
                : "bg-black text-[#FFD700]"
            }`}
          >
            <span className="leading-none">WHEELIE</span>
            <span className="mt-1 text-[9px] font-bold opacity-80">
              TAP / HOLD
            </span>
          </button>
        </div>

        {/* Desktop Arcade Control Deck */}
        <div className="hidden flex-wrap items-center justify-between gap-2 border-4 border-black bg-[#FFD700] p-2.5 text-black shadow-[4px_4px_0px_0px_#000] md:flex">
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
            W/S or ↑/↓ Switch Lanes • Space Hold/Tap Wheelie • Q Clutch Save • B Coast/Cool • R Kick • Esc Pause
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
              onPointerDown={(e) => {
                ensureAudio();
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  // synthetic
                }
                inputRef.current.wheeliePulse = true;
                inputRef.current.wheelieHeld = true;
              }}
              onPointerUp={() => {
                inputRef.current.wheelieHeld = false;
              }}
              onPointerCancel={() => {
                inputRef.current.wheelieHeld = false;
              }}
              onLostPointerCapture={() => {
                inputRef.current.wheelieHeld = false;
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
  if (
    bikeVerdict === "acting-up" &&
    !bike.tuning.killSwitchOn &&
    bike.tuning.hasPremixOil
  ) {
    warnings.push(
      "Last ride showed symptoms — expect sluggish speed, boggy wheelies, or stalling in traffic until you tune it in the Garage.",
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
              {(Boolean(lastRunnerSummary.cleanTuneBonus) ||
                Boolean(lastRunnerSummary.isNewBestDistance)) && (
                <div className="flex flex-wrap gap-2">
                  {lastRunnerSummary.cleanTuneBonus && (
                    <span className="border-2 border-emerald-400 bg-emerald-950/70 px-2.5 py-1 text-xs font-black uppercase text-emerald-200">
                      CLEAN TUNE +25%
                    </span>
                  )}
                  {lastRunnerSummary.isNewBestDistance && (
                    <span className="border-2 border-[#FFD700] bg-[#FFD700]/15 px-2.5 py-1 text-xs font-black uppercase text-[#FFD700]">
                      NEW BEST DISTANCE!
                    </span>
                  )}
                </div>
              )}

              {/* Key Stats Grid */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                {(() => {
                  const engineTop =
                    lastRunnerSummary.engineTopSpeedMph ??
                    lastRunnerSummary.topSpeedMph;
                  const turboNote =
                    lastRunnerSummary.topSpeedMph > engineTop + 1
                      ? `(${lastRunnerSummary.topSpeedMph} mph w/ Turbo)`
                      : undefined;
                  return [
                    {
                      label: "Distance",
                      val: `${lastRunnerSummary.distanceM}m`,
                      accent: "text-white",
                    },
                    {
                      label: "Engine Top Speed",
                      val: `${engineTop} mph`,
                      sub: turboNote,
                      accent: "text-[#FFD700]",
                    },
                    {
                      label: "Max Combo",
                      val: `x${lastRunnerSummary.maxCombo}`,
                      accent: "text-cyan-300",
                    },
                    {
                      label: "Wheelie Clears",
                      val: String(lastRunnerSummary.wheelieClears),
                      accent: "text-orange-300",
                    },
                    {
                      label: "Cash Earned",
                      val: `+$${lastRunnerSummary.cashEarned}`,
                      accent: "text-emerald-400",
                    },
                    {
                      label: "Street Rep",
                      val: `+${lastRunnerSummary.repEarned} REP`,
                      accent: "text-cyan-400",
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="border-2 border-zinc-800 bg-black p-2.5"
                    >
                      <div className="text-[10px] font-black uppercase text-zinc-500">
                        {s.label}
                      </div>
                      <div
                        className={`mt-1 text-base font-black tabular-nums ${s.accent}`}
                        style={{
                          fontFamily: "var(--font-orbitron), Orbitron, monospace",
                        }}
                      >
                        {s.val}
                      </div>
                      {"sub" in s && s.sub && (
                        <div className="mt-0.5 text-[10px] font-bold text-zinc-400">
                          {s.sub}
                        </div>
                      )}
                    </div>
                  ));
                })()}
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

          {/* Readiness / Tune Banner (derived purely from road-tested verdict) */}
          {warnings.length > 0 ? (
            <div className="space-y-1.5 border-2 border-orange-500 bg-orange-950/50 p-3 text-xs font-bold text-orange-100">
              {warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          ) : bikeVerdict === "untested" ? (
            <div className="flex items-center gap-2 border-2 border-cyan-500/70 bg-cyan-950/40 p-3 text-xs font-bold text-cyan-200">
              <Gauge className="h-4 w-4 shrink-0 text-cyan-400" />
              <span>
                Untested setup — send it down the avenue to see how this build pulls under load!
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 border-2 border-emerald-500/70 bg-emerald-950/40 p-3 text-xs font-bold text-emerald-200">
              <Gauge className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>
                Ran clean on last road test — full speed, crisp wheelies, and clean 2-stroke power ready for traffic!
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
