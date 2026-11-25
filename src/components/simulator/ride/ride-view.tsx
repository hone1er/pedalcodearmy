"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  Coffee,
  Ear,
  Flame,
  Fuel,
  Gauge,
  Lock,
  MapPin,
  OctagonAlert,
  RotateCcw,
  Truck,
  Volume2,
  VolumeX,
  Wrench,
  Zap,
} from "lucide-react";
import { CaptionLayer } from "@/components/simulator/hud/caption-layer";
import {
  PulseSynth,
  loadSimMutedPreference,
} from "@/lib/simulator/audio/pulse-synth";
import type {
  RideInput,
  RideTelemetrySnapshot,
  SimEvent,
} from "@/lib/simulator/contract";
import { SEIZE_CLUTCH_WINDOW_MS } from "@/lib/simulator/engine/engine-sim";
import { RideRenderer } from "@/lib/simulator/render/ride-renderer";
import { TOW_COST } from "@/lib/simulator/ride/ride-sim";
import { simStore, useSimStore } from "@/lib/simulator/store/sim-store";

interface HeldControls {
  throttleHeld: boolean;
  throttleLocked: boolean;
  brake: boolean;
  tuck: boolean;
  clutch: boolean;
  killSwitch: boolean;
  choke: boolean;
}

function isEditableOrDialogTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  if (target.closest('[role="dialog"]')) return true;
  return false;
}

function formatMiles(meters: number): string {
  return (meters / 1609.34).toFixed(2);
}

function describeStallReason(
  reason: RideTelemetrySnapshot["stallReason"],
  seizedHard: boolean,
): string {
  if (seizedHard) {
    return "PISTON SEIZED SOLID — ENGINE LOCKED ON THE CURB.";
  }
  switch (reason) {
    case "fuel":
      return "STARVED FOR FUEL — CHECK PETCOCK/FLOW OR CHOKE TO TEST.";
    case "spark":
      return "LOST SPARK — PLUG FOULED OR IGNITION DROPPED OUT.";
    case "idle":
      return "DIED AT IDLE — NEEDS THROTTLE BLIP OR IDLE SCREW TWEAK.";
    case "plug-chop":
      return "PLUG CHOP COMPLETE — COASTED CLEANLY TO THE CURB!";
    case "kill-switch":
      return "KILL SWITCH CUT — Cut ignition below wide-open throttle — kick it [R] to fire back up, or hold [K] at full throttle for a true plug chop.";
    default:
      return "ENGINE STALLED — KICKSTART IT OR HEAD BACK TO THE GARAGE.";
  }
}

