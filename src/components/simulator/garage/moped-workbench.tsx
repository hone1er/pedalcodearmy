"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Crosshair,
  Droplets,
  Power,
  PowerOff,
  Wrench,
} from "lucide-react";
import type {
  HotspotId,
  OwnedBike,
  SimBikeMake,
  ToolId,
} from "@/lib/simulator/contract";
import { getToolById } from "@/lib/simulator/diagnostics/tools";
import { getPartById } from "@/lib/simulator/economy/catalog";

export interface MopedWorkbenchProps {
  bike: OwnedBike;
  selectedTool: ToolId;
  garageFuelDrip: boolean;
  bikeNeedsAttention: boolean;
  lastHotspot?: HotspotId | null;
  onHotspotClick: (hotspot: HotspotId) => void;
}

interface HotspotMeta {
  id: HotspotId;
  label: string;
  short: string;
  xPct: number;
  yPct: number;
}

const MAKE_LABELS: Record<SimBikeMake, string> = {
  "puch-maxi": "PUCH MAXI (E50)",
  "honda-hobbit": "HONDA HOBBIT (PA50)",
  "derbi-variant": "DERBI VARIANT",
  "tomos-a35": "TOMOS A35 (2-SPD)",
};

const BASE_HOTSPOTS: HotspotMeta[] = [
  { id: "gas-tank", label: "Gas Tank & Petcock", short: "Tank", xPct: 50, yPct: 48 },
  { id: "fuel-filter", label: "Inline Fuel Filter", short: "Fuel Line", xPct: 43, yPct: 50 },
  { id: "carburetor", label: "Carburetor & Bowl", short: "Carb", xPct: 44, yPct: 62 },
  { id: "intake-gasket", label: "Intake Manifold & Gasket", short: "Intake", xPct: 54, yPct: 56 },
  { id: "spark-plug", label: "Spark Plug & Boot", short: "Plug", xPct: 64, yPct: 56 },
  { id: "cylinder", label: "Cylinder Head & Barrel", short: "Cylinder", xPct: 60, yPct: 68 },
  { id: "ignition", label: "Stator / Ignition Points", short: "Ignition", xPct: 51, yPct: 74 },
  { id: "clutch", label: "Clutch / Variator Cover", short: "Clutch", xPct: 40, yPct: 73 },
  { id: "exhaust", label: "Exhaust Pipe & Header", short: "Exhaust", xPct: 31, yPct: 81 },
  { id: "rear-wheel", label: "Rear Wheel & Drive Chain", short: "Rear Wheel", xPct: 20, yPct: 70 },
];

function getHotspotsForMake(make: SimBikeMake): HotspotMeta[] {
  return BASE_HOTSPOTS.map((spot) => {
    if (make === "honda-hobbit") {
      if (spot.id === "gas-tank") return { ...spot, xPct: 49, yPct: 32 };
      if (spot.id === "clutch") return { ...spot, xPct: 35, yPct: 72 };
      if (spot.id === "carburetor") return { ...spot, xPct: 44, yPct: 63 };
    }
    if (make === "derbi-variant") {
      if (spot.id === "gas-tank") return { ...spot, xPct: 54, yPct: 31 };
      if (spot.id === "spark-plug") return { ...spot, xPct: 64, yPct: 57 };
    }
    if (make === "tomos-a35") {
      if (spot.id === "gas-tank") return { ...spot, xPct: 53, yPct: 44 };
      if (spot.id === "clutch") return { ...spot, xPct: 40, yPct: 73 };
    }
    return spot;
  });
}

