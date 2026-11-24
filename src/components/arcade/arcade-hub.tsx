"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Flame,
  Gamepad2,
  Gauge,
  MapPin,
  Sparkles,
  Trophy,
  Wrench,
  Zap,
} from "lucide-react";
import type { SimSaveState } from "@/lib/simulator/contract";
import { SAVE_STORAGE_KEY } from "@/lib/simulator/save/storage";

const RUNNER_BEST_KEY = "pca-runner-best-score";
const SIM_SAVE_CANDIDATE_KEYS = [
  SAVE_STORAGE_KEY,
  "pca-ran-when-parked-save",
  "pca-ran-when-parked-v1",
  "ran-when-parked-save",
  "ran-when-parked-v1",
  "pca-moped-sim-save",
  "pca-sim-save-v1",
];

interface SimProgressSnippet {
  cash: number;
  rep: number;
  bikeCount: number;
  completedRoutes: number;
  totalFixes: number;
}

function isSimSaveState(value: unknown): value is SimSaveState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SimSaveState>;
  return (
    candidate.version === 1 &&
    typeof candidate.cash === "number" &&
    typeof candidate.rep === "number" &&
    Array.isArray(candidate.bikes) &&
    candidate.bikes.length > 0 &&
    Array.isArray(candidate.completedRoutes) &&
    Boolean(candidate.stats) &&
    typeof candidate.stats?.totalRides === "number" &&
    typeof candidate.stats?.totalFixes === "number"
  );
}