export function RideView() {
  const {
    save,
    ride,
    setRideInput,
    toggleListenMode,
    triggerPedalPulse,
    triggerKickstart,
    startPedalingHome,
    callTowTruck,
    abortRideToGarage,
  } = useSimStore();

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<RideRenderer | null>(null);
  const synthRef = useRef<PulseSynth | null>(null);

  const rideRef = useRef<RideTelemetrySnapshot | null>(ride);
  rideRef.current = ride;

  const heldRef = useRef<HeldControls>({
    throttleHeld: false,
    throttleLocked: false,
    brake: false,
    tuck: false,
    clutch: false,
    killSwitch: false,
    choke: Boolean(ride?.choke),
  });
  const syncedRideKeyRef = useRef<string | null>(
    ride?.active ? ride.routeId : null,
  );
  const throttleValRef = useRef(0);
  const lastSentRef = useRef<Omit<RideInput, "pedalPulse" | "kickstartPulse">>({
    throttle: 0,
    brake: false,
    tuck: false,
    choke: false,
    clutch: false,
    killSwitch: false,
  });

  const [isMuted, setIsMuted] = useState(() => loadSimMutedPreference());
  const [touchState, setTouchState] = useState({
    throttle: false,
    throttleLocked: false,
    brake: false,
    tuck: false,
    clutch: false,
    killSwitch: false,
  });

  const unlockAudio = useCallback(() => {
    synthRef.current?.unlock();
  }, []);

  const syncControlInput = useCallback(
    (force = false) => {
      const held = heldRef.current;
      const throttle = Math.round(throttleValRef.current * 100) / 100;
      const prev = lastSentRef.current;
      const boundaryHit =
        (throttle === 0 && prev.throttle !== 0) ||
        (throttle === 1 && prev.throttle !== 1);

      if (
        force ||
        boundaryHit ||
        Math.abs(prev.throttle - throttle) >= 0.02 ||
        prev.brake !== held.brake ||
        prev.tuck !== held.tuck ||
        prev.choke !== held.choke ||
        prev.clutch !== held.clutch ||
        prev.killSwitch !== held.killSwitch
      ) {
        lastSentRef.current = {
          throttle,
          brake: held.brake,
          tuck: held.tuck,
          choke: held.choke,
          clutch: held.clutch,
          killSwitch: held.killSwitch,
        };
        setRideInput(lastSentRef.current);
      }
    },
    [setRideInput],
  );

  // Sync local choke mirror only when a new ride starts (never overwrite mid-ride)
  useEffect(() => {
    const nextKey = ride?.active ? ride.routeId : null;
    if (nextKey && syncedRideKeyRef.current !== nextKey) {
      heldRef.current.choke = ride?.choke ?? false;
    }
    syncedRideKeyRef.current = nextKey;
  }, [ride?.active, ride?.routeId, ride?.choke]);

  const handleToggleMute = useCallback(() => {
    unlockAudio();
    if (synthRef.current) {
      setIsMuted(synthRef.current.toggleMute());
    } else {
      setIsMuted((prev) => !prev);
    }
  }, [unlockAudio]);

  const handleToggleChoke = useCallback(() => {
    unlockAudio();
    heldRef.current.choke = !heldRef.current.choke;
    syncControlInput(true);
  }, [syncControlInput, unlockAudio]);

  const handleKickstart = useCallback(() => {
    unlockAudio();
    triggerKickstart();
  }, [triggerKickstart, unlockAudio]);

  const handlePedalPulse = useCallback(() => {
    unlockAudio();
    triggerPedalPulse();
  }, [triggerPedalPulse, unlockAudio]);

  const handleStartPedalingHome = useCallback(() => {
    unlockAudio();
    startPedalingHome();
  }, [startPedalingHome, unlockAudio]);

  const handleToggleListen = useCallback(() => {
    unlockAudio();
    if (rideRef.current?.hasStethoscope) {
      toggleListenMode();
    }
  }, [toggleListenMode, unlockAudio]);

  const handleToggleThrottleLock = useCallback(() => {
    unlockAudio();
    const next = !heldRef.current.throttleLocked;
    heldRef.current.throttleLocked = next;
    setTouchState((s) => ({ ...s, throttleLocked: next }));
  }, [unlockAudio]);

  const handleToggleTuck = useCallback(() => {
    unlockAudio();
    const next = !heldRef.current.tuck;
    heldRef.current.tuck = next;
    setTouchState((s) => ({ ...s, tuck: next }));
    syncControlInput(true);
  }, [syncControlInput, unlockAudio]);

  // Initialize Canvas 2D Renderer, PulseSynth, ResizeObserver, event subscription & 60fps loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas) return;

    const renderer = new RideRenderer(canvas);
    const synth = new PulseSynth(loadSimMutedPreference());
    rendererRef.current = renderer;
    synthRef.current = synth;

    const handleResize = () => {
      if (stage) {
        const rect = stage.getBoundingClientRect();
        renderer.resize(rect.width, canvas.clientHeight || rect.height);
      } else {
        renderer.resize();
      }
    };

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && stage) {
      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          renderer.resize(
            entry.contentRect.width,
            canvas.clientHeight || entry.contentRect.height,
          );
        } else {
          handleResize();
        }
      });
      resizeObserver.observe(stage);
    }
    window.addEventListener("resize", handleResize);
    handleResize();

    const unsubscribeEvents = simStore.subscribeEvents((ev: SimEvent) => {
      synth.playEvent(ev);
      if (ev.type === "pothole-bump") {
        renderer.triggerShake(7.5);
      } else if (ev.type === "seize-start") {
        renderer.triggerShake(11);
      } else if (ev.type === "seize-crash") {
        renderer.triggerShake(16);
      }
    });

    let rafId = 0;
    let lastTime = performance.now();

    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      // Smoothly ramp throttle 0..1 when held or WOT-locked
      const throttleActive =
        heldRef.current.throttleHeld || heldRef.current.throttleLocked;
      const targetThrottle = throttleActive ? 1 : 0;
      const rate = throttleActive ? 4.2 : 5.2;
      if (throttleValRef.current < targetThrottle) {
        throttleValRef.current = Math.min(
          1,
          throttleValRef.current + dt * rate,
        );
      } else if (throttleValRef.current > targetThrottle) {
        throttleValRef.current = Math.max(
          0,
          throttleValRef.current - dt * rate,
        );
      }
      syncControlInput(false);

      const latest = simStore.getLatestRideSnapshot() ?? rideRef.current;
      if (latest) {
        renderer.render(latest, dt);
        synth.update(latest);
      } else {
        synth.update(null);
      }

      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleResize);
      unsubscribeEvents();
      renderer.destroy();
      synth.destroy();
      rendererRef.current = null;
      synthRef.current = null;
    };
  }, [syncControlInput]);

  // Pause synth on background tab or inactive ride
  useEffect(() => {
    const syncAudioPause = () => {
      synthRef.current?.setPaused(document.hidden || !rideRef.current?.active);
    };
    syncAudioPause();
    document.addEventListener("visibilitychange", syncAudioPause);
    return () => {
      document.removeEventListener("visibilitychange", syncAudioPause);
    };
  }, [ride?.active]);

  const resetHeldControls = useCallback(
    (updateReactState = true) => {
      const hadHeld =
        heldRef.current.throttleHeld ||
        heldRef.current.throttleLocked ||
        heldRef.current.brake ||
        heldRef.current.tuck ||
        heldRef.current.clutch ||
        heldRef.current.killSwitch ||
        throttleValRef.current !== 0;

      heldRef.current.throttleHeld = false;
      heldRef.current.throttleLocked = false;
      heldRef.current.brake = false;
      heldRef.current.tuck = false;
      heldRef.current.clutch = false;
      heldRef.current.killSwitch = false;
      throttleValRef.current = 0;

      if (updateReactState && hadHeld) {
        setTouchState({
          throttle: false,
          throttleLocked: false,
          brake: false,
          tuck: false,
          clutch: false,
          killSwitch: false,
        });
      }
      if (hadHeld) {
        syncControlInput(true);
      }
    },
    [syncControlInput],
  );

  // Clear held controls when ride ends
  useEffect(() => {
    if (!ride?.active) {
      resetHeldControls(true);
    }
  }, [ride?.active, resetHeldControls]);

  // Keyboard controls (ignoring inputs & aria-modal dialogs, clearing held keys on modal/unmount)
  useEffect(() => {
    const hasOpenModal = () =>
      Boolean(document.querySelector('[role="dialog"][aria-modal="true"]'));

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (hasOpenModal() || !rideRef.current?.active) {
        resetHeldControls(true);
        return;
      }
      if (isEditableOrDialogTarget(e.target)) return;

      unlockAudio();
      const key = e.key.toLowerCase();

      if (key === "w" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!heldRef.current.throttleHeld) {
          heldRef.current.throttleHeld = true;
          setTouchState((s) => ({ ...s, throttle: true }));
        }
      } else if (key === "s" || e.key === "ArrowDown") {
        e.preventDefault();
        if (!heldRef.current.brake || heldRef.current.throttleLocked) {
          heldRef.current.brake = true;
          heldRef.current.throttleLocked = false;
          setTouchState((s) => ({ ...s, brake: true, throttleLocked: false }));
          syncControlInput(true);
        }
      } else if (e.code === "Space") {
        e.preventDefault();
        if (!heldRef.current.tuck) {
          heldRef.current.tuck = true;
          setTouchState((s) => ({ ...s, tuck: true }));
          syncControlInput(true);
        }
      } else if (key === "q") {
        e.preventDefault();
        if (!heldRef.current.clutch) {
          heldRef.current.clutch = true;
          setTouchState((s) => ({ ...s, clutch: true }));
          syncControlInput(true);
        }
      } else if (key === "k") {
        e.preventDefault();
        if (!heldRef.current.killSwitch) {
          heldRef.current.killSwitch = true;
          setTouchState((s) => ({ ...s, killSwitch: true }));
          syncControlInput(true);
        }
      } else if (key === "c" && !e.repeat) {
        e.preventDefault();
        handleToggleChoke();
      } else if (key === "p") {
        e.preventDefault();
        if (!e.repeat) {
          handlePedalPulse();
        }
      } else if (key === "r" && !e.repeat) {
        e.preventDefault();
        handleKickstart();
      } else if (key === "l" && !e.repeat) {
        e.preventDefault();
        handleToggleListen();
      } else if (key === "m" && !e.repeat) {
        e.preventDefault();
        handleToggleMute();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (isEditableOrDialogTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === "w" || e.key === "ArrowUp") {
        if (heldRef.current.throttleHeld) {
          heldRef.current.throttleHeld = false;
          setTouchState((s) => ({ ...s, throttle: false }));
        }
      } else if (key === "s" || e.key === "ArrowDown") {
        if (heldRef.current.brake) {
          heldRef.current.brake = false;
          setTouchState((s) => ({ ...s, brake: false }));
          syncControlInput(true);
        }
      } else if (e.code === "Space") {
        if (heldRef.current.tuck) {
          heldRef.current.tuck = false;
          setTouchState((s) => ({ ...s, tuck: false }));
          syncControlInput(true);
        }
      } else if (key === "q") {
        if (heldRef.current.clutch) {
          heldRef.current.clutch = false;
          setTouchState((s) => ({ ...s, clutch: false }));
          syncControlInput(true);
        }
      } else if (key === "k") {
        if (heldRef.current.killSwitch) {
          heldRef.current.killSwitch = false;
          setTouchState((s) => ({ ...s, killSwitch: false }));
          syncControlInput(true);
        }
      }
    };

    const onBlur = () => resetHeldControls(true);

    let modalObserver: MutationObserver | null = null;
    if (typeof MutationObserver !== "undefined" && document.body) {
      modalObserver = new MutationObserver(() => {
        if (hasOpenModal()) {
          resetHeldControls(true);
        }
      });
      modalObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["role", "aria-modal"],
      });
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      modalObserver?.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      resetHeldControls(false);
    };
  }, [
    handleKickstart,
    handlePedalPulse,
    handleToggleChoke,
    handleToggleListen,
    handleToggleMute,
    resetHeldControls,
    syncControlInput,
    unlockAudio,
  ]);

  const setHoldButton = (
    control: "throttle" | "brake" | "tuck" | "clutch" | "killSwitch",
    pressed: boolean,
  ) => {
    unlockAudio();
    if (control === "throttle") {
      heldRef.current.throttleHeld = pressed;
      // Pressing throttle while WOT-locked releases lock cleanly on release
      if (!pressed && heldRef.current.throttleLocked) {
        heldRef.current.throttleLocked = false;
        setTouchState((s) => ({
          ...s,
          throttle: false,
          throttleLocked: false,
        }));
        return;
      }
    } else if (control === "brake") {
      heldRef.current.brake = pressed;
      if (pressed && heldRef.current.throttleLocked) {
        heldRef.current.throttleLocked = false;
        setTouchState((s) => ({ ...s, brake: true, throttleLocked: false }));
        syncControlInput(true);
        return;
      }
      syncControlInput(true);
    } else if (control === "killSwitch") {
      heldRef.current.killSwitch = pressed;
      // After releasing a WOT plug chop, also drop WOT lock so the bike coasts cleanly to the curb
      if (!pressed && heldRef.current.throttleLocked) {
        heldRef.current.throttleLocked = false;
        setTouchState((s) => ({
          ...s,
          killSwitch: false,
          throttleLocked: false,
        }));
        syncControlInput(true);
        return;
      }
      syncControlInput(true);
    } else {
      heldRef.current[control] = pressed;
      syncControlInput(true);
    }
    setTouchState((s) => ({ ...s, [control]: pressed }));
  };

  const handleHoldPointerDown = (
    control: "throttle" | "brake" | "tuck" | "clutch" | "killSwitch",
    e: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore synthetic pointerId */
    }
    setHoldButton(control, true);
  };

  const handleHoldPointerRelease = (
    control: "throttle" | "brake" | "tuck" | "clutch" | "killSwitch",
    e: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (
      e.type === "pointerleave" &&
      typeof e.currentTarget.hasPointerCapture === "function"
    ) {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) return;
      } catch {
        /* ignore */
      }
    }
    setHoldButton(control, false);
  };

  if (!ride) {
    return (
      <div className="flex min-h-[420px] items-center justify-center border-4 border-black bg-zinc-950 p-6 text-[#FFD700] shadow-[6px_6px_0px_#000]">
        <p className="text-lg font-black uppercase tracking-wide">
          Rolling moped onto the street...
        </p>
      </div>
    );
  }

  const progressPct = Math.min(
    100,
    Math.max(0, (ride.distanceM / Math.max(1, ride.routeLengthM)) * 100),
  );
  const rpmPct = Math.min(
    100,
    Math.max(0, (ride.rpm / Math.max(1000, ride.maxRpm)) * 100),
  );
  const chtPct = Math.min(100, Math.max(0, ((ride.chtC - 40) / 200) * 100));
  const showRoadsideBar = (ride.stalled || ride.seizedHard) && !ride.pedalingHome;
  const canAffordTow = save.cash >= TOW_COST;
  const seizeUrgent = ride.seizeActive && ride.seizeClutchWindowMs > 0;
  const seizePct = Math.min(
    100,
    Math.max(0, (ride.seizeClutchWindowMs / SEIZE_CLUTCH_WINDOW_MS) * 100),
  );

  return (
    <div
      onPointerDown={unlockAudio}
      className="flex h-full w-full min-w-0 flex-col gap-1.5 p-1.5 select-none md:h-auto md:gap-3 md:p-0"
    >
      {/* Mobile Ultra-Compact Top Telemetry Bar */}
      <div className="flex shrink-0 items-center justify-between gap-1.5 border-2 border-[#FFD700] bg-zinc-950 px-2 py-1.5 text-white md:hidden">
        {/* Speed + Grade */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-baseline gap-0.5 border border-zinc-700 bg-black px-2 py-0.5">
            <span
              className={`text-lg font-black leading-none tabular-nums ${
                ride.powerbandActive ? "text-[#FFD700]" : "text-white"
              }`}
              style={{ fontFamily: "var(--font-orbitron), Orbitron, monospace" }}
            >
              {Math.round(ride.speedMph)}
            </span>
            <span className="text-[9px] font-black uppercase text-zinc-400">
              MPH
            </span>
          </div>
          <span
            className={`px-1.5 py-0.5 text-[10px] font-black uppercase tabular-nums ${
              ride.gradePct >= 6
                ? "bg-orange-500 text-black"
                : ride.gradePct <= -3
                  ? "bg-cyan-400 text-black"
                  : "bg-zinc-800 text-zinc-300"
            }`}
          >
            {ride.gradePct > 0 ? `+${ride.gradePct}` : ride.gradePct}%
          </span>
          {ride.hasChtGauge && (
            <span
              className={`border px-1.5 py-0.5 text-[10px] font-black tabular-nums ${
                ride.chtC >= 205
                  ? "border-red-500 bg-red-950 text-red-200"
                  : ride.chtC >= 175
                    ? "border-orange-500 bg-orange-950/60 text-orange-300"
                    : "border-zinc-700 bg-black text-emerald-300"
              }`}
            >
              {Math.round(ride.chtC)}°C
            </span>
          )}
          {ride.hasTach && !ride.hasChtGauge && (
            <span className="border border-zinc-700 bg-black px-1.5 py-0.5 text-[10px] font-black text-cyan-300 tabular-nums">
              {(ride.rpm / 1000).toFixed(1)}k
            </span>
          )}
        </div>

        {/* Mini Route Progress */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-1">
          <div className="flex items-center justify-between gap-1 text-[9px] font-black uppercase">
            <span className="truncate text-[#FFD700]">{ride.routeName}</span>
            <span className="shrink-0 text-zinc-300 tabular-nums">
              {Math.round(progressPct)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden border border-black bg-zinc-800">
            <div
              className="h-full bg-[#FFD700] transition-all duration-150"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Audio & Exit */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              handleToggleMute();
            }}
            aria-label={isMuted ? "Unmute audio" : "Mute audio"}
            className="flex h-8 w-8 items-center justify-center border-2 border-zinc-700 bg-black text-white"
          >
            {isMuted ? (
              <VolumeX className="h-3.5 w-3.5 text-red-400" />
            ) : (
              <Volume2 className="h-3.5 w-3.5 text-[#FFD700]" />
            )}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              abortRideToGarage();
            }}
            aria-label="Back to Garage"
            className="flex h-8 items-center gap-1 border-2 border-black bg-zinc-200 px-2 text-[10px] font-black uppercase text-black"
          >
            <Wrench className="h-3.5 w-3.5" />
            <span>Exit</span>
          </button>
        </div>
      </div>

      {/* Desktop Top Route & Telemetry Bar */}
      <div className="hidden min-w-0 flex-wrap items-center justify-between gap-2 border-4 border-black bg-zinc-950 px-3 py-2.5 text-white shadow-[5px_5px_0px_#000] md:flex">
        <div className="flex flex-wrap items-center gap-2">
          <span className="border-2 border-black bg-[#FFD700] px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-black">
            {ride.routeName}
          </span>
          {ride.landmark && (
            <span className="inline-flex items-center gap-1 border-2 border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs font-bold text-cyan-300">
              <MapPin className="h-3.5 w-3.5" />
              {ride.landmark}
            </span>
          )}
          <span
            className={`border-2 border-black px-2 py-0.5 text-xs font-black uppercase ${
              ride.gradePct >= 6
                ? "bg-orange-500 text-black"
                : ride.gradePct <= -3
                  ? "bg-cyan-400 text-black"
                  : "bg-zinc-800 text-zinc-200"
            }`}
          >
            GRADE {ride.gradePct > 0 ? `+${ride.gradePct}` : ride.gradePct}%
          </span>
        </div>

        {/* Route Progress */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:min-w-[190px] sm:max-w-xs">
          <div className="h-4 flex-1 overflow-hidden border-2 border-black bg-zinc-800">
            <div
              className="h-full bg-[#FFD700] transition-all duration-150"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="whitespace-nowrap text-xs font-black text-[#FFD700]">
            {formatMiles(ride.distanceM)} / {formatMiles(ride.routeLengthM)} mi
          </span>
        </div>

        {/* Quick Audio, Stethoscope & Garage Exit */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              handleToggleListen();
            }}
            disabled={!ride.hasStethoscope}
            title={
              ride.hasStethoscope
                ? "Toggle Stethoscope Listen Mode [L]"
                : "Buy Mechanic's Stethoscope in Shop to isolate engine knock"
            }
            className={`inline-flex items-center gap-1 border-2 border-black px-2.5 py-1 text-xs font-black uppercase transition ${
              !ride.hasStethoscope
                ? "cursor-not-allowed bg-zinc-800 text-zinc-500"
                : ride.listenMode
                  ? "bg-cyan-400 text-black shadow-[2px_2px_0px_#000]"
                  : "bg-zinc-800 text-white hover:bg-zinc-700"
            }`}
          >
            <Ear className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {ride.hasStethoscope ? "Listen [L]" : "Steth: Shop"}
            </span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              handleToggleMute();
            }}
            title="Mute / Unmute Synth [M]"
            className="inline-flex items-center gap-1 border-2 border-black bg-zinc-800 px-2.5 py-1 text-xs font-black uppercase text-white hover:bg-zinc-700"
          >
            {isMuted ? (
              <VolumeX className="h-3.5 w-3.5 text-red-400" />
            ) : (
              <Volume2 className="h-3.5 w-3.5 text-[#FFD700]" />
            )}
            <span className="hidden sm:inline">[M]</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              abortRideToGarage();
            }}
            className="inline-flex items-center gap-1 border-2 border-black bg-zinc-200 px-2.5 py-1 text-xs font-black uppercase text-black hover:bg-white"
          >
            <Wrench className="h-3.5 w-3.5" />
            Garage
          </button>
        </div>
      </div>

      {/* Main Canvas Stage + Overlays */}
      <div
        ref={stageRef}
        className="relative min-h-0 w-full min-w-0 flex-1 overflow-hidden border-2 border-black bg-zinc-950 md:flex-none md:border-4 md:shadow-[6px_6px_0px_#000]"
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full md:h-[420px]"
        />

        {/* Comic-book Sound & Symptom Captions */}
        <CaptionLayer captions={ride.captions} />

        {/* Stoplight Indicator */}
        {(ride.atStoplight || ride.stoplightRedSec > 0) && (
          <div className="pointer-events-none absolute top-2 left-2 z-20 flex max-w-[68%] items-center gap-1.5 border-2 border-black bg-black/90 px-2 py-1 shadow-[3px_3px_0px_#000] md:top-3 md:left-3 md:max-w-none md:gap-2 md:border-[3px] md:px-3 md:py-1.5">
            <span
              className={`h-3 w-3 shrink-0 rounded-full border-2 border-black md:h-3.5 md:w-3.5 ${
                ride.stoplightRedSec > 0
                  ? "animate-pulse bg-red-500"
                  : "bg-green-400"
              }`}
            />
            <span className="text-[10px] font-black uppercase tracking-wide text-white md:text-xs">
              {ride.stoplightRedSec > 0
                ? `RED LIGHT — EASE OFF (${ride.stoplightRedSec.toFixed(1)}s)`
                : "GREEN LIGHT — SEND IT!"}
            </span>
          </div>
        )}

        {/* Telegraph Coffee Cup Status */}
        {ride.coffeeTempPct !== null && (
          <div className="pointer-events-none absolute top-2 right-2 z-20 flex items-center gap-1.5 border-2 border-black bg-amber-950/90 px-2 py-1 text-white shadow-[3px_3px_0px_#000] md:top-3 md:right-3 md:gap-2.5 md:border-[3px] md:px-3 md:py-1.5">
            <Coffee className="h-3.5 w-3.5 text-[#FFD700] md:h-4 md:w-4" />
            <div className="text-[10px] font-black uppercase leading-tight md:text-[11px]">
              <div className="text-[#FFD700]">
                {Math.round(ride.coffeeTempPct)}% Hot
              </div>
              <div className="text-orange-300">
                Spill {Math.round(ride.coffeeSpillPct ?? 0)}%
              </div>
            </div>
          </div>
        )}

        {/* Seize Pre-Warning Badge */}
        {ride.seizeWarning && !seizeUrgent && (
          <div className="pointer-events-none absolute top-12 right-2 z-20 max-w-[calc(100%-1rem)] border-2 border-black bg-orange-500 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-black shadow-[3px_3px_0px_#000] md:top-16 md:right-3 md:border-[3px] md:px-3 md:text-xs">
            <span className="inline-flex items-center gap-1">
              <Flame className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4" />
              HOT — PULL CLUTCH OR EASE GAS!
            </span>
          </div>
        )}

        {/* URGENT SEIZE CLUTCH-SAVE ALERT */}
        {seizeUrgent && (
          <div className="absolute inset-x-2 top-1/2 z-30 -translate-y-1/2 border-4 border-black bg-red-600 p-3 text-center text-white shadow-[6px_6px_0px_#000] sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 md:p-4">
            <div className="flex items-center justify-center gap-2 text-base font-black uppercase tracking-wider sm:text-2xl">
              <OctagonAlert className="h-5 w-5 animate-bounce text-[#FFD700] sm:h-7 sm:w-7" />
              <span>ENGINE SEIZING! PULL CLUTCH NOW!</span>
            </div>
            <div className="mt-1.5 h-2.5 w-full overflow-hidden border-2 border-black bg-black md:mt-2 md:h-3">
              <div
                className="h-full bg-[#FFD700]"
                style={{ width: `${seizePct}%` }}
              />
            </div>
            <button
              type="button"
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={(e) => handleHoldPointerDown("clutch", e)}
              onPointerUp={(e) => handleHoldPointerRelease("clutch", e)}
              onPointerLeave={(e) => handleHoldPointerRelease("clutch", e)}
              onPointerCancel={(e) => handleHoldPointerRelease("clutch", e)}
              onLostPointerCapture={() => setHoldButton("clutch", false)}
              className="mt-2.5 min-h-[48px] w-full touch-none border-[3px] border-black bg-[#FFD700] px-4 py-2 text-sm font-black uppercase tracking-wider text-black shadow-[4px_4px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] md:mt-3 md:text-base"
            >
              HOLD CLUTCH — SAVE THE TOP END!
            </button>
          </div>
        )}

        {/* Pedaling Home Active Banner */}
        {ride.pedalingHome && (
          <div className="absolute inset-x-2 bottom-2 z-20 flex flex-wrap items-center justify-between gap-2 border-[3px] border-black bg-[#FFD700] px-2.5 py-2 text-black shadow-[4px_4px_0px_#000] md:inset-x-3 md:bottom-3 md:px-3">
            <div>
              <div className="text-xs font-black uppercase md:text-sm">
                PEDALING HOME — TAP PEDAL IN RHYTHM!
              </div>
              <div className="text-[11px] font-bold md:text-xs">
                {Math.max(0, Math.round(ride.pedalHomeRemainingM))}m left •
                Stamina {Math.round(ride.stamina)}%
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                handlePedalPulse();
              }}
              className="min-h-[40px] border-2 border-black bg-black px-3.5 py-1.5 text-xs font-black uppercase text-[#FFD700] active:scale-95"
            >
              PEDAL!
            </button>
          </div>
        )}

        {/* Roadside / Stalled Action Bar */}
        {showRoadsideBar && (
          <div className="absolute inset-x-2 bottom-2 z-20 border-[3px] border-black bg-zinc-950/95 p-2.5 text-white shadow-[5px_5px_0px_#000] md:inset-x-3 md:bottom-3 md:p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
              <p className="text-[11px] font-black uppercase tracking-wide text-[#FFD700] sm:text-sm">
                {describeStallReason(ride.stallReason, ride.seizedHard)}
              </p>
              <span className="text-[11px] font-bold text-zinc-400">
                Cash: ${save.cash}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 md:gap-2">
              {!ride.seizedHard && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    handleKickstart();
                  }}
                  className="inline-flex min-h-[42px] items-center justify-center gap-1.5 border-2 border-black bg-[#FFD700] px-2.5 py-2 text-xs font-black uppercase text-black shadow-[2px_2px_0px_#000] hover:bg-yellow-300"
                >
                  <RotateCcw className="h-4 w-4 shrink-0" />
                  <span>Kickstart</span>
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleStartPedalingHome();
                }}
                className="inline-flex min-h-[42px] items-center justify-center gap-1.5 border-2 border-black bg-cyan-400 px-2.5 py-2 text-xs font-black uppercase text-black shadow-[2px_2px_0px_#000] hover:bg-cyan-300"
              >
                <Zap className="h-4 w-4 shrink-0" />
                <span>Pedal Home</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  callTowTruck();
                }}
                disabled={!canAffordTow}
                className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 border-2 border-black px-2.5 py-2 text-xs font-black uppercase shadow-[2px_2px_0px_#000] ${
                  canAffordTow
                    ? "bg-orange-400 text-black hover:bg-orange-300"
                    : "cursor-not-allowed bg-zinc-800 text-zinc-500"
                }`}
              >
                <Truck className="h-4 w-4 shrink-0" />
                <span>Tow (${TOW_COST})</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  abortRideToGarage();
                }}
                className="inline-flex min-h-[42px] items-center justify-center gap-1.5 border-2 border-black bg-zinc-200 px-2.5 py-2 text-xs font-black uppercase text-black shadow-[2px_2px_0px_#000] hover:bg-white"
              >
                <Wrench className="h-4 w-4 shrink-0" />
                <span>Garage</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Secondary Utility Strip (WOT Lock, Tuck, Choke, Plug Chop, Kick, Listen) */}
      <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto bg-zinc-950 px-1 py-1 md:hidden">
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            handleToggleThrottleLock();
          }}
          aria-pressed={touchState.throttleLocked}
          className={`min-h-[38px] shrink-0 touch-none border-2 px-2.5 text-[11px] font-black uppercase ${
            touchState.throttleLocked
              ? "border-[#FFD700] bg-[#FFD700] text-black"
              : "border-zinc-700 bg-black text-zinc-200"
          }`}
        >
          {touchState.throttleLocked ? "WOT: ON" : "WOT Lock"}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            handleToggleTuck();
          }}
          aria-pressed={touchState.tuck || ride.tuck}
          className={`min-h-[38px] shrink-0 touch-none border-2 px-2.5 text-[11px] font-black uppercase ${
            touchState.tuck || ride.tuck
              ? "border-emerald-400 bg-emerald-400 text-black"
              : "border-zinc-700 bg-black text-zinc-200"
          }`}
        >
          Tuck {touchState.tuck || ride.tuck ? "ON" : "OFF"}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            handleToggleChoke();
          }}
          aria-pressed={ride.choke}
          className={`min-h-[38px] shrink-0 touch-none border-2 px-2.5 text-[11px] font-black uppercase ${
            ride.choke
              ? "border-cyan-400 bg-cyan-400 text-black"
              : "border-zinc-700 bg-black text-zinc-200"
          }`}
        >
          Choke {ride.choke ? "ON" : "OFF"}
        </button>

        <button
          type="button"
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={(e) => handleHoldPointerDown("killSwitch", e)}
          onPointerUp={(e) => handleHoldPointerRelease("killSwitch", e)}
          onPointerLeave={(e) => handleHoldPointerRelease("killSwitch", e)}
          onPointerCancel={(e) => handleHoldPointerRelease("killSwitch", e)}
          onLostPointerCapture={() => setHoldButton("killSwitch", false)}
          className={`min-h-[38px] shrink-0 touch-none border-2 px-2.5 text-[11px] font-black uppercase ${
            touchState.killSwitch
              ? "border-red-400 bg-red-600 text-white"
              : "border-zinc-700 bg-black text-zinc-200"
          }`}
        >
          Plug Chop
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            handleKickstart();
          }}
          disabled={ride.seizedHard}
          className={`min-h-[38px] shrink-0 touch-none border-2 px-2.5 text-[11px] font-black uppercase ${
            ride.seizedHard
              ? "border-zinc-800 bg-zinc-900 text-zinc-600"
              : ride.stalled
                ? "animate-pulse border-[#FFD700] bg-[#FFD700] text-black"
                : "border-zinc-700 bg-black text-[#FFD700]"
          }`}
        >
          Kick
        </button>

        {ride.hasStethoscope && (
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              handleToggleListen();
            }}
            aria-pressed={ride.listenMode}
            className={`inline-flex min-h-[38px] shrink-0 touch-none items-center gap-1 border-2 px-2.5 text-[11px] font-black uppercase ${
              ride.listenMode
                ? "border-cyan-400 bg-cyan-400 text-black"
                : "border-zinc-700 bg-black text-zinc-200"
            }`}
          >
            <Ear className="h-3.5 w-3.5" />
            Listen
          </button>
        )}
      </div>

      {/* Mobile Primary Dual-Thumb Driving Gamepad */}
      <div className="grid shrink-0 grid-cols-12 gap-1.5 border-2 border-black bg-[#FFD700] p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] md:hidden">
        {/* Left Thumb: Brake + Clutch */}
        <button
          type="button"
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={(e) => handleHoldPointerDown("brake", e)}
          onPointerUp={(e) => handleHoldPointerRelease("brake", e)}
          onPointerLeave={(e) => handleHoldPointerRelease("brake", e)}
          onPointerCancel={(e) => handleHoldPointerRelease("brake", e)}
          onLostPointerCapture={() => setHoldButton("brake", false)}
          className={`col-span-3 flex min-h-[60px] touch-none flex-col items-center justify-center border-[3px] border-black px-2 py-2 text-xs font-black uppercase shadow-[2px_2px_0px_#000] ${
            touchState.brake || ride.brake
              ? "translate-y-0.5 bg-red-600 text-white shadow-none"
              : "bg-white text-black"
          }`}
        >
          <span>BRAKE</span>
        </button>

        <button
          type="button"
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={(e) => handleHoldPointerDown("clutch", e)}
          onPointerUp={(e) => handleHoldPointerRelease("clutch", e)}
          onPointerLeave={(e) => handleHoldPointerRelease("clutch", e)}
          onPointerCancel={(e) => handleHoldPointerRelease("clutch", e)}
          onLostPointerCapture={() => setHoldButton("clutch", false)}
          className={`col-span-3 flex min-h-[60px] touch-none flex-col items-center justify-center border-[3px] border-black px-2 py-2 text-xs font-black uppercase shadow-[2px_2px_0px_#000] ${
            touchState.clutch || ride.clutchPulled
              ? "translate-y-0.5 bg-orange-500 text-black shadow-none"
              : seizeUrgent || ride.seizeWarning
                ? "animate-pulse bg-red-600 text-white"
                : "bg-zinc-100 text-black"
          }`}
        >
          <span>CLUTCH</span>
          {(seizeUrgent || ride.seizeWarning) && (
            <span className="text-[9px] leading-none">SAVE!</span>
          )}
        </button>

        {/* Right Thumb: Pedal + Giant Throttle Pad */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            handlePedalPulse();
          }}
          className={`col-span-2 flex min-h-[60px] touch-none flex-col items-center justify-center border-[3px] border-black px-1 py-2 text-[11px] font-black uppercase text-black shadow-[2px_2px_0px_#000] active:translate-y-0.5 active:shadow-none ${
            ride.pedalingHome || ride.gradePct >= 6
              ? "bg-cyan-300"
              : "bg-cyan-200"
          }`}
        >
          <span>PEDAL</span>
          <span className="text-[9px] font-bold opacity-80 tabular-nums">
            {Math.round(ride.stamina)}%
          </span>
        </button>

        <button
          type="button"
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={(e) => handleHoldPointerDown("throttle", e)}
          onPointerUp={(e) => handleHoldPointerRelease("throttle", e)}
          onPointerLeave={(e) => handleHoldPointerRelease("throttle", e)}
          onPointerCancel={(e) => handleHoldPointerRelease("throttle", e)}
          onLostPointerCapture={() => setHoldButton("throttle", false)}
          className={`relative col-span-4 flex min-h-[60px] touch-none flex-col items-center justify-center overflow-hidden border-[3px] border-black px-2 py-2 text-sm font-black uppercase shadow-[2px_2px_0px_#000] ${
            touchState.throttle || touchState.throttleLocked || ride.throttle > 0.1
              ? "translate-y-0.5 bg-emerald-500 text-black shadow-none"
              : "bg-black text-[#FFD700]"
          }`}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 bg-emerald-400/30 transition-all duration-75"
            style={{ width: `${Math.round(ride.throttle * 100)}%` }}
          />
          <span className="relative z-10 leading-none">
            {touchState.throttleLocked ? "WOT LOCKED" : "GAS"}
          </span>
          <span className="relative z-10 mt-0.5 text-[10px] font-black opacity-90 tabular-nums">
            {Math.round(ride.throttle * 100)}%
          </span>
        </button>
      </div>

      {/* Desktop Diegetic Instrument Cluster */}
      <div className="hidden grid-cols-2 gap-2.5 sm:grid-cols-4 md:grid lg:grid-cols-5">
        {/* Speedometer */}
        <div className="border-4 border-black bg-zinc-950 p-3 text-white shadow-[4px_4px_0px_#000]">
          <div className="flex items-center justify-between text-[11px] font-black uppercase text-zinc-400">
            <span>Speed</span>
            {ride.powerbandActive && (
              <span className="bg-[#FFD700] px-1.5 py-0.5 text-[10px] text-black">
                ON THE PIPE!
              </span>
            )}
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-3xl font-black tabular-nums text-[#FFD700]">
              {Math.round(ride.speedMph)}
            </span>
            <span className="text-xs font-black uppercase text-zinc-300">
              MPH
            </span>
          </div>
          <div className="mt-1 text-[11px] font-bold uppercase text-zinc-400">
            {ride.tuck ? "TUCKED AERO" : "UPRIGHT"}
          </div>
        </div>

        {/* Tachometer (Gated by hasTach) */}
        <div className="border-4 border-black bg-zinc-950 p-3 text-white shadow-[4px_4px_0px_#000]">
          <div className="flex items-center justify-between text-[11px] font-black uppercase text-zinc-400">
            <span>Tachometer</span>
            <Gauge className="h-3.5 w-3.5 text-[#FFD700]" />
          </div>
          {ride.hasTach ? (
            <>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-black tabular-nums text-white">
                  {Math.round(ride.rpm)}
                </span>
                <span className="text-[11px] font-bold text-zinc-400">RPM</span>
              </div>
              <div className="mt-2 h-2.5 w-full overflow-hidden border-2 border-black bg-zinc-800">
                <div
                  className={`h-full transition-all duration-75 ${
                    rpmPct > 85
                      ? "bg-red-500"
                      : ride.powerbandActive
                        ? "bg-[#FFD700]"
                        : "bg-cyan-400"
                  }`}
                  style={{ width: `${rpmPct}%` }}
                />
              </div>
            </>
          ) : (
            <div className="mt-2 flex items-center gap-1.5 text-xs font-black uppercase text-zinc-500">
              <Lock className="h-4 w-4 shrink-0" />
              <span>Tach: Buy in Shop</span>
            </div>
          )}
        </div>

        {/* CHT Temp Gauge (Gated by hasChtGauge) */}
        <div className="border-4 border-black bg-zinc-950 p-3 text-white shadow-[4px_4px_0px_#000]">
          <div className="flex items-center justify-between text-[11px] font-black uppercase text-zinc-400">
            <span>Cyl Head Temp</span>
            <Flame className="h-3.5 w-3.5 text-orange-400" />
          </div>
          {ride.hasChtGauge ? (
            <>
              <div className="mt-1 flex items-baseline gap-1">
                <span
                  className={`text-2xl font-black tabular-nums ${
                    ride.chtC >= 205
                      ? "text-red-400"
                      : ride.chtC >= 175
                        ? "text-orange-400"
                        : "text-emerald-400"
                  }`}
                >
                  {Math.round(ride.chtC)}°C
                </span>
              </div>
              <div className="mt-2 h-2.5 w-full overflow-hidden border-2 border-black bg-zinc-800">
                <div
                  className={`h-full transition-all duration-150 ${
                    ride.chtC >= 205
                      ? "bg-red-500"
                      : ride.chtC >= 175
                        ? "bg-orange-400"
                        : "bg-emerald-400"
                  }`}
                  style={{ width: `${chtPct}%` }}
                />
              </div>
            </>
          ) : (
            <div className="mt-2 flex items-center gap-1.5 text-xs font-black uppercase text-zinc-500">
              <Lock className="h-4 w-4 shrink-0" />
              <span>CHT: Buy in Shop</span>
            </div>
          )}
        </div>

        {/* Stamina & Fuel Bowl */}
        <div className="border-4 border-black bg-zinc-950 p-3 text-white shadow-[4px_4px_0px_#000]">
          <div className="flex items-center justify-between text-[11px] font-black uppercase text-zinc-400">
            <span>Stamina / Bowl</span>
            <Fuel className="h-3.5 w-3.5 text-cyan-400" />
          </div>
          <div className="mt-1.5 space-y-1.5">
            <div>
              <div className="flex justify-between text-[10px] font-bold uppercase text-zinc-300">
                <span>Rider Stamina</span>
                <span>{Math.round(ride.stamina)}%</span>
              </div>
              <div className="h-2 w-full border border-black bg-zinc-800">
                <div
                  className="h-full bg-emerald-400"
                  style={{ width: `${Math.min(100, Math.max(0, ride.stamina))}%` }}
                />
              </div>
            </div>
            {ride.hasStethoscope ? (
              <div>
                <div className="flex justify-between text-[10px] font-bold uppercase text-zinc-300">
                  <span>Carb Fuel Bowl</span>
                  <span>{Math.round(ride.fuelBowlPct)}%</span>
                </div>
                <div className="h-2 w-full border border-black bg-zinc-800">
                  <div
                    className={`h-full ${
                      ride.fuelBowlPct < 25 ? "bg-red-500" : "bg-cyan-400"
                    }`}
                    style={{
                      width: `${Math.min(100, Math.max(0, ride.fuelBowlPct))}%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="border border-zinc-800 bg-black/60 px-2 py-1 text-[10px] font-bold uppercase text-zinc-400">
                FUEL FLOW: LISTEN FOR SPUTTER
              </div>
            )}
          </div>
        </div>

        {/* Choke & Kill Switch Indicators */}
        <div className="col-span-2 flex flex-col justify-between border-4 border-black bg-zinc-950 p-3 text-white shadow-[4px_4px_0px_#000] sm:col-span-4 lg:col-span-1">
          <div className="text-[11px] font-black uppercase text-zinc-400">
            Carb & Ignition
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-1">
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                handleToggleChoke();
              }}
              className={`border-2 border-black px-2 py-1 text-xs font-black uppercase ${
                ride.choke
                  ? "bg-cyan-400 text-black"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              Choke [C]: {ride.choke ? "ON" : "OFF"}
            </button>
            <button
              type="button"
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={(e) => handleHoldPointerDown("killSwitch", e)}
              onPointerUp={(e) => handleHoldPointerRelease("killSwitch", e)}
              onPointerLeave={(e) => handleHoldPointerRelease("killSwitch", e)}
              onPointerCancel={(e) => handleHoldPointerRelease("killSwitch", e)}
              onLostPointerCapture={() => setHoldButton("killSwitch", false)}
              className={`touch-none border-2 border-black px-2 py-1 text-xs font-black uppercase ${
                touchState.killSwitch
                  ? "bg-red-500 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              Kill / Plug Chop [K]
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Touch & Mouse Cockpit Controls */}
      <div className="hidden flex-wrap items-stretch justify-between gap-2.5 border-4 border-black bg-[#FFD700] p-2.5 shadow-[5px_5px_0px_#000] md:flex">
        {/* Left Controls: Brake, Clutch, Kickstart */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => handleHoldPointerDown("brake", e)}
            onPointerUp={(e) => handleHoldPointerRelease("brake", e)}
            onPointerLeave={(e) => handleHoldPointerRelease("brake", e)}
            onPointerCancel={(e) => handleHoldPointerRelease("brake", e)}
            onLostPointerCapture={() => setHoldButton("brake", false)}
            className={`touch-none border-[3px] border-black px-4 py-3 text-xs font-black uppercase shadow-[3px_3px_0px_#000] sm:text-sm ${
              touchState.brake || ride.brake
                ? "translate-x-[2px] translate-y-[2px] bg-red-600 text-white shadow-none"
                : "bg-white text-black hover:bg-zinc-100"
            }`}
          >
            Brake [S]
          </button>

          <button
            type="button"
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => handleHoldPointerDown("clutch", e)}
            onPointerUp={(e) => handleHoldPointerRelease("clutch", e)}
            onPointerLeave={(e) => handleHoldPointerRelease("clutch", e)}
            onPointerCancel={(e) => handleHoldPointerRelease("clutch", e)}
            onLostPointerCapture={() => setHoldButton("clutch", false)}
            className={`touch-none border-[3px] border-black px-4 py-3 text-xs font-black uppercase shadow-[3px_3px_0px_#000] sm:text-sm ${
              touchState.clutch || ride.clutchPulled
                ? "translate-x-[2px] translate-y-[2px] bg-orange-500 text-black shadow-none"
                : seizeUrgent
                  ? "animate-pulse bg-red-600 text-white"
                  : "bg-white text-black hover:bg-zinc-100"
            }`}
          >
            Clutch [Q]
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              handleKickstart();
            }}
            disabled={ride.seizedHard}
            className={`touch-none border-[3px] border-black px-3.5 py-3 text-xs font-black uppercase shadow-[3px_3px_0px_#000] sm:text-sm ${
              ride.seizedHard
                ? "cursor-not-allowed bg-zinc-400 text-zinc-700"
                : "bg-zinc-950 text-[#FFD700] active:translate-x-[2px] active:translate-y-[2px]"
            }`}
          >
            Kick [R]
          </button>
        </div>

        {/* Center Keyboard Legend (Desktop) */}
        <div className="hidden items-center text-[11px] font-black uppercase tracking-tight text-black xl:flex">
          W/↑ Throttle • S/↓ Brake • Space Tuck • P Pedal • Q Clutch • C Choke •
          Hold K @ WOT = Plug Chop
        </div>

        {/* Right Controls: Pedal, Tuck, Throttle */}
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              handlePedalPulse();
            }}
            className="touch-none border-[3px] border-black bg-cyan-300 px-4 py-3 text-xs font-black uppercase text-black shadow-[3px_3px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] sm:text-sm"
          >
            Pedal [P]
          </button>

          <button
            type="button"
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => handleHoldPointerDown("tuck", e)}
            onPointerUp={(e) => handleHoldPointerRelease("tuck", e)}
            onPointerLeave={(e) => handleHoldPointerRelease("tuck", e)}
            onPointerCancel={(e) => handleHoldPointerRelease("tuck", e)}
            onLostPointerCapture={() => setHoldButton("tuck", false)}
            className={`touch-none border-[3px] border-black px-4 py-3 text-xs font-black uppercase shadow-[3px_3px_0px_#000] sm:text-sm ${
              touchState.tuck || ride.tuck
                ? "translate-x-[2px] translate-y-[2px] bg-emerald-400 text-black shadow-none"
                : "bg-white text-black hover:bg-zinc-100"
            }`}
          >
            Tuck [Space]
          </button>

          <button
            type="button"
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => handleHoldPointerDown("throttle", e)}
            onPointerUp={(e) => handleHoldPointerRelease("throttle", e)}
            onPointerLeave={(e) => handleHoldPointerRelease("throttle", e)}
            onPointerCancel={(e) => handleHoldPointerRelease("throttle", e)}
            onLostPointerCapture={() => setHoldButton("throttle", false)}
            className={`min-w-[130px] touch-none border-[3px] border-black px-5 py-3 text-xs font-black uppercase shadow-[3px_3px_0px_#000] sm:text-sm ${
              touchState.throttle || ride.throttle > 0.1
                ? "translate-x-[2px] translate-y-[2px] bg-emerald-500 text-black shadow-none"
                : "bg-black text-[#FFD700] hover:bg-zinc-900"
            }`}
          >
            Throttle [W] {Math.round(ride.throttle * 100)}%
          </button>
        </div>
      </div>
    </div>
  );
}