function BikeFrameGeometry({
  make,
  colorHex,
  accentHex,
}: {
  make: SimBikeMake;
  colorHex: string;
  accentHex: string;
}) {
  if (make === "honda-hobbit") {
    return (
      <g>
        {/* Rear fender & chrome rack */}
        <path
          d="M 110 302 Q 160 225 244 260"
          fill="none"
          stroke={colorHex}
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 118 242 L 222 242 L 204 268 L 136 268"
          fill="none"
          stroke="#D4D4D8"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        {/* Swingarm + Honda PA50 belt-drive variator cover */}
        <path
          d="M 164 336 L 348 334"
          stroke="#3F3F46"
          strokeWidth="18"
          strokeLinecap="round"
        />
        <rect
          x="212"
          y="314"
          width="148"
          height="42"
          rx="20"
          fill="#27272A"
          stroke="#A1A1AA"
          strokeWidth="3"
        />
        <circle cx="238" cy="335" r="14" fill="#18181B" stroke="#71717A" strokeWidth="2.5" />
        <circle cx="336" cy="335" r="15" fill="#18181B" stroke="#FFD700" strokeWidth="2.5" />
        {/* Boxy PA50 top tube & rectangular tank */}
        <path
          d="M 272 240 L 348 334 L 516 208 L 548 168"
          fill="none"
          stroke={colorHex}
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="324"
          y="134"
          width="156"
          height="52"
          rx="10"
          fill={colorHex}
          stroke="#18181B"
          strokeWidth="4"
        />
        {/* Tank stripe & cap */}
        <rect x="336" y="154" width="132" height="11" fill={accentHex} />
        <rect x="444" y="124" width="24" height="10" rx="3" fill="#D4D4D8" stroke="#18181B" strokeWidth="2" />
        {/* Rear shocks */}
        <line x1="176" y1="322" x2="246" y2="238" stroke="#E4E4E7" strokeWidth="7" strokeLinecap="round" />
        <line x1="184" y1="312" x2="238" y2="248" stroke="#18181B" strokeWidth="9" strokeDasharray="4 5" />
        {/* Saddle */}
        <path
          d="M 218 216 Q 255 198 314 210 L 308 238 L 216 236 Z"
          fill="#18181B"
          stroke="#71717A"
          strokeWidth="3"
        />
        {/* Front forks & fender */}
        <line x1="544" y1="146" x2="624" y2="336" stroke="#E4E4E7" strokeWidth="10" strokeLinecap="round" />
        <line x1="556" y1="172" x2="616" y2="316" stroke={colorHex} strokeWidth="14" strokeLinecap="round" />
        <path
          d="M 556 274 Q 624 236 686 286"
          fill="none"
          stroke={colorHex}
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Tall Hobbit handlebars & square retro headlight */}
        <path
          d="M 544 148 L 520 82 L 478 78"
          fill="none"
          stroke="#E4E4E7"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="462" y="71" width="28" height="13" rx="6" fill="#18181B" stroke="#71717A" strokeWidth="2" />
        <rect x="558" y="138" width="32" height="32" rx="5" fill="#18181B" stroke="#E4E4E7" strokeWidth="3" />
        <rect x="582" y="143" width="10" height="22" rx="2" fill="#FEF08A" />
      </g>
    );
  }

  if (make === "derbi-variant") {
    return (
      <g>
        {/* Sleek rear tail & fender */}
        <path
          d="M 108 302 Q 158 228 242 252"
          fill="none"
          stroke={colorHex}
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Swingarm */}
        <path
          d="M 164 336 L 368 334"
          stroke="#52525B"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* Rear shocks (sport angle) */}
        <line x1="176" y1="322" x2="262" y2="232" stroke="#EF4444" strokeWidth="7" strokeLinecap="round" />
        <line x1="186" y1="310" x2="252" y2="242" stroke="#18181B" strokeWidth="9" strokeDasharray="4 4" />
        {/* Sculpted Derbi Variant frame & top tank */}
        <path
          d="M 248 234 L 368 334 L 516 254 L 548 164"
          fill="none"
          stroke={colorHex}
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 352 178 Q 422 134 522 152 L 512 204 L 364 218 Z"
          fill={colorHex}
          stroke="#18181B"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path d="M 366 184 L 508 172 L 504 184 L 368 196 Z" fill={accentHex} />
        <rect x="466" y="138" width="22" height="10" rx="3" fill="#E4E4E7" stroke="#18181B" strokeWidth="2" />
        {/* Long sport banana saddle */}
        <path
          d="M 178 206 L 352 192 L 356 226 L 182 232 Z"
          fill="#18181B"
          stroke="#71717A"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {/* Front telescopic fork & sport fairing */}
        <line x1="546" y1="150" x2="626" y2="336" stroke="#D4D4D8" strokeWidth="10" strokeLinecap="round" />
        <line x1="556" y1="178" x2="588" y2="254" stroke="#18181B" strokeWidth="15" strokeLinecap="round" />
        <path
          d="M 556 278 Q 624 242 686 286"
          fill="none"
          stroke={colorHex}
          strokeWidth="9"
          strokeLinecap="round"
        />
        {/* Low-rise sport bars & cowl */}
        <path
          d="M 544 150 L 528 106 L 490 108"
          fill="none"
          stroke="#E4E4E7"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <rect x="472" y="101" width="28" height="13" rx="6" fill="#18181B" stroke="#71717A" strokeWidth="2" />
        <path
          d="M 548 124 L 594 142 L 584 186 L 544 176 Z"
          fill={colorHex}
          stroke="#18181B"
          strokeWidth="3"
        />
        <polygon points="586,144 596,147 590,176 581,174" fill="#FEF08A" />
      </g>
    );
  }

  if (make === "tomos-a35") {
    return (
      <g>
        {/* Rear fender & heavy Dutch rack */}
        <path
          d="M 104 306 Q 158 228 248 258"
          fill="none"
          stroke={colorHex}
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 108 238 L 222 238 L 210 264 L 122 264 Z"
          fill="none"
          stroke="#18181B"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <path
          d="M 108 238 L 222 238"
          stroke="#D4D4D8"
          strokeWidth="3"
        />
        {/* Boxy swingarm & rear shocks */}
        <path d="M 164 336 L 356 334" stroke={colorHex} strokeWidth="14" strokeLinecap="round" />
        <line x1="176" y1="322" x2="246" y2="236" stroke="#E4E4E7" strokeWidth="7" strokeLinecap="round" />
        <line x1="184" y1="312" x2="238" y2="246" stroke="#18181B" strokeWidth="9" strokeDasharray="4 4" />
        {/* Iconic chunky Tomos A35 stamped diagonal fuel-tank backbone */}
        <path
          d="M 244 248 L 352 332 L 534 196 L 548 156 L 494 172 L 336 274 L 258 224 Z"
          fill={colorHex}
          stroke="#18181B"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        {/* Tank accent graphic & cap */}
        <path d="M 358 272 L 502 184 L 512 196 L 368 286 Z" fill={accentHex} />
        <rect x="478" y="160" width="22" height="10" rx="3" fill="#18181B" stroke="#E4E4E7" strokeWidth="2" />
        {/* Side plastic panel */}
        <polygon
          points="296,266 368,266 382,318 308,318"
          fill="#18181B"
          stroke="#52525B"
          strokeWidth="2.5"
        />
        {/* Padded Tomos seat */}
        <path
          d="M 206 206 Q 260 194 316 208 L 308 238 L 210 236 Z"
          fill="#18181B"
          stroke="#71717A"
          strokeWidth="3"
        />
        {/* Front forks & fender */}
        <line x1="546" y1="150" x2="624" y2="336" stroke="#D4D4D8" strokeWidth="10" strokeLinecap="round" />
        <line x1="560" y1="184" x2="588" y2="252" stroke="#18181B" strokeWidth="15" strokeLinecap="round" />
        <path
          d="M 556 278 Q 624 238 686 286"
          fill="none"
          stroke={colorHex}
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Bars & Tomos rectangular headlight pod */}
        <path
          d="M 544 150 L 526 94 L 484 92"
          fill="none"
          stroke="#E4E4E7"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <rect x="466" y="85" width="28" height="13" rx="6" fill="#18181B" stroke="#71717A" strokeWidth="2" />
        <rect x="556" y="138" width="34" height="28" rx="4" fill="#18181B" stroke="#E4E4E7" strokeWidth="2.5" />
        <rect x="582" y="142" width="10" height="20" rx="2" fill="#FEF08A" />
      </g>
    );
  }

  // Default: Puch Maxi (iconic stamped step-through sheet-metal backbone!)
  return (
    <g>
      {/* Rear stamped fender & slim chrome luggage rack */}
      <path
        d="M 104 304 Q 160 226 250 256"
        fill="none"
        stroke={colorHex}
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d="M 110 242 L 218 242 L 200 272 L 130 272"
        fill="none"
        stroke="#D4D4D8"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      {/* Rear shocks */}
      <line x1="172" y1="322" x2="236" y2="238" stroke="#E4E4E7" strokeWidth="7" strokeLinecap="round" />
      <line x1="180" y1="312" x2="228" y2="248" stroke="#18181B" strokeWidth="9" strokeDasharray="4 4" />
      {/* Rear triangle stays */}
      <path d="M 164 336 L 348 332" stroke={colorHex} strokeWidth="12" strokeLinecap="round" />
      {/* Iconic Puch Maxi stamped step-through backbone tank frame */}
      <path
        d="M 234 242 L 320 278 L 516 172 L 548 158 L 540 198 L 352 332 L 296 318 L 222 254 Z"
        fill={colorHex}
        stroke="#18181B"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {/* Maxi accent stripe & chrome gas cap */}
      <path d="M 340 282 L 512 186 L 520 198 L 348 294 Z" fill={accentHex} />
      <rect x="474" y="164" width="22" height="10" rx="3" fill="#E4E4E7" stroke="#18181B" strokeWidth="2" />
      {/* Seat post & classic Puch spring saddle */}
      <line x1="274" y1="224" x2="288" y2="264" stroke="#D4D4D8" strokeWidth="8" strokeLinecap="round" />
      <path
        d="M 222 206 Q 268 192 316 206 L 306 232 L 224 230 Z"
        fill="#18181B"
        stroke="#71717A"
        strokeWidth="3"
      />
      {/* Front forks & front fender */}
      <line x1="546" y1="150" x2="624" y2="336" stroke="#E4E4E7" strokeWidth="10" strokeLinecap="round" />
      <line x1="552" y1="164" x2="594" y2="262" stroke={colorHex} strokeWidth="14" strokeLinecap="round" />
      <path
        d="M 556 276 Q 624 236 686 286"
        fill="none"
        stroke={colorHex}
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* Swept chrome handlebars & classic round headlight */}
      <path
        d="M 544 150 L 524 88 L 478 86"
        fill="none"
        stroke="#E4E4E7"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="462" y="79" width="28" height="13" rx="6" fill="#18181B" stroke="#71717A" strokeWidth="2" />
      <circle cx="574" cy="154" r="18" fill="#18181B" stroke="#E4E4E7" strokeWidth="3.5" />
      <path d="M 584 139 A 16 16 0 0 1 584 169 Z" fill="#FEF08A" />
    </g>
  );
}

