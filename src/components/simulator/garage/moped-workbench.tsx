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
  BikeVerdict,
  HotspotId,
  OwnedBike,
  RideTelemetrySnapshot,
  SimBikeMake,
  SmokeTint,
  ToolId,
} from "@/lib/simulator/contract";
import { getToolById } from "@/lib/simulator/diagnostics/tools";
import { getPartById } from "@/lib/simulator/economy/catalog";

export interface MopedWorkbenchProps {
  bike: OwnedBike;
  selectedTool: ToolId;
  garageFuelDrip: boolean;
  bikeVerdict: BikeVerdict;
  standTest?: RideTelemetrySnapshot | null;
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
  { id: "gas-tank", label: "Gas Tank & Petcock", short: "Tank", xPct: 58, yPct: 47 },
  { id: "fuel-filter", label: "Inline Fuel Filter", short: "Fuel Line", xPct: 43, yPct: 52 },
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
      // Hobbit tank sits in rear subframe/under-rack; variator cover stretches along swingarm
      if (spot.id === "gas-tank") return { ...spot, xPct: 33, yPct: 54 };
      if (spot.id === "clutch") return { ...spot, xPct: 34, yPct: 71 };
      if (spot.id === "carburetor") return { ...spot, xPct: 45, yPct: 63 };
    }
    if (make === "derbi-variant") {
      // Derbi Variant SL tank is the boxy trapezoidal enclosure under the flat bench seat
      if (spot.id === "gas-tank") return { ...spot, xPct: 37, yPct: 55 };
      if (spot.id === "fuel-filter") return { ...spot, xPct: 41, yPct: 54 };
      if (spot.id === "spark-plug") return { ...spot, xPct: 64, yPct: 57 };
    }
    if (make === "tomos-a35") {
      if (spot.id === "gas-tank") return { ...spot, xPct: 58, yPct: 46 };
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
    // Authentic Honda Hobbit PA50 (from stable photos: yellowhobbit.jpeg, redhobbit.jpeg, milisMopeds/hobbit.JPG):
    // Deep open step-through U-frame, signature white/cream front downtube leg-shield & footboard,
    // long silver horizontal vented variator swingarm cover, sloped high-back solo saddle,
    // chrome wrap-around rear rack, and painted hooded rectangular retro headlight.
    return (
      <g>
        {/* Curved painted rear fender & taillight */}
        <path
          d="M 102 312 Q 154 232 248 256"
          fill="none"
          stroke={colorHex}
          strokeWidth="12"
          strokeLinecap="round"
        />
        <rect x="92" y="258" width="20" height="18" rx="3" fill="#DC2626" stroke="#18181B" strokeWidth="2.5" />
        {/* Signature wrap-around chrome rear luggage rack */}
        <path
          d="M 106 226 L 234 226 M 126 226 L 106 272 L 194 276 L 222 226"
          fill="none"
          stroke="#E4E4E7"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Chunky shrouded Honda Hobbit rear shocks (cream/silver upper covers) */}
        <line x1="170" y1="326" x2="226" y2="232" stroke="#D4D4D8" strokeWidth="7" strokeLinecap="round" />
        <line x1="196" y1="282" x2="224" y2="235" stroke="#F4F4F5" strokeWidth="13" strokeLinecap="round" />
        <line x1="196" y1="282" x2="224" y2="235" stroke="#18181B" strokeWidth="2" />
        {/* Iconic long silver vented horizontal PA50 variator / belt-drive swingarm housing */}
        <path
          d="M 150 322 Q 150 304 176 304 L 364 314 Q 382 318 382 336 Q 382 354 360 356 L 176 360 Q 150 358 150 338 Z"
          fill="#A1A1AA"
          stroke="#18181B"
          strokeWidth="3.5"
        />
        {/* Variator cooling louvers & rear clutch housing */}
        {[236, 250, 264, 278, 292, 306].map((vx) => (
          <line key={vx} x1={vx} y1="324" x2={vx} y2="344" stroke="#3F3F46" strokeWidth="3" strokeLinecap="round" />
        ))}
        <circle cx="178" cy="333" r="18" fill="#71717A" stroke="#18181B" strokeWidth="2.5" />
        <circle cx="352" cy="335" r="14" fill="#52525B" stroke="#18181B" strokeWidth="2.5" />
        {/* Rear painted U-frame sweep up to seat/subframe */}
        <path
          d="M 224 226 L 266 226 L 306 286 Q 320 304 352 304 L 424 304 L 542 170 L 528 154 L 414 282 L 346 282 Q 326 282 316 266 L 274 222 L 224 222 Z"
          fill={colorHex}
          stroke="#18181B"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        {/* Signature WHITE / CREAM plastic Hobbit downtube leg-shield & flat footboard */}
        <path
          d="M 326 290 L 424 290 L 528 176 L 544 190 L 434 310 L 326 310 Z"
          fill="#FAFAF9"
          stroke="#18181B"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        {/* Subtle HONDA downtube stripe */}
        <path d="M 438 280 L 516 196" stroke="#18181B" strokeWidth="5" strokeLinecap="round" opacity="0.7" />
        <rect x="336" y="295" width="84" height="6" rx="2" fill="#D4D4D8" />
        {/* Signature Hobbit sloped chunky black solo saddle (higher at rear, sloped forward) */}
        <path
          d="M 198 186 Q 222 178 242 192 L 310 202 Q 318 208 310 226 L 200 226 Q 192 212 198 186 Z"
          fill="#18181B"
          stroke="#52525B"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {/* Painted Hobbit front forks & front fender */}
        <line x1="542" y1="150" x2="624" y2="336" stroke="#E4E4E7" strokeWidth="9" strokeLinecap="round" />
        <line x1="544" y1="156" x2="588" y2="256" stroke={colorHex} strokeWidth="14" strokeLinecap="round" />
        {/* Front rectangular Honda horn/emblem plate on fork crown */}
        <rect x="546" y="168" width="18" height="30" rx="3" fill={colorHex} stroke="#18181B" strokeWidth="2.5" />
        <line x1="550" y1="180" x2="560" y2="180" stroke="#18181B" strokeWidth="2" />
        <line x1="550" y1="186" x2="560" y2="186" stroke="#18181B" strokeWidth="2" />
        {/* Front fender */}
        <path
          d="M 556 278 Q 624 238 686 286"
          fill="none"
          stroke={colorHex}
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Tall swept chrome cruiser handlebars */}
        <path
          d="M 542 150 L 520 84 L 474 88"
          fill="none"
          stroke="#E4E4E7"
          strokeWidth="7.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="458" y="81" width="28" height="13" rx="6" fill="#18181B" stroke="#71717A" strokeWidth="2" />
        {/* Iconic body-color hooded rectangular retro Hobbit headlight */}
        <path
          d="M 552 132 L 588 136 L 592 164 L 552 166 Z"
          fill={colorHex}
          stroke="#18181B"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <rect x="582" y="139" width="11" height="22" rx="2" fill="#FEF08A" stroke="#18181B" strokeWidth="2" />
        {/* Amber front turn indicator */}
        <circle cx="562" cy="176" r="6" fill="#F59E0B" stroke="#18181B" strokeWidth="2" />
      </g>
    );
  }

  if (make === "derbi-variant") {
    // Authentic Derbi Variant SL (from stable photos: whitederbisl.jpeg & blackderbisl.jpeg):
    // Deep low step-through pressed-steel monocoque — NO top tank, NO fairing!
    // Boxy trapezoidal rear under-seat body/tank enclosure with "DERBI SL" crest,
    // long flat black bench seat sitting flush on top, flat horizontal lower spine ("DERBI")
    // curving cleanly up a steep ribbed diagonal front downtube, black fork gaiter boots,
    // low swept bars, and classic round chrome headlight!
    return (
      <g>
        {/* Rear curved body-color fender & boxy red taillight */}
        <path
          d="M 96 314 Q 146 232 238 248"
          fill="none"
          stroke={colorHex}
          strokeWidth="12"
          strokeLinecap="round"
        />
        <rect x="94" y="246" width="22" height="26" rx="3" fill="#DC2626" stroke="#18181B" strokeWidth="2.5" />
        {/* Rear swingarm */}
        <path d="M 164 336 L 348 334" stroke="#27272A" strokeWidth="12" strokeLinecap="round" />
        {/* Dual angled silver coil shocks */}
        <line x1="170" y1="324" x2="224" y2="238" stroke="#D4D4D8" strokeWidth="7" strokeLinecap="round" />
        <line x1="178" y1="312" x2="216" y2="250" stroke="#18181B" strokeWidth="9.5" strokeDasharray="4 4" />
        {/* Iconic Derbi Variant SL deep step-through monocoque + boxy trapezoidal rear tank body */}
        <path
          d="M 200 226 L 336 226 L 368 292 L 454 292 Q 480 292 496 266 L 542 156 L 560 166 L 512 280 Q 492 316 454 316 L 266 316 L 246 296 L 210 248 Z"
          fill={colorHex}
          stroke="#18181B"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        {/* Stamped parallel ribs along the steep diagonal downtube & lower rail */}
        <path
          d="M 358 302 L 456 302 Q 484 302 500 274 L 546 168"
          fill="none"
          stroke={accentHex}
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.85"
        />
        {/* Signature DERBI SL laurel crest badge on the boxy rear enclosure */}
        <circle cx="292" cy="264" r="14" fill="none" stroke={accentHex} strokeWidth="2.5" opacity="0.9" />
        <text
          x="292"
          y="268"
          textAnchor="middle"
          fill={accentHex}
          fontSize="11"
          fontWeight="900"
          fontFamily="sans-serif"
        >
          SL
        </text>
        {/* Lower rail DERBI bar stripe */}
        <rect x="292" y="298" width="56" height="8" rx="2" fill="#18181B" />
        {/* Long flat black Derbi Variant bench seat sitting flush on boxy rear body */}
        <path
          d="M 184 202 Q 198 192 222 198 L 344 202 Q 350 206 346 226 L 194 226 Q 180 220 184 202 Z"
          fill="#18181B"
          stroke="#52525B"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {/* Front telescopic fork with signature BLACK FORK GAITERS */}
        <line x1="546" y1="150" x2="624" y2="336" stroke="#E4E4E7" strokeWidth="9" strokeLinecap="round" />
        <line x1="556" y1="176" x2="594" y2="266" stroke="#18181B" strokeWidth="16" strokeLinecap="round" />
        {/* Fork gaiter accordion ribs */}
        <line x1="558" y1="184" x2="592" y2="262" stroke="#3F3F46" strokeWidth="14" strokeDasharray="4 4" />
        {/* Amber side fork reflector */}
        <rect x="548" y="176" width="8" height="20" rx="2" fill="#F59E0B" stroke="#18181B" strokeWidth="1.5" />
        {/* Curved body-color front fender & silver stay */}
        <path
          d="M 556 278 Q 624 238 686 286"
          fill="none"
          stroke={colorHex}
          strokeWidth="10"
          strokeLinecap="round"
        />
        <line x1="572" y1="286" x2="624" y2="336" stroke="#D4D4D8" strokeWidth="3" />
        {/* Low-swept black handlebars */}
        <path
          d="M 544 150 L 520 116 L 466 122"
          fill="none"
          stroke="#27272A"
          strokeWidth="7.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="452" y="115" width="28" height="13" rx="6" fill="#18181B" stroke="#71717A" strokeWidth="2" />
        {/* Classic round chrome headlight (NO fairing on Variant SL!) */}
        <circle cx="574" cy="152" r="18" fill="#D4D4D8" stroke="#18181B" strokeWidth="3" />
        <path d="M 584 137 A 16 16 0 0 1 584 167 Z" fill="#FEF08A" />
      </g>
    );
  }

  if (make === "tomos-a35") {
    // Authentic Tomos A35 (from stable photo: milisMopeds/tomos.JPG):
    // Chunky straight box-section diagonal fuel-tank backbone, sleek horizontal rear side-panel body skirt,
    // angled seat tower with sculpted black saddle, rear rack, rubber fork gaiters,
    // AND signature swept aerodynamic Tomos A35 front headlight cowling!
    return (
      <g>
        {/* Rear curved fender & chrome rear rack */}
        <path
          d="M 102 308 Q 158 232 248 256"
          fill="none"
          stroke={colorHex}
          strokeWidth="11"
          strokeLinecap="round"
        />
        <path
          d="M 110 238 L 216 238 L 204 264 L 124 264"
          fill="none"
          stroke="#D4D4D8"
          strokeWidth="4.5"
          strokeLinejoin="round"
        />
        <rect x="96" y="256" width="18" height="18" rx="3" fill="#DC2626" stroke="#18181B" strokeWidth="2" />
        {/* Boxy rear swingarm & angled silver coil shocks */}
        <path d="M 164 336 L 354 334" stroke="#A1A1AA" strokeWidth="12" strokeLinecap="round" />
        <line x1="170" y1="324" x2="246" y2="238" stroke="#E4E4E7" strokeWidth="7" strokeLinecap="round" />
        <line x1="180" y1="312" x2="236" y2="250" stroke="#18181B" strokeWidth="9" strokeDasharray="4 4" />
        {/* Angled seat-post tower */}
        <path
          d="M 264 232 L 294 232 L 330 292 L 298 292 Z"
          fill={colorHex}
          stroke="#18181B"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        {/* Iconic Tomos A35 straight box-section diagonal fuel-tank backbone */}
        <path
          d="M 382 288 L 530 156 L 552 178 L 414 312 L 218 308 L 212 282 L 382 286 Z"
          fill={colorHex}
          stroke="#18181B"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        {/* Horizontal A35 side-cover trim & chrome gas cap near top of tank */}
        <rect x="234" y="290" width="146" height="8" rx="2" fill={accentHex} opacity="0.85" />
        <circle cx="516" cy="168" r="7" fill="#E4E4E7" stroke="#18181B" strokeWidth="2.5" />
        {/* Sculpted black Tomos moped saddle */}
        <path
          d="M 206 202 Q 258 190 318 204 L 310 234 L 210 232 Z"
          fill="#18181B"
          stroke="#52525B"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {/* Front telescopic forks with accordion rubber gaiters */}
        <line x1="546" y1="150" x2="624" y2="336" stroke="#E4E4E7" strokeWidth="9.5" strokeLinecap="round" />
        <line x1="564" y1="194" x2="588" y2="250" stroke="#18181B" strokeWidth="15" strokeLinecap="round" />
        <line x1="566" y1="198" x2="586" y2="246" stroke="#52525B" strokeWidth="13" strokeDasharray="3 3" />
        {/* Body-color front fender & silver stay */}
        <path
          d="M 556 276 Q 624 236 686 284"
          fill="none"
          stroke={colorHex}
          strokeWidth="10"
          strokeLinecap="round"
        />
        <line x1="572" y1="286" x2="624" y2="336" stroke="#D4D4D8" strokeWidth="3" />
        {/* Handlebars */}
        <path
          d="M 544 150 L 524 98 L 484 100"
          fill="none"
          stroke="#27272A"
          strokeWidth="7.5"
          strokeLinecap="round"
        />
        <rect x="466" y="93" width="28" height="13" rx="6" fill="#18181B" stroke="#71717A" strokeWidth="2" />
        {/* Signature Tomos A35 aerodynamic curved front headlight fairing / cowl */}
        <path
          d="M 538 106 Q 584 120 594 176 L 556 184 L 542 152 Z"
          fill={colorHex}
          stroke="#18181B"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        <polygon points="582,146 593,149 590,174 580,173" fill="#FEF08A" stroke="#18181B" strokeWidth="1.5" />
        {/* Amber front blinker */}
        <rect x="562" y="160" width="12" height="8" rx="2" fill="#F59E0B" stroke="#18181B" strokeWidth="1.5" />
      </g>
    );
  }

  // Authentic Puch Maxi (from stable photo: honesMopeds/maxi.JPG — Little Yellow Maxi!):
  // Stamped sheet-metal step-through monocoque with straight ~38° diagonal fuel tank ("PUCH"),
  // low flat step-through pan with signature chrome side trim rail, chunky flat-top rectangular
  // buddy saddle mounted low & snug on the frame tower, chrome wire rear rack, contrast black
  // front fender, black dual coil shocks, and classic round black headlight + speedo pod!
  return (
    <g>
      {/* Stamped body-color rear fender + boxy black/red taillight */}
      <path
        d="M 96 312 Q 148 228 248 250"
        fill="none"
        stroke={colorHex}
        strokeWidth="13"
        strokeLinecap="round"
      />
      <polygon points="94,252 118,248 116,272 90,268" fill="#18181B" stroke="#18181B" strokeWidth="2" />
      <rect x="92" y="253" width="8" height="14" rx="1" fill="#DC2626" />
      {/* Chrome tubular rear luggage rack flush behind seat */}
      <path
        d="M 104 226 L 204 226 M 114 226 L 128 256 L 194 256 L 200 226"
        fill="none"
        stroke="#E4E4E7"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Rear swingarm stays */}
      <path d="M 164 336 L 348 334" stroke={colorHex} strokeWidth="11" strokeLinecap="round" />
      {/* Black dual coil rear shocks */}
      <line x1="168" y1="326" x2="228" y2="238" stroke="#27272A" strokeWidth="7" strokeLinecap="round" />
      <line x1="176" y1="314" x2="220" y2="250" stroke="#18181B" strokeWidth="10" strokeDasharray="4 4" />
      {/* Iconic Puch Maxi stamped step-through monocoque + diagonal fuel tank */}
      <path
        d="M 218 232 L 294 232 L 320 288 L 404 288 L 534 156 L 552 186 L 424 318 L 284 318 L 214 252 Z"
        fill={colorHex}
        stroke="#18181B"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {/* Signature chrome side trim rail curving along rear tower & lower step-through */}
      <path
        d="M 224 248 L 284 304 L 408 304"
        fill="none"
        stroke="#F4F4F5"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Iconic black PUCH diagonal tank badge & round chrome gas cap */}
      <path d="M 432 268 L 516 188 L 525 198 L 441 278 Z" fill="#18181B" />
      <circle cx="514" cy="170" r="8" fill="#E4E4E7" stroke="#18181B" strokeWidth="2.5" />
      {/* Chunky low-mounted flat-top Puch rectangular buddy saddle (taller rear lip) */}
      <path
        d="M 196 196 Q 214 188 232 198 L 326 202 Q 332 212 322 232 L 200 232 Q 190 218 196 196 Z"
        fill="#18181B"
        stroke="#52525B"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Body-color upper fork tubes + chrome lower sliders */}
      <line x1="546" y1="150" x2="624" y2="336" stroke="#E4E4E7" strokeWidth="9.5" strokeLinecap="round" />
      <line x1="548" y1="158" x2="588" y2="254" stroke={colorHex} strokeWidth="14" strokeLinecap="round" />
      {/* Amber fork reflector */}
      <rect x="556" y="176" width="12" height="16" rx="2" fill="#F59E0B" stroke="#18181B" strokeWidth="1.5" />
      {/* Signature contrast BLACK front fender + thin silver stay rod */}
      <path
        d="M 556 276 Q 624 236 686 286"
        fill="none"
        stroke="#18181B"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d="M 556 276 Q 624 236 686 286"
        fill="none"
        stroke="#3F3F46"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <line x1="572" y1="288" x2="624" y2="336" stroke="#D4D4D8" strokeWidth="3" />
      {/* High-rise swept chrome handlebars */}
      <path
        d="M 544 150 L 520 82 L 474 86"
        fill="none"
        stroke="#E4E4E7"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="458" y="79" width="28" height="13" rx="6" fill="#18181B" stroke="#71717A" strokeWidth="2" />
      {/* Speedo pod + classic round black headlight bucket with chrome bezel */}
      <rect x="546" y="128" width="22" height="14" rx="4" fill="#18181B" stroke="#A1A1AA" strokeWidth="2" />
      <circle cx="574" cy="154" r="18" fill="#18181B" stroke="#E4E4E7" strokeWidth="3.5" />
      <path d="M 584 139 A 16 16 0 0 1 584 169 Z" fill="#FEF08A" />
    </g>
  );
}

