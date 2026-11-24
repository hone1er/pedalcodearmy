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

      // Smoothly ramp throttle 0..1 when held
      const targetThrottle = heldRef.current.throttleHeld ? 1 : 0;
      const rate = heldRef.current.throttleHeld ? 4.2 : 5.2;
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
        heldRef.current.brake ||
        heldRef.current.tuck ||
        heldRef.current.clutch ||
        heldRef.current.killSwitch ||
        throttleValRef.current !== 0;

      heldRef.current.throttleHeld = false;
      heldRef.current.brake = false;
      heldRef.current.tuck = false;
      heldRef.current.clutch = false;
      heldRef.current.killSwitch = false;
      throttleValRef.current = 0;

      if (updateReactState && hadHeld) {
        setTouchState({
          throttle: false,
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
        if (!heldRef.current.brake) {
          heldRef.current.brake = true;
          setTouchState((s) => ({ ...s, brake: true }));
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
      className="flex w-full min-w-0 flex-col gap-3 select-none"
    >
      {/* Top Route & Telemetry Bar */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-4 border-black bg-zinc-950 px-3 py-2.5 text-white shadow-[5px_5px_0px_#000]">
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
        className="relative w-full min-w-0 overflow-hidden border-4 border-black bg-zinc-950 shadow-[6px_6px_0px_#000]"
      >
        <canvas
          ref={canvasRef}
          className="block h-[290px] w-full sm:h-[380px] md:h-[420px]"
        />

        {/* Comic-book Sound & Symptom Captions */}
        <CaptionLayer captions={ride.captions} />

        {/* Stoplight Indicator */}
        {(ride.atStoplight || ride.stoplightRedSec > 0) && (
          <div className="pointer-events-none absolute top-3 left-3 z-20 flex items-center gap-2 border-[3px] border-black bg-black/90 px-3 py-1.5 shadow-[4px_4px_0px_#000]">
            <span
              className={`h-3.5 w-3.5 rounded-full border-2 border-black ${
                ride.stoplightRedSec > 0
                  ? "animate-pulse bg-red-500"
                  : "bg-green-400"
              }`}
            />
            <span className="text-xs font-black uppercase tracking-wide text-white">
              {ride.stoplightRedSec > 0
                ? `RED LIGHT — EASE OFF THROTTLE (IDLE TEST) (${ride.stoplightRedSec.toFixed(1)}s)`
                : "GREEN LIGHT — SEND IT!"}
            </span>
          </div>
        )}

        {/* Telegraph Coffee Cup Status */}
        {ride.coffeeTempPct !== null && (
          <div className="pointer-events-none absolute top-3 right-3 z-20 flex items-center gap-2.5 border-[3px] border-black bg-amber-950/90 px-3 py-1.5 text-white shadow-[4px_4px_0px_#000]">
            <Coffee className="h-4 w-4 text-[#FFD700]" />
            <div className="text-[11px] font-black uppercase leading-tight">
              <div className="text-[#FFD700]">
                Coffee {Math.round(ride.coffeeTempPct)}% Hot
              </div>
              <div className="text-orange-300">
                Spilled {Math.round(ride.coffeeSpillPct ?? 0)}%
              </div>
            </div>
          </div>
        )}

        {/* Seize Pre-Warning Badge */}
        {ride.seizeWarning && !seizeUrgent && (
          <div className="pointer-events-none absolute top-16 right-3 z-20 max-w-[calc(100%-1.5rem)] border-[3px] border-black bg-orange-500 px-3 py-1 text-xs font-black uppercase tracking-wide text-black shadow-[4px_4px_0px_#000]">
            <span className="inline-flex items-center gap-1.5">
              <Flame className="h-4 w-4 shrink-0" />
              RUNNING HOT — PULL CLUTCH [Q] OR EASE THROTTLE!
            </span>
          </div>
        )}

        {/* URGENT SEIZE CLUTCH-SAVE ALERT */}
        {seizeUrgent && (
          <div className="absolute inset-x-4 top-1/2 z-30 -translate-y-1/2 border-4 border-black bg-red-600 p-4 text-center text-white shadow-[8px_8px_0px_#000] sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2">
            <div className="flex items-center justify-center gap-2 text-xl font-black uppercase tracking-wider sm:text-2xl">
              <OctagonAlert className="h-7 w-7 animate-bounce text-[#FFD700]" />
              <span>ENGINE SEIZING! PRESS [Q] CLUTCH NOW!</span>
            </div>
            <div className="mt-2 h-3 w-full overflow-hidden border-2 border-black bg-black">
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
              className="mt-3 w-full touch-none border-[3px] border-black bg-[#FFD700] px-4 py-2.5 text-base font-black uppercase tracking-wider text-black shadow-[4px_4px_0px_#000] active:translate-x-[2px] active:translate-y-[2px]"
            >
              PULL CLUTCH [Q] — SAVE THE TOP END!
            </button>
          </div>
        )}

        {/* Pedaling Home Active Banner */}
        {ride.pedalingHome && (
          <div className="absolute inset-x-3 bottom-3 z-20 flex flex-wrap items-center justify-between gap-2 border-[3px] border-black bg-[#FFD700] px-3 py-2 text-black shadow-[4px_4px_0px_#000]">
            <div>
              <div className="text-sm font-black uppercase">
                PEDALING HOME — TAP [P] IN RHYTHM!
              </div>
              <div className="text-xs font-bold">
                {Math.max(0, Math.round(ride.pedalHomeRemainingM))}m left to the
                garage • Stamina {Math.round(ride.stamina)}%
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                handlePedalPulse();
              }}
              className="border-2 border-black bg-black px-3 py-1.5 text-xs font-black uppercase text-[#FFD700] active:scale-95"
            >
              PEDAL [P]
            </button>
          </div>
        )}

        {/* Roadside / Stalled Action Bar */}
        {showRoadsideBar && (
          <div className="absolute inset-x-3 bottom-3 z-20 border-[3px] border-black bg-zinc-950/95 p-3 text-white shadow-[5px_5px_0px_#000]">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-wide text-[#FFD700] sm:text-sm">
                {describeStallReason(ride.stallReason, ride.seizedHard)}
              </p>
              <span className="text-xs font-bold text-zinc-400">
                Cash: ${save.cash}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {!ride.seizedHard && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    handleKickstart();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 border-2 border-black bg-[#FFD700] px-3 py-2 text-xs font-black uppercase text-black shadow-[3px_3px_0px_#000] hover:bg-yellow-300"
                >
                  <RotateCcw className="h-4 w-4" />
                  Kickstart [R]
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleStartPedalingHome();
                }}
                className="inline-flex items-center justify-center gap-1.5 border-2 border-black bg-cyan-400 px-3 py-2 text-xs font-black uppercase text-black shadow-[3px_3px_0px_#000] hover:bg-cyan-300"
              >
                <Zap className="h-4 w-4" />
                Pedal Home [P] (Free)
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  callTowTruck();
                }}
                disabled={!canAffordTow}
                className={`inline-flex items-center justify-center gap-1.5 border-2 border-black px-3 py-2 text-xs font-black uppercase shadow-[3px_3px_0px_#000] ${
                  canAffordTow
                    ? "bg-orange-400 text-black hover:bg-orange-300"
                    : "cursor-not-allowed bg-zinc-800 text-zinc-500"
                }`}
              >
                <Truck className="h-4 w-4" />
                Tow Truck (${TOW_COST})
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  abortRideToGarage();
                }}
                className="inline-flex items-center justify-center gap-1.5 border-2 border-black bg-zinc-200 px-3 py-2 text-xs font-black uppercase text-black shadow-[3px_3px_0px_#000] hover:bg-white"
              >
                <Wrench className="h-4 w-4" />
                Back to Garage
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Diegetic Instrument Cluster */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
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

      {/* Touch & Mouse Cockpit Controls */}
      <div className="flex flex-wrap items-stretch justify-between gap-2.5 border-4 border-black bg-[#FFD700] p-2.5 shadow-[5px_5px_0px_#000]">
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