export function MopedWorkbench({
  bike,
  selectedTool,
  garageFuelDrip,
  bikeNeedsAttention,
  lastHotspot,
  onHotspotClick,
}: MopedWorkbenchProps) {
  const [hoveredSpot, setHoveredSpot] = useState<HotspotId | null>(null);

  const exhaustVisual = getPartById(bike.parts.exhaust)?.visualTag ?? "stock";
  const cylinderVisual = getPartById(bike.parts.cylinder)?.visualTag ?? "stock";
  const airFilterVisual =
    getPartById(bike.parts["air-filter"])?.visualTag ?? "stock";

  const activeToolSpec = getToolById(selectedTool);
  const validHotspots = new Set<HotspotId>(
    activeToolSpec?.validHotspots ?? [],
  );
  const hotspots = getHotspotsForMake(bike.make);

  return (
    <section
      aria-label="Interactive moped workbench"
      className="border-4 border-[#FFD700] bg-zinc-950 shadow-[6px_6px_0px_0px_#FFD700]"
    >
      {/* Workbench Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-zinc-800 bg-black px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span
            className="h-3.5 w-3.5 shrink-0 border-2 border-white"
            style={{ backgroundColor: bike.colorHex }}
            aria-hidden="true"
          />
          <div>
            <h2
              className="text-base font-bold uppercase tracking-wider text-[#FFD700]"
              style={{
                fontFamily: "var(--font-russo-one), 'Russo One', sans-serif",
              }}
            >
              {bike.nickname}
            </h2>
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
              {MAKE_LABELS[bike.make]} &bull;{" "}
              {(bike.odometerM / 1609.34).toFixed(1)} MI ON ODO
            </p>
          </div>
        </div>

        {/* Observable Status Chips (zero internal fault IDs!) */}
        <div className="flex flex-wrap items-center gap-1.5">
          {bike.tuning.killSwitchOn ? (
            <span className="inline-flex items-center gap-1 border-2 border-red-500 bg-red-950 px-2 py-0.5 text-[11px] font-black uppercase text-red-200">
              <PowerOff className="h-3 w-3" aria-hidden="true" />
              Kill Switch: OFF (KILLED)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 border-2 border-emerald-500/70 bg-emerald-950/60 px-2 py-0.5 text-[11px] font-black uppercase text-emerald-200">
              <Power className="h-3 w-3" aria-hidden="true" />
              Kill Switch: RUN
            </span>
          )}
          {!bike.tuning.hasPremixOil && (
            <span className="inline-flex items-center gap-1 border-2 border-red-500 bg-red-950 px-2 py-0.5 text-[11px] font-black uppercase text-red-200">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              No Premix Oil
            </span>
          )}
          {garageFuelDrip && (
            <span className="inline-flex items-center gap-1 border-2 border-amber-400 bg-amber-950 px-2 py-0.5 text-[11px] font-black uppercase text-amber-200">
              <Droplets className="h-3 w-3" aria-hidden="true" />
              Fuel Drip!
            </span>
          )}
          {bikeNeedsAttention ? (
            <span className="inline-flex items-center gap-1 border-2 border-[#FFD700] bg-[#FFD700]/15 px-2 py-0.5 text-[11px] font-black uppercase text-[#FFD700]">
              <Wrench className="h-3 w-3" aria-hidden="true" />
              Needs Wrenching
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 border-2 border-emerald-400 bg-emerald-950 px-2 py-0.5 text-[11px] font-black uppercase text-emerald-200">
              Dialed &amp; Ready
            </span>
          )}
        </div>
      </div>

      {/* Main SVG Canvas + Overlaid Accessible Hotspot Buttons */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#0A0A0D]">
        <svg
          viewBox="0 0 800 480"
          role="img"
          aria-label={`${bike.nickname} (${MAKE_LABELS[bike.make]}) side-view garage diagram`}
          className="h-full w-full select-none"
        >
          <defs>
            <pattern
              id="workbench-grid"
              width="32"
              height="32"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 32 0 L 0 0 0 32"
                fill="none"
                stroke="#1E293B"
                strokeWidth="1"
              />
            </pattern>
            <radialGradient id="floor-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFD700" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="chrome-pipe" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F4F4F5" />
              <stop offset="45%" stopColor="#A1A1AA" />
              <stop offset="100%" stopColor="#3F3F46" />
            </linearGradient>
            <linearGradient id="race-pipe" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#52525B" />
              <stop offset="35%" stopColor="#D4D4D8" />
              <stop offset="65%" stopColor="#71717A" />
              <stop offset="100%" stopColor="#27272A" />
            </linearGradient>
          </defs>

          {/* Blueprint Grid & Lift Table */}
          <rect width="800" height="480" fill="#09090B" />
          <rect width="800" height="420" fill="url(#workbench-grid)" />
          <ellipse cx="400" cy="414" rx="310" ry="26" fill="url(#floor-glow)" />

          {/* Workbench Lift Deck */}
          <rect x="28" y="410" width="744" height="18" fill="#18181B" stroke="#FFD700" strokeWidth="3" />
          <rect x="64" y="428" width="672" height="12" fill="#27272A" />
          {/* Center kickstand */}
          <path
            d="M 358 352 L 336 410 M 368 352 L 382 410"
            stroke="#71717A"
            strokeWidth="6"
            strokeLinecap="round"
          />

          {/* Fuel Drip Puddle under carburetor when garageFuelDrip is true */}
          {garageFuelDrip && (
            <g>
              <ellipse
                cx="374"
                cy="416"
                rx="46"
                ry="8"
                fill="#F59E0B"
                opacity="0.7"
              />
              <ellipse
                cx="374"
                cy="415"
                rx="28"
                ry="4.5"
                fill="#38BDF8"
                opacity="0.55"
              />
              <circle
                cx="374"
                cy="346"
                r="4"
                fill="#FBBF24"
                className="animate-bounce motion-reduce:animate-none"
              />
              <circle
                cx="374"
                cy="382"
                r="3.5"
                fill="#F59E0B"
                className="animate-pulse motion-reduce:animate-none"
              />
            </g>
          )}

          {/* WHEELS (Rear @ 164,336 and Front @ 624,336) */}
          {[
            { cx: 164, cy: 336, isRear: true },
            { cx: 624, cy: 336, isRear: false },
          ].map(({ cx, cy, isRear }) => (
            <g key={cx}>
              {/* Rubber tire */}
              <circle cx={cx} cy={cy} r="72" fill="#111114" stroke="#27272A" strokeWidth="4" />
              {/* Rim */}
              <circle cx={cx} cy={cy} r="54" fill="none" stroke="#E4E4E7" strokeWidth="6" />
              {/* Spokes */}
              {[0, 30, 60, 90, 120, 150].map((deg) => {
                const rad = (deg * Math.PI) / 180;
                const dx = Math.cos(rad) * 52;
                const dy = Math.sin(rad) * 52;
                return (
                  <line
                    key={deg}
                    x1={cx - dx}
                    y1={cy - dy}
                    x2={cx + dx}
                    y2={cy + dy}
                    stroke="#71717A"
                    strokeWidth="2"
                  />
                );
              })}
              {/* Hub & Rear Sprocket */}
              {isRear && (
                <circle
                  cx={cx}
                  cy={cy}
                  r="24"
                  fill="#27272A"
                  stroke="#A1A1AA"
                  strokeWidth="3"
                  strokeDasharray="4 3"
                />
              )}
              <circle cx={cx} cy={cy} r="13" fill="#18181B" stroke="#FFD700" strokeWidth="3" />
            </g>
          ))}

          {/* Drive Chain */}
          <line x1="164" y1="316" x2="348" y2="328" stroke="#A1A1AA" strokeWidth="3" strokeDasharray="5 3" />
          <line x1="164" y1="354" x2="348" y2="348" stroke="#71717A" strokeWidth="3" strokeDasharray="5 3" />

          {/* EXHAUST (changes dramatically with stock / performance / race upgrade!) */}
          {exhaustVisual === "race" ? (
            <g>
              {/* Full welded race expansion chamber */}
              <path
                d="M 456 326 C 446 376, 396 396, 338 386 C 282 376, 250 364, 212 368 L 194 378 L 210 388 C 254 388, 294 404, 348 408 C 414 410, 464 382, 472 330 Z"
                fill="url(#race-pipe)"
                stroke="#FFD700"
                strokeWidth="3"
              />
              {/* Welded cone seam lines */}
              <line x1="398" y1="376" x2="404" y2="399" stroke="#18181B" strokeWidth="2.5" />
              <line x1="348" y1="386" x2="350" y2="408" stroke="#18181B" strokeWidth="2.5" />
              <line x1="296" y1="376" x2="294" y2="398" stroke="#18181B" strokeWidth="2.5" />
              {/* Gold anodized stinger silencer */}
              <rect
                x="118"
                y="364"
                width="82"
                height="20"
                rx="6"
                fill="#FFD700"
                stroke="#18181B"
                strokeWidth="3"
              />
              <rect x="108" y="370" width="12" height="8" rx="2" fill="#27272A" />
            </g>
          ) : exhaustVisual === "performance" ? (
            <g>
              {/* Performance sweeping chrome pipe with mid-expansion cone */}
              <path
                d="M 456 326 Q 438 384 364 384 L 222 374 L 160 368 L 160 388 L 224 394 L 368 400 Q 454 398 470 330 Z"
                fill="url(#chrome-pipe)"
                stroke="#18181B"
                strokeWidth="3"
              />
              <rect
                x="136"
                y="366"
                width="52"
                height="22"
                rx="5"
                fill="#27272A"
                stroke="#FFD700"
                strokeWidth="2.5"
              />
            </g>
          ) : (
            <g>
              {/* Stock black/chrome cigar muffler */}
              <path
                d="M 458 326 Q 446 376 390 378 L 184 378 L 184 394 L 392 394 Q 460 392 470 330 Z"
                fill="#3F3F46"
                stroke="#18181B"
                strokeWidth="3"
              />
              <rect
                x="166"
                y="374"
                width="126"
                height="24"
                rx="10"
                fill="url(#chrome-pipe)"
                stroke="#18181B"
                strokeWidth="3"
              />
            </g>
          )}

          {/* BIKE MAKE-SPECIFIC FRAME */}
          <BikeFrameGeometry
            make={bike.make}
            colorHex={bike.colorHex}
            accentHex={bike.accentHex}
          />

          {/* ENGINE CASES, CRANKCASE, CLUTCH & IGNITION */}
          <g>
            {/* Engine main case */}
            <rect
              x="332"
              y="302"
              width="104"
              height="56"
              rx="14"
              fill="#52525B"
              stroke="#18181B"
              strokeWidth="3.5"
            />
            {/* Clutch side cover */}
            <circle cx="356" cy="332" r="22" fill="#3F3F46" stroke="#D4D4D8" strokeWidth="2.5" />
            <circle cx="356" cy="332" r="8" fill="#18181B" />
            {/* Ignition / Flywheel stator cover */}
            <circle cx="408" cy="332" r="20" fill="#27272A" stroke="#A1A1AA" strokeWidth="2.5" />
            <circle cx="408" cy="332" r="6" fill="#FFD700" />
            {/* Pedal crank arm */}
            <line x1="356" y1="332" x2="326" y2="372" stroke="#E4E4E7" strokeWidth="6" strokeLinecap="round" />
            <rect x="308" y="368" width="28" height="10" rx="3" fill="#18181B" stroke="#A1A1AA" strokeWidth="2" />
          </g>

          {/* CYLINDER & HEAD (scales visually for stock 50cc / performance / 70cc race kit!) */}
          {cylinderVisual === "race" ? (
            <g>
              {/* Chunky oversized 70cc finned race kit */}
              <rect
                x="426"
                y="264"
                width="68"
                height="62"
                rx="6"
                fill="#27272A"
                stroke="#FFD700"
                strokeWidth="3"
              />
              {[273, 282, 291, 300, 309, 318].map((y) => (
                <line
                  key={y}
                  x1="422"
                  y1={y}
                  x2="498"
                  y2={y}
                  stroke="#E4E4E7"
                  strokeWidth="3"
                />
              ))}
              {/* High-comp race head */}
              <polygon
                points="488,266 510,276 510,316 488,324"
                fill="#52525B"
                stroke="#FFD700"
                strokeWidth="2.5"
              />
            </g>
          ) : cylinderVisual === "performance" ? (
            <g>
              {/* Performance alloy cylinder */}
              <rect
                x="426"
                y="272"
                width="60"
                height="52"
                rx="5"
                fill="#3F3F46"
                stroke="#E4E4E7"
                strokeWidth="2.5"
              />
              {[281, 290, 299, 308, 317].map((y) => (
                <line
                  key={y}
                  x1="424"
                  y1={y}
                  x2="488"
                  y2={y}
                  stroke="#D4D4D8"
                  strokeWidth="2.5"
                />
              ))}
              <rect x="484" y="276" width="16" height="44" rx="3" fill="#71717A" stroke="#18181B" strokeWidth="2" />
            </g>
          ) : (
            <g>
              {/* Stock 50cc finned cylinder */}
              <rect
                x="426"
                y="280"
                width="52"
                height="42"
                rx="4"
                fill="#71717A"
                stroke="#18181B"
                strokeWidth="2.5"
              />
              {[288, 297, 306, 315].map((y) => (
                <line
                  key={y}
                  x1="426"
                  y1={y}
                  x2="478"
                  y2={y}
                  stroke="#18181B"
                  strokeWidth="2.5"
                />
              ))}
              <rect x="476" y="283" width="14" height="36" rx="3" fill="#A1A1AA" stroke="#18181B" strokeWidth="2" />
            </g>
          )}

          {/* SPARK PLUG & HT BOOT */}
          <g>
            <line x1="490" y1="286" x2="508" y2="268" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" />
            <path
              d="M 504 272 L 516 258 Q 524 238 494 224"
              fill="none"
              stroke="#EF4444"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </g>

          {/* INTAKE MANIFOLD, CARBURETOR, AIR FILTER & FUEL LINE */}
          <g>
            {/* Intake manifold + gasket */}
            <path
              d="M 432 288 Q 418 272 396 284"
              fill="none"
              stroke="#A1A1AA"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <line x1="428" y1="278" x2="434" y2="294" stroke="#22D3EE" strokeWidth="3.5" />

            {/* Carburetor body & float bowl */}
            <rect
              x="362"
              y="274"
              width="34"
              height="36"
              rx="4"
              fill="#D4D4D8"
              stroke="#18181B"
              strokeWidth="2.5"
            />
            <rect
              x="366"
              y="296"
              width="26"
              height="16"
              rx="3"
              fill="#A1A1AA"
              stroke="#18181B"
              strokeWidth="2"
            />

            {/* Air Filter: Stock plastic box vs Performance red/gold mesh pod filter */}
            {airFilterVisual === "performance" || airFilterVisual === "race" ? (
              <g>
                <polygon
                  points="362,280 326,272 322,304 362,300"
                  fill="#DC2626"
                  stroke="#FFD700"
                  strokeWidth="2.5"
                />
                <line x1="350" y1="278" x2="348" y2="301" stroke="#18181B" strokeWidth="2" />
                <line x1="338" y1="275" x2="336" y2="302" stroke="#18181B" strokeWidth="2" />
                <rect x="318" y="272" width="7" height="32" rx="2" fill="#E4E4E7" />
              </g>
            ) : (
              <rect
                x="324"
                y="272"
                width="38"
                height="32"
                rx="5"
                fill="#18181B"
                stroke="#52525B"
                strokeWidth="2.5"
              />
            )}

            {/* Fuel line & inline translucent filter from tank down to carb */}
            <path
              d="M 402 204 Q 364 226 376 274"
              fill="none"
              stroke="#FACC15"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <rect
              x="362"
              y="234"
              width="16"
              height="24"
              rx="5"
              fill="#FEF08A"
              fillOpacity="0.85"
              stroke="#18181B"
              strokeWidth="2"
            />
            <line x1="364" y1="246" x2="376" y2="246" stroke="#EA580C" strokeWidth="3" />
          </g>

          {/* Visual Upgrade Callout Badges inside SVG */}
          <g transform="translate(16, 16)">
            <rect width="176" height="58" fill="#09090B" fillOpacity="0.88" stroke="#3F3F46" strokeWidth="2" />
            <text x="10" y="18" fill="#A1A1AA" fontSize="10" fontWeight="900" fontFamily="monospace">
              INSTALLED VISUALS
            </text>
            <text x="10" y="34" fill="#FFD700" fontSize="11" fontWeight="900" fontFamily="monospace">
              PIPE: {exhaustVisual.toUpperCase()} &bull; CYL: {cylinderVisual.toUpperCase()}
            </text>
            <text x="10" y="49" fill="#E4E4E7" fontSize="11" fontWeight="700" fontFamily="monospace">
              AIR: {airFilterVisual.toUpperCase()} &bull; JET: #{bike.tuning.mainJet}
            </text>
          </g>
        </svg>

        {/* Interactive Overlaid Accessible <button> Hotspots */}
        {hotspots.map((spot) => {
          const isValid = validHotspots.has(spot.id);
          const isLast = lastHotspot === spot.id;
          const isHovered = hoveredSpot === spot.id;
          const tooltipId = `workbench-hotspot-tip-${spot.id}`;

          return (
            <button
              key={spot.id}
              type="button"
              onClick={() => onHotspotClick(spot.id)}
              onMouseEnter={() => setHoveredSpot(spot.id)}
              onMouseLeave={() => setHoveredSpot(null)}
              onFocus={() => setHoveredSpot(spot.id)}
              onBlur={() => setHoveredSpot(null)}
              aria-label={`Use ${activeToolSpec?.name ?? selectedTool} on ${spot.label}${isValid ? " (recommended target)" : ""}`}
              aria-describedby={isHovered ? tooltipId : undefined}
              style={{
                left: `${spot.xPct}%`,
                top: `${spot.yPct}%`,
              }}
              className={`group absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform hover:z-30 focus-visible:z-30 focus-visible:scale-125 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FFD700] ${
                isValid
                  ? "h-8 w-8 sm:h-9 sm:w-9"
                  : "h-6 w-6 opacity-75 hover:opacity-100"
              }`}
            >
              {/* Pulsing target ring for valid tool hotspots */}
              {isValid && (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 animate-ping rounded-full bg-[#FFD700]/60 motion-reduce:animate-none"
                />
              )}
              <span
                aria-hidden="true"
                className={`relative flex h-full w-full items-center justify-center rounded-full border-2 font-black shadow-[0_0_0_2px_rgba(0,0,0,0.9)] transition-colors ${
                  isValid
                    ? isLast
                      ? "border-black bg-cyan-400 text-black"
                      : "border-black bg-[#FFD700] text-black group-hover:bg-white"
                    : "border-zinc-400 bg-zinc-900/90 text-zinc-300 group-hover:border-[#FFD700] group-hover:text-[#FFD700]"
                }`}
              >
                <Crosshair
                  className={isValid ? "h-4 w-4" : "h-3 w-3"}
                  aria-hidden="true"
                />
              </span>

              {/* Tooltip (hover/focus only so neighboring pins stay unobstructed) */}
              {isHovered && (
                <span
                  id={tooltipId}
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 -translate-x-1/2 whitespace-nowrap border-2 border-[#FFD700] bg-black px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-[#FFD700] shadow-[3px_3px_0px_0px_#000]"
                >
                  {spot.label}
                  {isValid ? " • CLICK" : ""}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Quick Accessible Hotspot Strip (great for mobile & keyboard users) */}
      <div className="border-t-2 border-zinc-800 bg-black px-3 py-2.5">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
          <span>
            Active Tool:{" "}
            <strong className="text-[#FFD700]">
              {activeToolSpec?.name ?? selectedTool}
            </strong>
          </span>
          <span>Click any glowing gold pin or tap a part below</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {hotspots.map((spot) => {
            const isValid = validHotspots.has(spot.id);
            return (
              <button
                key={spot.id}
                type="button"
                onClick={() => onHotspotClick(spot.id)}
                className={`border-2 px-2 py-1 text-[11px] font-black uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] ${
                  isValid
                    ? "border-[#FFD700] bg-[#FFD700]/15 text-[#FFD700] hover:bg-[#FFD700] hover:text-black"
                    : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-500 hover:text-white"
                }`}
              >
                {spot.short}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
