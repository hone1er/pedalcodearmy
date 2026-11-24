"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Flame,
  MapPin,
  RotateCcw,
  ShoppingBag,
  Tag,
  Trophy,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import type { RideSummary, SimPhase } from "@/lib/simulator/contract";
import { getRouteById } from "@/lib/simulator/ride/routes";
import { getActiveBike, useSimStore } from "@/lib/simulator/store/sim-store";
import { GarageView } from "./garage/garage-view";
import { RouteMap } from "./map/route-map";
import { RideView } from "./ride/ride-view";
import { RunnerView } from "./runner/runner-view";
import { CraigslistMarket } from "./shop/craigslist-market";
import { PartsCounter } from "./shop/parts-counter";

const PHASE_TABS: Array<{
  phase: Extract<SimPhase, "GARAGE" | "MAP" | "RUNNER" | "SHOP" | "CRAIGSLIST">;
  label: string;
  icon: typeof Wrench;
}> = [
  { phase: "GARAGE", label: "Garage", icon: Wrench },
  { phase: "MAP", label: "Tuning Rides", icon: MapPin },
  { phase: "RUNNER", label: "Street Runner", icon: Zap },
  { phase: "SHOP", label: "Parts Shop", icon: ShoppingBag },
  { phase: "CRAIGSLIST", label: "Craigslist", icon: Tag },
];

function noticeToneClass(
  tone: "gold" | "green" | "red" | "cyan",
): string {
  if (tone === "green") {
    return "border-emerald-400 bg-emerald-950/90 text-emerald-100";
  }
  if (tone === "red") {
    return "border-red-500 bg-red-950/90 text-red-100";
  }
  if (tone === "cyan") {
    return "border-cyan-400 bg-cyan-950/90 text-cyan-100";
  }
  return "border-[#FFD700] bg-zinc-950 text-[#FFD700]";
}