function readSimProgress(): SimProgressSnippet | null {
  if (typeof window === "undefined") return null;
  try {
    const keysToCheck = new Set<string>(SIM_SAVE_CANDIDATE_KEYS);
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && /sim|parked|moped/i.test(k)) {
        keysToCheck.add(k);
      }
    }

    for (const key of keysToCheck) {
      const raw = window.localStorage.getItem(key);
      if (!raw?.startsWith("{")) continue;
      const parsed: unknown = JSON.parse(raw);
      if (isSimSaveState(parsed)) {
        const hasActivity =
          parsed.stats.totalRides > 0 ||
          parsed.stats.totalFixes > 0 ||
          parsed.completedRoutes.length > 0 ||
          parsed.bikes.length > 1 ||
          parsed.rep > 0;
        if (!hasActivity) continue;
        return {
          cash: parsed.cash,
          rep: parsed.rep,
          bikeCount: parsed.bikes.length,
          completedRoutes: parsed.completedRoutes.length,
          totalFixes: parsed.stats.totalFixes,
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

function readRunnerBest(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(RUNNER_BEST_KEY);
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function ArcadeHub() {
  const [simProgress, setSimProgress] = useState<SimProgressSnippet | null>(
    null,
  );
  const [runnerBest, setRunnerBest] = useState<number | null>(null);

  useEffect(() => {
    setSimProgress(readSimProgress());
    setRunnerBest(readRunnerBest());
  }, []);

  return (
    <div className="relative min-h-[calc(100vh-80px)] overflow-hidden bg-black px-4 py-10 text-white sm:py-14">
      {/* Subtle neo-brutalist workshop grid backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #FFD700 1px, transparent 1px), linear-gradient(to bottom, #FFD700 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="container relative mx-auto max-w-6xl">
        {/* Arcade Marquee Header */}
        <header className="mb-10 border-4 border-[#FFD700] bg-zinc-950 p-6 shadow-[8px_8px_0px_0px_#FFD700] sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 border-2 border-[#FFD700] bg-[#FFD700] px-3 py-1 text-xs font-black uppercase tracking-widest text-black">
                <Gamepad2 className="h-3.5 w-3.5" aria-hidden="true" />
                East Bay 2-Stroke Game Room
              </div>
              <h1
                className="text-5xl leading-none tracking-wider text-[#FFD700] drop-shadow-[4px_4px_0px_rgba(234,88,12,0.85)] sm:text-6xl md:text-7xl"
                style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
              >
                PEDAL CODE ARMY ARCADE
              </h1>
              <p className="mt-3 max-w-2xl text-sm font-medium text-zinc-200 sm:text-base">
                Two original East Bay moped games built by the gang. Wrench on
                finicky 2-strokes in the garage or weave through Oakland traffic
                at full tuck.
              </p>
            </div>
            <div className="flex flex-col items-start gap-1 border-2 border-zinc-700 bg-black px-4 py-3 sm:items-end">
              <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">
                Insert Premix
              </span>
              <span
                className="text-xl font-bold text-[#FFD700] tabular-nums"
                style={{
                  fontFamily: "var(--font-orbitron), Orbitron, monospace",
                }}
              >
                2 CABINETS READY
              </span>
            </div>
          </div>
        </header>

        {/* Arcade Cabinet Grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* CABINET 1: RAN WHEN PARKED */}
          <article className="group flex flex-col justify-between border-4 border-[#FFD700] bg-zinc-950 shadow-[8px_8px_0px_0px_#FFD700] transition-transform duration-150 hover:-translate-y-1">
            <div>
              {/* Top Marquee Banner */}
              <div className="flex items-center justify-between border-b-4 border-[#FFD700] bg-[#FFD700] px-4 py-2 text-black">
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest"
                  style={{
                    fontFamily:
                      "var(--font-russo-one), 'Russo One', sans-serif",
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  NEW &bull; MOPED SIMULATOR
                </span>
                <span className="border-2 border-black bg-black px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#FFD700]">
                  50:1 Premix
                </span>
              </div>

              {/* Cabinet Screen Art */}
              <div className="relative overflow-hidden border-b-4 border-zinc-800 bg-black px-5 py-6">
                <svg
                  viewBox="0 0 560 190"
                  role="img"
                  aria-label="Ran When Parked moped garage workbench illustration"
                  className="h-44 w-full"
                >
                  <defs>
                    <pattern
                      id="rwp-grid"
                      width="20"
                      height="20"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M 20 0 L 0 0 0 20"
                        fill="none"
                        stroke="#27272A"
                        strokeWidth="1"
                      />
                    </pattern>
                  </defs>
                  <rect width="560" height="190" fill="#09090B" />
                  <rect width="560" height="190" fill="url(#rwp-grid)" />
                  {/* Workbench floor line */}
                  <line
                    x1="20"
                    y1="162"
                    x2="540"
                    y2="162"
                    stroke="#FFD700"
                    strokeWidth="3"
                  />
                  {/* Stylized Puch Maxi side silhouette */}
                  <g transform="translate(115, 32)">
                    {/* Rear wheel */}
                    <circle
                      cx="62"
                      cy="104"
                      r="34"
                      fill="#18181B"
                      stroke="#E4E4E7"
                      strokeWidth="6"
                    />
                    <circle
                      cx="62"
                      cy="104"
                      r="12"
                      fill="#27272A"
                      stroke="#FFD700"
                      strokeWidth="3"
                    />
                    {/* Front wheel */}
                    <circle
                      cx="266"
                      cy="104"
                      r="34"
                      fill="#18181B"
                      stroke="#E4E4E7"
                      strokeWidth="6"
                    />
                    <circle
                      cx="266"
                      cy="104"
                      r="12"
                      fill="#27272A"
                      stroke="#FFD700"
                      strokeWidth="3"
                    />
                    {/* Race expansion chamber */}
                    <path
                      d="M 188 102 Q 146 128 112 118 L 62 108 L 54 118 L 116 128 Q 158 136 196 108 Z"
                      fill="#3F3F46"
                      stroke="#FFD700"
                      strokeWidth="2.5"
                    />
                    {/* Finned cylinder */}
                    <rect
                      x="170"
                      y="76"
                      width="34"
                      height="32"
                      rx="3"
                      fill="#52525B"
                      stroke="#E4E4E7"
                      strokeWidth="2"
                    />
                    <line
                      x1="170"
                      y1="83"
                      x2="204"
                      y2="83"
                      stroke="#18181B"
                      strokeWidth="2"
                    />
                    <line
                      x1="170"
                      y1="91"
                      x2="204"
                      y2="91"
                      stroke="#18181B"
                      strokeWidth="2"
                    />
                    <line
                      x1="170"
                      y1="99"
                      x2="204"
                      y2="99"
                      stroke="#18181B"
                      strokeWidth="2"
                    />
                    {/* Step-through yellow frame */}
                    <path
                      d="M 62 104 L 118 60 L 218 44 L 246 42 L 266 104 M 224 44 L 160 100 L 62 104"
                      fill="none"
                      stroke="#FFD700"
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Saddle */}
                    <rect
                      x="92"
                      y="38"
                      width="52"
                      height="15"
                      rx="6"
                      fill="#18181B"
                      stroke="#E4E4E7"
                      strokeWidth="2"
                    />
                    {/* Handlebars & headlight */}
                    <path
                      d="M 222 44 L 214 16 L 194 12"
                      fill="none"
                      stroke="#E4E4E7"
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                    <circle
                      cx="240"
                      cy="36"
                      r="10"
                      fill="#FEF08A"
                      stroke="#18181B"
                      strokeWidth="2.5"
                    />
                    {/* Diagnostic ping rings */}
                    <circle
                      cx="198"
                      cy="74"
                      r="11"
                      fill="none"
                      stroke="#22D3EE"
                      strokeWidth="2.5"
                      strokeDasharray="4 3"
                    />
                    <circle cx="198" cy="74" r="4" fill="#22D3EE" />
                    <circle
                      cx="154"
                      cy="90"
                      r="11"
                      fill="none"
                      stroke="#F97316"
                      strokeWidth="2.5"
                      strokeDasharray="4 3"
                    />
                    <circle cx="154" cy="90" r="4" fill="#F97316" />
                  </g>
                  {/* Callout badge */}
                  <g transform="translate(20, 16)">
                    <rect
                      width="136"
                      height="28"
                      fill="#18181B"
                      stroke="#FFD700"
                      strokeWidth="2"
                    />
                    <text
                      x="10"
                      y="18"
                      fill="#FFD700"
                      fontSize="11"
                      fontWeight="900"
                      fontFamily="monospace"
                    >
                      PLUG CHOP: TAN OK
                    </text>
                  </g>
                  <g transform="translate(414, 16)">
                    <rect
                      width="126"
                      height="28"
                      fill="#18181B"
                      stroke="#22D3EE"
                      strokeWidth="2"
                    />
                    <text
                      x="10"
                      y="18"
                      fill="#22D3EE"
                      fontSize="11"
                      fontWeight="900"
                      fontFamily="monospace"
                    >
                      MAIN JET: #60
                    </text>
                  </g>
                </svg>
              </div>

              {/* Description & Features */}
              <div className="p-6">
                <h2
                  className="text-4xl tracking-wider text-[#FFD700] sm:text-5xl"
                  style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
                >
                  RAN WHEN PARKED
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-200 sm:text-base">
                  Ride until it breaks, diagnose real 2-stroke symptoms by ear
                  and plug chop, jet carbs &amp; wrench in the garage, score
                  sketchy Craigslist finds, and conquer East Bay routes.
                </p>

                <ul className="mt-4 flex flex-wrap gap-2">
                  {[
                    { icon: Wrench, label: "8 Diagnostic Tools" },
                    { icon: Flame, label: "Plug Chop Viewer" },
                    { icon: Gauge, label: "Jet & Upgrade" },
                    { icon: MapPin, label: "4 East Bay Routes" },
                  ].map(({ icon: Icon, label }) => (
                    <li
                      key={label}
                      className="inline-flex items-center gap-1.5 border-2 border-zinc-700 bg-black px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-zinc-200"
                    >
                      <Icon
                        className="h-3.5 w-3.5 text-[#FFD700]"
                        aria-hidden="true"
                      />
                      {label}
                    </li>
                  ))}
                </ul>

                {simProgress && (
                  <div className="mt-5 border-2 border-[#FFD700]/60 bg-[#FFD700]/10 p-3">
                    <p className="text-[11px] font-black uppercase tracking-widest text-[#FFD700]">
                      Saved Garage Found
                    </p>
                    <div
                      className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-white tabular-nums"
                      style={{
                        fontFamily: "var(--font-orbitron), Orbitron, monospace",
                      }}
                    >
                      <span>${simProgress.cash}</span>
                      <span>{simProgress.rep} REP</span>
                      <span>
                        {simProgress.bikeCount}{" "}
                        {simProgress.bikeCount === 1 ? "BIKE" : "BIKES"}
                      </span>
                      <span>
                        {simProgress.totalFixes}{" "}
                        {simProgress.totalFixes === 1 ? "FIX" : "FIXES"}
                      </span>
                      <span>{simProgress.completedRoutes}/4 ROUTES</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 pb-6">
              <Link
                href="/game/ran-when-parked"
                className="flex w-full items-center justify-center gap-2 border-4 border-[#FFD700] bg-[#FFD700] px-6 py-3.5 text-2xl tracking-wider text-black shadow-[4px_4px_0px_0px_rgba(255,255,255,0.9)] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
              >
                {simProgress ? "CONTINUE WRENCHING" : "ENTER THE GARAGE"}
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
            </div>
          </article>

          {/* CABINET 2: EAST BAY RUNNER */}
          <article className="group flex flex-col justify-between border-4 border-zinc-400 bg-zinc-950 shadow-[8px_8px_0px_0px_rgba(249,115,22,0.9)] transition-transform duration-150 hover:-translate-y-1">
            <div>
              {/* Top Marquee Banner */}
              <div className="flex items-center justify-between border-b-4 border-zinc-400 bg-orange-500 px-4 py-2 text-black">
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest"
                  style={{
                    fontFamily:
                      "var(--font-russo-one), 'Russo One', sans-serif",
                  }}
                >
                  <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                  3D ENDLESS ARCADE
                </span>
                <span className="border-2 border-black bg-black px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-orange-400">
                  Leaderboard Live
                </span>
              </div>

              {/* Cabinet Screen Art */}
              <div className="relative overflow-hidden border-b-4 border-zinc-800 bg-black px-5 py-6">
                <svg
                  viewBox="0 0 560 190"
                  role="img"
                  aria-label="East Bay Runner Oakland highway arcade illustration"
                  className="h-44 w-full"
                >
                  <defs>
                    <linearGradient
                      id="ebr-sky"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#1E1B4B" />
                      <stop offset="65%" stopColor="#9A3412" />
                      <stop offset="100%" stopColor="#F59E0B" />
                    </linearGradient>
                  </defs>
                  <rect width="560" height="108" fill="url(#ebr-sky)" />
                  {/* Sunset sun */}
                  <circle cx="280" cy="98" r="34" fill="#FFD700" opacity="0.9" />
                  {/* Oakland skyline */}
                  <path
                    d="M0 108 L0 78 L36 78 L36 62 L68 62 L68 84 L106 84 L106 50 L144 50 L144 76 L195 76 L195 66 L232 66 L232 88 L330 88 L330 60 L372 60 L372 78 L420 78 L420 44 L456 44 L456 72 L512 72 L512 82 L560 82 L560 108 Z"
                    fill="#09090B"
                  />
                  {/* Perspective highway */}
                  <polygon points="0,190 560,190 365,108 195,108" fill="#18181B" />
                  <polygon points="0,190 195,108 0,108" fill="#09090B" />
                  <polygon points="560,190 365,108 560,108" fill="#09090B" />
                  {/* Road edge lines */}
                  <line
                    x1="44"
                    y1="190"
                    x2="205"
                    y2="108"
                    stroke="#FFD700"
                    strokeWidth="4"
                  />
                  <line
                    x1="516"
                    y1="190"
                    x2="355"
                    y2="108"
                    stroke="#FFD700"
                    strokeWidth="4"
                  />
                  {/* Center dashes */}
                  <line
                    x1="280"
                    y1="112"
                    x2="280"
                    y2="128"
                    stroke="#FFFFFF"
                    strokeWidth="4"
                  />
                  <line
                    x1="280"
                    y1="142"
                    x2="280"
                    y2="165"
                    stroke="#FFFFFF"
                    strokeWidth="6"
                  />
                  <line
                    x1="280"
                    y1="178"
                    x2="280"
                    y2="190"
                    stroke="#FFFFFF"
                    strokeWidth="8"
                  />
                  {/* Speed lines */}
                  <line
                    x1="96"
                    y1="138"
                    x2="160"
                    y2="130"
                    stroke="#F97316"
                    strokeWidth="2.5"
                    opacity="0.85"
                  />
                  <line
                    x1="464"
                    y1="142"
                    x2="395"
                    y2="132"
                    stroke="#F97316"
                    strokeWidth="2.5"
                    opacity="0.85"
                  />
                  {/* HUD tags */}
                  <g transform="translate(20, 16)">
                    <rect
                      width="118"
                      height="28"
                      fill="#09090B"
                      stroke="#F97316"
                      strokeWidth="2"
                    />
                    <text
                      x="10"
                      y="18"
                      fill="#FB923C"
                      fontSize="11"
                      fontWeight="900"
                      fontFamily="monospace"
                    >
                      COMBO x4 MAX
                    </text>
                  </g>
                  <g transform="translate(422, 16)">
                    <rect
                      width="118"
                      height="28"
                      fill="#09090B"
                      stroke="#FFD700"
                      strokeWidth="2"
                    />
                    <text
                      x="10"
                      y="18"
                      fill="#FFD700"
                      fontSize="11"
                      fontWeight="900"
                      fontFamily="monospace"
                    >
                      WHEELIE +250
                    </text>
                  </g>
                </svg>
              </div>

              {/* Description & Features */}
              <div className="p-6">
                <h2
                  className="text-4xl tracking-wider text-white sm:text-5xl"
                  style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
                >
                  EAST BAY RUNNER
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-200 sm:text-base">
                  Dodge Oakland traffic, pop wheelies over potholes, chain x4
                  score combos, pick up real moped shop upgrades, and claim the
                  top spot on the global leaderboard.
                </p>

                <ul className="mt-4 flex flex-wrap gap-2">
                  {[
                    { icon: Zap, label: "3D Endless Action" },
                    { icon: Flame, label: "Wheelie & x4 Combos" },
                    { icon: Trophy, label: "Global Leaderboard" },
                  ].map(({ icon: Icon, label }) => (
                    <li
                      key={label}
                      className="inline-flex items-center gap-1.5 border-2 border-zinc-700 bg-black px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-zinc-200"
                    >
                      <Icon
                        className="h-3.5 w-3.5 text-orange-400"
                        aria-hidden="true"
                      />
                      {label}
                    </li>
                  ))}
                </ul>

                {runnerBest !== null && (
                  <div className="mt-5 border-2 border-orange-500/70 bg-orange-500/10 p-3">
                    <p className="text-[11px] font-black uppercase tracking-widest text-orange-300">
                      Local High Score
                    </p>
                    <p
                      className="mt-1 flex items-center gap-2 text-base font-bold text-white tabular-nums"
                      style={{
                        fontFamily: "var(--font-orbitron), Orbitron, monospace",
                      }}
                    >
                      <Trophy
                        className="h-4 w-4 text-[#FFD700]"
                        aria-hidden="true"
                      />
                      {runnerBest.toLocaleString()} PTS
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 pb-6">
              <Link
                href="/game/east-bay-runner"
                className="flex w-full items-center justify-center gap-2 border-4 border-white bg-black px-6 py-3.5 text-2xl tracking-wider text-[#FFD700] shadow-[4px_4px_0px_0px_#F97316] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-[#FFD700] hover:bg-[#FFD700] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
              >
                PLAY EAST BAY RUNNER
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