function getFuelLineGeometry(make: SimBikeMake): {
  pathD: string;
  filterX: number;
  filterY: number;
  filterMidY: number;
} {
  if (make === "honda-hobbit") {
    return {
      pathD: "M 276 258 Q 328 248 376 274",
      filterX: 318,
      filterY: 244,
      filterMidY: 256,
    };
  }
  if (make === "derbi-variant") {
    return {
      pathD: "M 312 268 Q 344 252 376 274",
      filterX: 334,
      filterY: 248,
      filterMidY: 260,
    };
  }
  return {
    pathD: "M 438 250 Q 402 246 376 274",
    filterX: 396,
    filterY: 242,
    filterMidY: 254,
  };
}

function getTailpipeTip(exhaustVisual: "stock" | "performance" | "race"): {
  x: number;
  y: number;
} {
  if (exhaustVisual === "race") return { x: 106, y: 374 };
  if (exhaustVisual === "performance") return { x: 134, y: 377 };
  return { x: 164, y: 386 };
}

function getSmokeStyle(
  tint: SmokeTint,
  density: number,
): { fill: string; maxOpacity: number; scale: number } {
  const d = Math.max(0.2, Math.min(1, density));
  switch (tint) {
    case "thick-blue-grey":
      return { fill: "#94A3B8", maxOpacity: 0.55 + d * 0.35, scale: 1.45 };
    case "light-blue":
      return { fill: "#93C5FD", maxOpacity: 0.35 + d * 0.28, scale: 1.05 };
    case "white-steam":
      return { fill: "#F8FAFC", maxOpacity: 0.45 + d * 0.35, scale: 1.2 };
    case "clear":
    default:
      return { fill: "#E4E4E7", maxOpacity: 0.14, scale: 0.75 };
  }
}