function outcomeBanner(outcome: RideSummary["outcome"]): {
  title: string;
  subtitle: string;
  headerClass: string;
} {
  switch (outcome) {
    case "finished":
      return {
        title: "ROUTE CLEARED!",
        subtitle: "Your 2-stroke made it across the East Bay under its own power.",
        headerClass: "bg-emerald-400 text-black border-emerald-400",
      };
    case "pedaled-home":
      return {
        title: "PEDALED IT HOME",
        subtitle: "Leg day complete. Roll it onto the workbench and see what gave up.",
        headerClass: "bg-[#FFD700] text-black border-[#FFD700]",
      };
    case "towed":
      return {
        title: "TOW OF SHAME",
        subtitle: "Dropped back at the garage in the back of a buddy's pickup.",
        headerClass: "bg-orange-500 text-black border-orange-500",
      };
    case "seize-crash":
      return {
        title: "PISTON SEIZED!",
        subtitle: "Rear wheel locked solid! Pull the plug and check compression.",
        headerClass: "bg-red-500 text-white border-red-500",
      };
    default:
      return {
        title: "BACK TO THE GARAGE",
        subtitle: "Shakedown run ended early — time to pull tools and wrench.",
        headerClass: "bg-zinc-200 text-black border-zinc-200",
      };
  }
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function RideSummaryModal({
  summary,
  onClose,
}: {
  summary: RideSummary;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  const route = getRouteById(summary.routeId);
  const banner = outcomeBanner(summary.outcome);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeBtnRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key === "Tab") {
        const container = dialogRef.current;
        if (!container) return;
        const focusables = Array.from(
          container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        );
        if (focusables.length === 0) {
          event.preventDefault();
          return;
        }
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        const active = document.activeElement;
        if (event.shiftKey) {
          if (!container.contains(active) || active === first) {
            event.preventDefault();
            last.focus();
          }
        } else if (!container.contains(active) || active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ride-summary-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto border-4 border-[#FFD700] bg-zinc-950 text-white shadow-[10px_10px_0px_0px_#FFD700]"
      >
        <div
          className={`flex items-center justify-between gap-3 border-b-4 px-5 py-3.5 ${banner.headerClass}`}
        >
          <div className="flex items-center gap-2.5">
            {summary.completed ? (
              <Trophy className="h-6 w-6 shrink-0" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-6 w-6 shrink-0" aria-hidden="true" />
            )}
            <div>
              <h2
                id="ride-summary-title"
                className="text-3xl leading-none tracking-wider"
                style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
              >
                {banner.title}
              </h2>
              <p className="mt-0.5 text-xs font-bold opacity-90">
                {route?.name ?? summary.routeId}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close ride summary"
            className="border-2 border-black bg-black p-1.5 text-[#FFD700] hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-sm text-zinc-200">{banner.subtitle}</p>

          {/* Ride Stats Grid */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <div className="border-2 border-zinc-800 bg-black p-3">
              <span className="block text-[10px] font-black uppercase text-zinc-400">
                Distance
              </span>
              <span
                className="mt-1 block text-lg font-bold text-white tabular-nums"
                style={{
                  fontFamily: "var(--font-orbitron), Orbitron, monospace",
                }}
              >
                {(summary.distanceM / 1609.34).toFixed(2)} MI
              </span>
            </div>
            <div className="border-2 border-zinc-800 bg-black p-3">
              <span className="block text-[10px] font-black uppercase text-zinc-400">
                Top Speed
              </span>
              <span
                className="mt-1 block text-lg font-bold text-white tabular-nums"
                style={{
                  fontFamily: "var(--font-orbitron), Orbitron, monospace",
                }}
              >
                {Math.round(summary.topSpeedMph)} MPH
              </span>
            </div>
            <div className="border-2 border-zinc-800 bg-black p-3">
              <span className="block text-[10px] font-black uppercase text-zinc-400">
                Max CHT
              </span>
              <span
                className={`mt-1 block text-lg font-bold tabular-nums ${
                  summary.maxChtC >= 205
                    ? "text-red-400"
                    : summary.maxChtC >= 180
                      ? "text-amber-300"
                      : "text-emerald-300"
                }`}
                style={{
                  fontFamily: "var(--font-orbitron), Orbitron, monospace",
                }}
              >
                {Math.round(summary.maxChtC)}&deg;C
              </span>
            </div>
            <div className="border-2 border-zinc-800 bg-black p-3">
              <span className="block text-[10px] font-black uppercase text-zinc-400">
                Cash Earned
              </span>
              <span
                className="mt-1 block text-lg font-bold text-[#FFD700] tabular-nums"
                style={{
                  fontFamily: "var(--font-orbitron), Orbitron, monospace",
                }}
              >
                +${summary.cashEarned}
              </span>
            </div>
            <div className="border-2 border-zinc-800 bg-black p-3">
              <span className="block text-[10px] font-black uppercase text-zinc-400">
                Rep Earned
              </span>
              <span
                className="mt-1 block text-lg font-bold text-cyan-300 tabular-nums"
                style={{
                  fontFamily: "var(--font-orbitron), Orbitron, monospace",
                }}
              >
                +{summary.repEarned} REP
              </span>
            </div>
            {summary.towCost > 0 && (
              <div className="border-2 border-red-500/70 bg-red-950/40 p-3">
                <span className="block text-[10px] font-black uppercase text-red-300">
                  Tow Fee
                </span>
                <span
                  className="mt-1 block text-lg font-bold text-red-300 tabular-nums"
                  style={{
                    fontFamily: "var(--font-orbitron), Orbitron, monospace",
                  }}
                >
                  -${summary.towCost}
                </span>
              </div>
            )}
          </div>

          {summary.plugChopCaptured && (
            <div className="flex items-center gap-2.5 border-2 border-cyan-400 bg-cyan-950/50 p-3 text-xs font-bold text-cyan-100">
              <Flame className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
              Clean WOT Plug Chop captured! Use the Plug Chop tool on your spark
              plug in the garage for an exact mixture read.
            </div>
          )}

          {summary.notes.length > 0 && (
            <div className="border-2 border-zinc-800 bg-black p-3.5">
              <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-[#FFD700]">
                Ride Observations
              </p>
              <ul className="space-y-1.5 text-xs text-zinc-200">
                {summary.notes.map((note, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FFD700]"
                      aria-hidden="true"
                    />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="w-full border-4 border-[#FFD700] bg-[#FFD700] py-3 text-2xl tracking-wider text-black shadow-[4px_4px_0px_0px_#FFF] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
          >
            BACK TO GARAGE &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}

export function SimulatorRoot() {
  const {
    phase,
    save,
    lastRideSummary,
    lastActionNotice,
    bikeNeedsAttention,
    setPhase,
    clearNotice,
    dismissRideSummary,
    resetSave,
  } = useSimStore();

  const [confirmingReset, setConfirmingReset] = useState(false);

  const bike = getActiveBike(save);
  const isRiding = phase === "RIDE" || phase === "ROADSIDE";
  const viewGroup = isRiding ? "RIDE" : phase;
  const didMountRef = useRef(false);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [viewGroup]);

  return (
    <div className="min-h-[calc(100vh-80px)] bg-black text-white">
      {/* Top Arcade Status Bar */}
      <header className="border-b-4 border-[#FFD700] bg-zinc-950">
        <div className="container mx-auto max-w-7xl px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Brand + Active Bike */}
            <div className="flex flex-wrap items-center gap-3">
              <h1
                className="text-3xl leading-none tracking-wider text-[#FFD700] drop-shadow-[2px_2px_0px_rgba(234,88,12,0.85)] sm:text-4xl"
                style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
              >
                RAN WHEN PARKED
              </h1>
              <span className="inline-flex items-center gap-1.5 border-2 border-zinc-700 bg-black px-2 py-0.5 text-[11px] font-bold text-zinc-200 sm:px-2.5 sm:py-1 sm:text-xs">
                <span
                  className="h-2.5 w-2.5 shrink-0 border border-white"
                  style={{ backgroundColor: bike.colorHex }}
                  aria-hidden="true"
                />
                <span className="max-w-[140px] truncate sm:max-w-none">
                  {bike.nickname}
                </span>
                {bikeNeedsAttention && (
                  <span
                    className="relative inline-flex h-2 w-2 shrink-0"
                    title="Bike needs attention"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FFD700] opacity-75 motion-reduce:animate-none"
                    />
                    <span
                      aria-hidden="true"
                      className="relative inline-flex h-2 w-2 rounded-full bg-[#FFD700]"
                    />
                    <span className="sr-only">Bike needs attention</span>
                  </span>
                )}
              </span>
            </div>

            {/* Cash, Rep & Reset */}
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="border-2 border-[#FFD700] bg-black px-3 py-1 text-sm font-bold text-[#FFD700] tabular-nums"
                style={{
                  fontFamily: "var(--font-orbitron), Orbitron, monospace",
                }}
                aria-label={`Cash balance: ${save.cash} dollars`}
              >
                ${save.cash}
              </div>
              <div
                className="border-2 border-cyan-500/80 bg-black px-3 py-1 text-sm font-bold text-cyan-300 tabular-nums"
                style={{
                  fontFamily: "var(--font-orbitron), Orbitron, monospace",
                }}
                aria-label={`Reputation: ${save.rep}`}
              >
                {save.rep} REP
              </div>

              {!isRiding &&
                (confirmingReset ? (
                  <div className="flex items-center gap-1.5 border-2 border-red-500 bg-red-950/70 px-2 py-1">
                    <span className="text-[10px] font-black uppercase text-red-200">
                      Wipe Save?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        resetSave();
                        setConfirmingReset(false);
                      }}
                      className="bg-red-500 px-2 py-0.5 text-[10px] font-black uppercase text-white hover:bg-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingReset(false)}
                      className="bg-zinc-800 px-2 py-0.5 text-[10px] font-black uppercase text-zinc-200 hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingReset(true)}
                    title="Reset simulator save"
                    aria-label="Reset simulator save"
                    className="inline-flex items-center gap-1 border-2 border-zinc-700 bg-black px-2.5 py-1.5 text-[11px] font-black uppercase text-zinc-400 transition-colors hover:border-red-500 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">Reset</span>
                  </button>
                ))}
            </div>
          </div>

          {/* Phase Switcher Tabs */}
          {!isRiding ? (
            <nav
              aria-label="Simulator sections"
              className="mt-3 flex flex-wrap gap-2 border-t border-zinc-800 pt-3"
            >
              {PHASE_TABS.map(({ phase: tabPhase, label, icon: Icon }) => {
                const active = phase === tabPhase;
                return (
                  <button
                    key={tabPhase}
                    type="button"
                    onClick={() => setPhase(tabPhase)}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex items-center gap-1.5 border-2 px-4 py-1.5 text-xs font-black uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] ${
                      active
                        ? "border-[#FFD700] bg-[#FFD700] text-black shadow-[3px_3px_0px_0px_#FFF]"
                        : "border-zinc-700 bg-black text-zinc-200 hover:border-[#FFD700] hover:text-[#FFD700]"
                    }`}
                    style={{
                      fontFamily:
                        "var(--font-russo-one), 'Russo One', sans-serif",
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {label}
                  </button>
                );
              })}
            </nav>
          ) : (
            <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-2 text-xs font-black uppercase tracking-widest text-[#FFD700]">
              <span>
                {phase === "ROADSIDE"
                  ? "ROADSIDE BREAKDOWN — PEDAL HOME OR CALL TOW"
                  : "ON THE ROAD — LISTEN FOR SYMPTOMS"}
              </span>
              <span className="text-zinc-400">{bike.nickname}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Container */}
      <div className="container mx-auto max-w-7xl px-4 py-5">
        {/* Transient Action Notice Banner */}
        {lastActionNotice && (
          <div
            role="status"
            aria-live="polite"
            className={`mb-4 flex items-center justify-between gap-3 border-2 px-4 py-2.5 text-sm font-bold shadow-[4px_4px_0px_0px_#000] ${noticeToneClass(
              lastActionNotice.tone,
            )}`}
          >
            <span>{lastActionNotice.text}</span>
            <button
              type="button"
              onClick={clearNotice}
              aria-label="Dismiss notification"
              className="border border-current/40 p-1 opacity-80 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Active Phase View */}
        {isRiding ? (
          <RideView />
        ) : phase === "GARAGE" ? (
          <GarageView />
        ) : phase === "MAP" ? (
          <RouteMap />
        ) : phase === "RUNNER" ? (
          <RunnerView />
        ) : phase === "SHOP" ? (
          <PartsCounter />
        ) : (
          <CraigslistMarket />
        )}
      </div>

      {/* Post-Ride Summary Modal */}
      {lastRideSummary && (
        <RideSummaryModal
          summary={lastRideSummary}
          onClose={() => {
            dismissRideSummary();
            setPhase("GARAGE");
          }}
        />
      )}
    </div>
  );
}