export function MopedWorkbench({
  bike,
  selectedTool,
  garageFuelDrip,
  bikeVerdict,
  standTest,
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
  const fuelLine = getFuelLineGeometry(bike.make);
  const tailpipe = getTailpipeTip(exhaustVisual);
  const standRunning = Boolean(standTest?.engineRunning);
  const standThrottle = standTest?.throttle ?? 0;
  const smokeStyle = standTest
    ? getSmokeStyle(standTest.smoke.tint, standTest.smoke.density)
    : null;

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
          {bikeVerdict === "acting-up" ? (
            <span className="inline-flex items-center gap-1 border-2 border-orange-500 bg-red-950/70 px-2 py-0.5 text-[11px] font-black uppercase text-orange-200">
              <Wrench className="h-3 w-3" aria-hidden="true" />
              ACTING UP
            </span>
          ) : bikeVerdict === "ran-clean" ? (
            <span className="inline-flex items-center gap-1 border-2 border-emerald-400 bg-emerald-950 px-2 py-0.5 text-[11px] font-black uppercase text-emerald-200">
              RAN CLEAN
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 border-2 border-amber-400/70 bg-amber-950/40 px-2 py-0.5 text-[11px] font-black uppercase text-amber-200">
              UNTESTED — TAKE A RIDE
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
              {/* Spokes (cast alloy mag wheels on Tomos A35; wire spokes on Maxi/Hobbit/Derbi) */}
              {bike.make === "tomos-a35"
                ? [0, 72, 144, 216, 288].map((deg) => {
                    const rad = (deg * Math.PI) / 180;
                    const dx = Math.cos(rad) * 51;
                    const dy = Math.sin(rad) * 51;
                    return (
                      <line
                        key={deg}
                        x1={cx}
                        y1={cy}
                        x2={cx + dx}
                        y2={cy + dy}
                        stroke="#D4D4D8"
                        strokeWidth="7"
                        strokeLinecap="round"
                      />
                    );
                  })
                : [0, 30, 60, 90, 120, 150].map((deg) => {
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

          {/* STAND TEST EXHAUST SMOKE PUFFS */}
          {standRunning && smokeStyle && (
            <g aria-hidden="true">
              {[0, 1, 2, 3].map((idx) => {
                const dur = standThrottle > 0.25 ? "0.65s" : "1.05s";
                const begin = `${(idx * 0.24).toFixed(2)}s`;
                const dx = -(55 + idx * 14);
                const dy = -(16 + (idx % 2) * 14);
                return (
                  <circle
                    key={idx}
                    cx={tailpipe.x}
                    cy={tailpipe.y}
                    r={6 * smokeStyle.scale}
                    fill={smokeStyle.fill}
                    opacity={0}
                  >
                    <animateTransform
                      attributeName="transform"
                      type="translate"
                      from="0 0"
                      to={`${dx} ${dy}`}
                      dur={dur}
                      begin={begin}
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="r"
                      values={`${5 * smokeStyle.scale};${16 * smokeStyle.scale};${24 * smokeStyle.scale}`}
                      dur={dur}
                      begin={begin}
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values={`0;${smokeStyle.maxOpacity.toFixed(2)};0`}
                      keyTimes="0;0.25;1"
                      dur={dur}
                      begin={begin}
                      repeatCount="indefinite"
                    />
                  </circle>
                );
              })}
            </g>
          )}

          {/* BIKE MAKE-SPECIFIC FRAME */}
          <BikeFrameGeometry
            make={bike.make}
            colorHex={bike.colorHex}
            accentHex={bike.accentHex}
          />

          {/* ENGINE GROUP (vibrates subtly while idling/revving on center stand) */}
          <g>
            {standRunning && (
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0; 0.9 -0.8; -0.8 0.7; 0.6 0.6; 0 0"
                dur={standThrottle > 0.25 ? "0.06s" : "0.11s"}
                repeatCount="indefinite"
              />
            )}

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

            {/* Fuel line & inline translucent filter from make-specific tank petcock down to carb */}
            <path
              d={fuelLine.pathD}
              fill="none"
              stroke="#FACC15"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <rect
              x={fuelLine.filterX}
              y={fuelLine.filterY}
              width="16"
              height="24"
              rx="5"
              fill="#FEF08A"
              fillOpacity="0.85"
              stroke="#18181B"
              strokeWidth="2"
            />
            <line
              x1={fuelLine.filterX + 2}
              y1={fuelLine.filterMidY}
              x2={fuelLine.filterX + 14}
              y2={fuelLine.filterMidY}
              stroke="#EA580C"
              strokeWidth="3"
            />
          </g>
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
