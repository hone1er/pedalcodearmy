// Endless 3-Lane East Bay Street Runner simulation powered by the REAL
// 2-stroke engine physics from Ran When Parked.
//
// An untuned bike four-strokes, bogs on wheelies, slips its clutch, starves
// for fuel, or overheats & seizes right in the middle of Oakland traffic.
// A tuned, kitted bike rips on the pipe and racks up huge combos.
//
// GOLDEN RULE: Never exposes raw FaultIds in RunnerSnapshot or popups/notes.

import { type Rng, chance, mulberry32, nextRange } from "../core/rng";
import type {
  OwnedBike,
  RideTelemetrySnapshot,
  RunnerEndReason,
  RunnerRunResult,
  RunnerRunSummary,
  SimEvent,
  SmokeTint,
} from "../contract";
import {
  type BikeProfile,
  type EngineState,
  SEIZE_CLUTCH_WINDOW_MS,
  SEIZE_RESTART_CHT_C,
  attemptKickstart,
  buildBikeProfile,
  createEngineState,
  rideEndPlugColor,
  stepEngine,
} from "../engine/engine-sim";
import { MPS_TO_MPH } from "../ride/ride-sim";

// ── TYPES & ZONES ──────────────────────────────────────────────────────────

export type RunnerLane = 0 | 1 | 2;
export type RunnerObstacleKind = "car" | "bus" | "pothole" | "oil-slick" | "traffic-cone" | "dog";
export type RunnerCarVariant = "sedan" | "hatchback" | "van";
export type RunnerCollectibleKind = "spark-plug" | "jet" | "pipe" | "cylinder";
export type RunnerShopKind = "treatland" | "1977-mopeds" | "myrons-mopeds";

export interface RunnerZone {
  id: "oakland-hills" | "lake-merritt" | "telegraph-ave" | "bay-bridge" | "west-oakland";
  name: string;
  subtitle: string;
  timeOfDay: "morning" | "golden" | "sunset" | "night";
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  sunColor: string;
  farHill: string;
  midBuilding: string;
  accentHex: string;
  isNight: boolean;
  /** Road grade profile for this stretch of the East Bay (percent, + = climb). */
  gradeMinPct: number;
  gradeMaxPct: number;
  /** Length (m) of one rolling grade wave; 0 = constant grade. */
  gradeWaveM: number;
  /** Aero drag multiplier (> 1 = headwind). */
  windDragMult: number;
}

export const RUNNER_ZONES: RunnerZone[] = [
  {
    id: "oakland-hills",
    name: "OAKLAND HILLS",
    subtitle: "Golden hour warm-up",
    timeOfDay: "golden",
    skyTop: "#1D4ED8",
    skyMid: "#F59E0B",
    skyBottom: "#FDE68A",
    sunColor: "#FEF08A",
    farHill: "#3B2856",
    midBuilding: "#43305A",
    accentHex: "#FFD700",
    isNight: false,
    gradeMinPct: 4,
    gradeMaxPct: 9.5,
    gradeWaveM: 150,
    windDragMult: 1,
  },
  {
    id: "lake-merritt",
    name: "LAKE MERRITT",
    subtitle: "Sunset boulevard",
    timeOfDay: "sunset",
    skyTop: "#4C1D95",
    skyMid: "#EA580C",
    skyBottom: "#FDBA74",
    sunColor: "#F97316",
    farHill: "#2E1A47",
    midBuilding: "#3F2157",
    accentHex: "#FB923C",
    isNight: false,
    gradeMinPct: -1.5,
    gradeMaxPct: 2.5,
    gradeWaveM: 170,
    windDragMult: 1,
  },
  {
    id: "telegraph-ave",
    name: "TELEGRAPH AVE",
    subtitle: "Neon twilight cruise",
    timeOfDay: "sunset",
    skyTop: "#1E1B4B",
    skyMid: "#86198F",
    skyBottom: "#E879F9",
    sunColor: "#F472B6",
    farHill: "#1E1236",
    midBuilding: "#2D164B",
    accentHex: "#F472B6",
    isNight: true,
    gradeMinPct: 0,
    gradeMaxPct: 3.5,
    gradeWaveM: 140,
    windDragMult: 1,
  },
  {
    id: "bay-bridge",
    name: "BAY BRIDGE",
    subtitle: "Midnight two-stroke run",
    timeOfDay: "night",
    skyTop: "#020617",
    skyMid: "#0F172A",
    skyBottom: "#1D4ED8",
    sunColor: "#93C5FD",
    farHill: "#0B1328",
    midBuilding: "#111C38",
    accentHex: "#60A5FA",
    isNight: true,
    gradeMinPct: 1,
    gradeMaxPct: 1,
    gradeWaveM: 0,
    windDragMult: 1.28,
  },
  {
    id: "west-oakland",
    name: "WEST OAKLAND",
    subtitle: "Early morning smoke",
    timeOfDay: "morning",
    skyTop: "#0EA5E9",
    skyMid: "#38BDF8",
    skyBottom: "#FDE68A",
    sunColor: "#FACC15",
    farHill: "#1E3A5F",
    midBuilding: "#334155",
    accentHex: "#FACC15",
    isNight: false,
    gradeMinPct: -3,
    gradeMaxPct: -3,
    gradeWaveM: 0,
    windDragMult: 1,
  },
];

export interface RunnerEntity {
  id: number;
  kind: "obstacle" | "collectible" | "shop";
  subKind: RunnerObstacleKind | RunnerCollectibleKind | RunnerShopKind;
  /** World longitudinal position in meters */
  xM: number;
  lane: RunnerLane;
  /** Float lane position for magnet attraction */
  lanePos: number;
  /** Length in meters for hit detection */
  lengthM: number;
  /** Ground hazards can be cleared with a wheelie */
  groundHazard: boolean;
  /** Forward speed of moving cars (m/s) */
  speedMps: number;
  carVariant?: RunnerCarVariant;
  carColor?: string;
  /** Crossing dogs: lateral speed in lanes/sec (bounces inside lanes 0..2) */
  lateralSpeed?: number;
  /** Lane-changing traffic: amber blinker direction (-1 up, +1 down, 0 off) */
  blinkerDir?: -1 | 0 | 1;
  /** Seconds left signalling before the car starts drifting over */
  laneChangeTimerSec?: number;
  /** Lane the car is drifting into (set once the shift begins) */
  laneChangeTargetLane?: RunnerLane;
  /** This car will try one signalled lane change as you approach */
  laneChangeArmed?: boolean;
  /** One-shot audio telegraphs */
  barked?: boolean;
  hornSounded?: boolean;
  collected: boolean;
  hit: boolean;
  wheelieCleared: boolean;
  nearMissAwarded: boolean;
}

export interface RunnerPopup {
  id: number;
  text: string;
  subtext?: string;
  tone: "gold" | "green" | "cyan" | "orange" | "red";
  ttlMs: number;
  maxTtlMs: number;
}

export type RunnerEvent =
  | { type: "sim"; event: SimEvent }
  | { type: "lane-shift" }
  | { type: "wheelie"; strong: boolean }
  | { type: "wheelie-clear"; points: number }
  | { type: "close-call"; points: number }
  | { type: "pickup"; kind: RunnerCollectibleKind; points: number; comboStep: number }
  | { type: "shop-arch"; shop: RunnerShopKind }
  | { type: "hit"; remainingHp: number }
  | { type: "car-horn" }
  | { type: "dog-bark" }
  | { type: "zone-change"; zoneName: string };

export interface RunnerInput {
  /** Hold coast/brake to cool a hot engine or time traffic */
  brake: boolean;
  /** Hold clutch to save a seize or cool down */
  clutch: boolean;
  /** One-shot lane shift (-1 up, +1 down) */
  laneDir: -1 | 0 | 1;
  /** One-shot wheelie press */
  wheeliePulse: boolean;
  /** Wheelie button still held — extends the balance window (capped) */
  wheelieHeld?: boolean;
  /** One-shot kickstart attempt when stalled */
  kickstartPulse: boolean;
}

export const NEUTRAL_RUNNER_INPUT: RunnerInput = {
  brake: false,
  clutch: false,
  laneDir: 0,
  wheeliePulse: false,
  kickstartPulse: false,
};

export interface RunnerOptions {
  hasTach: boolean;
  hasChtGauge: boolean;
  hasStethoscope: boolean;
  seed: number;
}

export interface RunnerState {
  bike: OwnedBike;
  profile: BikeProfile;
  engine: EngineState;
  rng: Rng;
  opts: RunnerOptions;

  finished: boolean;
  endReason: RunnerEndReason | null;
  elapsedSec: number;
  distanceM: number;
  speedMps: number;
  topSpeedMph: number;
  /** Top speed on engine power alone (never counts Treatland turbo or its coast-down) */
  engineTopSpeedMph: number;
  /** True from turbo start until the bike stops shedding the borrowed speed */
  turboCoastdown: boolean;
  score: number;

  // Road & wind
  gradePct: number;
  windDragMult: number;
  headwindActive: boolean;
  /** Hot bus exhaust raising intake/cooling air temp (°C) */
  ambientC: number;

  // Death beat (wipeout / seize / stall plays out before the run ends)
  dying: boolean;
  deathElapsedSec: number;
  deathDurationSec: number;
  deathReason: RunnerEndReason | null;

  /** Brief arcade hit-stop: physics pauses while shake/flash/popups keep running */
  hitStopSec: number;
  /** One-shot inputs pressed during a hit-stop, replayed on the next live step */
  bufferedInput: { laneDir: -1 | 0 | 1; wheeliePulse: boolean; kickstartPulse: boolean };

  // Player lane & wheelie state
  lane: RunnerLane;
  targetLane: RunnerLane;
  lanePos: number;
  queuedLaneDir: -1 | 0 | 1;
  leanAngle: number;

  isWheeling: boolean;
  wheelieTimerSec: number;
  wheelieDurationSec: number;
  wheelieHeightFrac: number; // 0..1 visual lift
  queuedWheelieSec: number;
  /** Seconds spent balancing at the apex while holding the wheelie button */
  wheelieBalanceSec: number;
  /** Max balance-hold for this wheelie (better tune = longer) */
  wheelieBalanceMaxSec: number;

  health: number;
  maxHealth: number;
  invincibleSec: number;
  hitFlashSec: number;
  cameraShakeSec: number;

  // Combo & arcade counters
  comboCount: number;
  comboMultiplier: number;
  comboTimerSec: number;
  maxCombo: number;
  wheelieClears: number;
  closeCalls: number;
  partsCollected: number;
  zoneIndex: number;

  // Shop powerups
  turboSec: number;
  magnetSec: number;

  // Engine startup & stall tracking
  autoKicksLeft: number;
  autoKickTimerSec: number;
  everStarted: boolean;
  deadStopSec: number;
  /** Seconds crawling below walking pace with the motor running (bogged on a climb) */
  boggedSec: number;
  /** True while the rider is pedal-assisting (LPA) up a climb */
  pedalAssist: boolean;

  // Spawners & entities
  entities: RunnerEntity[];
  nextEntityId: number;
  nextObstacleAtM: number;
  nextCollectibleAtM: number;
  nextShopAtM: number;
  nextShopIdx: number;

  popups: RunnerPopup[];
  nextPopupId: number;
  popupCooldowns: Record<string, number>;
  symptomTimers: Record<string, number>;
  notes: string[];
}

export interface RunnerHudSnapshot {
  finished: boolean;
  endReason: RunnerEndReason | null;
  dying: boolean;
  deathElapsedSec: number;
  deathDurationSec: number;
  deathReason: RunnerEndReason | null;
  score: number;
  distanceM: number;
  speedMph: number;
  topSpeedMph: number;
  engineTopSpeedMph: number;
  gradePct: number;
  headwindActive: boolean;
  health: number;
  maxHealth: number;
  comboCount: number;
  comboMultiplier: number;
  comboPct: number;
  wheelieClears: number;
  closeCalls: number;
  partsCollected: number;
  zoneName: string;
  zoneSubtitle: string;
  zoneAccentHex: string;
  turboSec: number;
  magnetSec: number;
  isWheeling: boolean;
  engineRunning: boolean;
  rpm: number;
  maxRpm: number;
  chtC: number;
  hasTach: boolean;
  hasChtGauge: boolean;
  powerbandActive: boolean;
  fuelBowlPct: number;
  stalled: boolean;
  seizeWarning: boolean;
  seizeActive: boolean;
  seizeClutchWindowMs: number;
  seizedHard: boolean;
  seizeCooldownHot: boolean;
  misfirePattern: EngineState["misfirePattern"];
  smokeTint: SmokeTint;
  smokeDensity: number;
  clutchSlip: number;
  popups: RunnerPopup[];
}

// ── CONSTANTS ──────────────────────────────────────────────────────────────

const AIR_DENSITY = 1.2;
const G = 9.81;
const AMBIENT_AIR_C = 20;
const LANE_SWITCH_SPEED = 9.5; // lanes per second
const DEATH_DURATION_SEC = 1.25;
const DEATH_SLOWMO_SEC = 0.45;
const DEATH_SLOWMO_SCALE = 0.3;
const HIT_STOP_SEC = 0.065;
/** Bumper-to-bumper gap traffic always keeps to a vehicle ahead in the same lane */
const SAME_LANE_GAP_M = 20;
/** Bumper-to-bumper gap between ANY two vehicles across all lanes (no 3-lane walls) */
const CROSS_LANE_GAP_M = 15;
const LANE_CHANGE_START_M = 1400;
const LANE_CHANGE_SIGNAL_SEC = 1.2;
const LANE_CHANGE_SPEED = 1.4; // lanes per second
const DOG_LATERAL_SPEED = 0.75; // lanes per second
const BUS_LENGTH_M = 10.5;
/**
 * Climb load heat-soak (°C of extra effective fin-air temp per % grade above 2%, at full
 * throttle). The engine model's heat tracks rpm × torque and cools on road speed, so it
 * under-counts a 2-stroke lugging up the Oakland Hills. A lean burn (thin exhaust note)
 * soaks far more heat under that load than a properly jetted one.
 */
const CLIMB_HEAT_SOAK_BASE_C_PER_PCT = 4;
const CLIMB_HEAT_SOAK_LEAN_C_PER_PCT = 16;
/** Riders pedal (LPA) on steep climbs when the motor bogs, so no bike gets stuck on a hill. */
const LPA_MAX_FORCE_N = 110;
const LPA_LEG_POWER_W = 240;
const BOG_OUT_SEC = 8;
const COMBO_WINDOW_SEC = 4.5;
const ZONE_STEP_M = 350;
const SHOP_INTERVAL_M = 420;
const CAR_COLORS = ["#EF4444", "#3B82F6", "#10B981", "#F59E0B", "#E4E4E7", "#8B5CF6"];
const SHOP_ORDER: RunnerShopKind[] = ["treatland", "1977-mopeds", "myrons-mopeds"];

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ── FACTORY ────────────────────────────────────────────────────────────────

export function createRunnerState(bike: OwnedBike, opts: RunnerOptions): RunnerState {
  const rng = mulberry32(opts.seed);
  const profile = buildBikeProfile(bike);
  const engine = createEngineState(profile);
  // Warmed up slightly at the starting line so cold choke isn't required in arcade mode
  engine.chtC = 68;

  return {
    bike: structuredClone(bike),
    profile,
    engine,
    rng,
    opts,

    finished: false,
    endReason: null,
    elapsedSec: 0,
    distanceM: 0,
    speedMps: 0,
    topSpeedMph: 0,
    engineTopSpeedMph: 0,
    turboCoastdown: false,
    score: 0,

    gradePct: roadAt(0).gradePct,
    windDragMult: roadAt(0).windDragMult,
    headwindActive: false,
    ambientC: AMBIENT_AIR_C,

    dying: false,
    deathElapsedSec: 0,
    deathDurationSec: DEATH_DURATION_SEC,
    deathReason: null,

    hitStopSec: 0,
    bufferedInput: { laneDir: 0, wheeliePulse: false, kickstartPulse: false },

    lane: 1,
    targetLane: 1,
    lanePos: 1,
    queuedLaneDir: 0,
    leanAngle: 0,

    isWheeling: false,
    wheelieTimerSec: 0,
    wheelieDurationSec: 0.65,
    wheelieHeightFrac: 0,
    queuedWheelieSec: 0,
    wheelieBalanceSec: 0,
    wheelieBalanceMaxSec: 0,

    health: 3,
    maxHealth: 3,
    invincibleSec: 0,
    hitFlashSec: 0,
    cameraShakeSec: 0,

    comboCount: 0,
    comboMultiplier: 1,
    comboTimerSec: 0,
    maxCombo: 1,
    wheelieClears: 0,
    closeCalls: 0,
    partsCollected: 0,
    zoneIndex: 0,

    turboSec: 0,
    magnetSec: 0,

    autoKicksLeft: 3,
    autoKickTimerSec: 0.12,
    everStarted: false,
    deadStopSec: 0,
    boggedSec: 0,
    pedalAssist: false,

    entities: [],
    nextEntityId: 1,
    nextObstacleAtM: 58,
    nextCollectibleAtM: 28,
    nextShopAtM: SHOP_INTERVAL_M,
    nextShopIdx: 0,

    popups: [],
    nextPopupId: 1,
    popupCooldowns: {},
    symptomTimers: {},
    notes: [],
  };
}

// ── HELPERS ────────────────────────────────────────────────────────────────

function addPopup(
  s: RunnerState,
  text: string,
  tone: RunnerPopup["tone"],
  opts: { subtext?: string; key?: string; cooldownSec?: number; ttlMs?: number } = {},
): void {
  const { subtext, key, cooldownSec = 8, ttlMs = 2000 } = opts;
  if (key) {
    const until = s.popupCooldowns[key] ?? -1;
    if (s.elapsedSec < until) return;
    s.popupCooldowns[key] = s.elapsedSec + cooldownSec;
  }
  s.popups.push({
    id: s.nextPopupId++,
    text,
    subtext,
    tone,
    ttlMs,
    maxTtlMs: ttlMs,
  });
  if (s.popups.length > 5) s.popups.shift();
}

function observe(s: RunnerState, note: string): void {
  if (!s.notes.includes(note)) s.notes.push(note);
}

function sustained(s: RunnerState, key: string, active: boolean, dt: number, needSec: number): boolean {
  const t = active ? (s.symptomTimers[key] ?? 0) + dt : 0;
  s.symptomTimers[key] = t;
  return t >= needSec;
}

function bumpCombo(s: RunnerState, amount = 1): void {
  s.comboCount += amount;
  s.comboTimerSec = COMBO_WINDOW_SEC;
  s.comboMultiplier = Math.min(4, 1 + Math.floor(s.comboCount / 3));
  s.maxCombo = Math.max(s.maxCombo, s.comboMultiplier);
}


// ── ROAD PROFILE (grade & wind) ───────────────────────────────────────────

/** Zone index for a world distance (zones repeat every 5 × ZONE_STEP_M). */
export function zoneIndexAt(distanceM: number): number {
  return Math.floor(Math.max(0, distanceM) / ZONE_STEP_M) % RUNNER_ZONES.length;
}

function zoneGrade(zone: RunnerZone, localM: number): number {
  if (zone.gradeWaveM <= 0 || zone.gradeMaxPct === zone.gradeMinPct) return zone.gradeMinPct;
  const mid = (zone.gradeMinPct + zone.gradeMaxPct) / 2;
  const amp = (zone.gradeMaxPct - zone.gradeMinPct) / 2;
  // Starts each zone at the low end of its range and rolls up into longer climbs.
  return mid - amp * Math.cos((2 * Math.PI * localM) / zone.gradeWaveM);
}

/**
 * Deterministic road grade & wind at a world distance. Grades blend smoothly
 * over the first 40 m of each zone so there are no instant cliff edges.
 */
export function roadAt(distanceM: number): { gradePct: number; windDragMult: number; zone: RunnerZone } {
  const d = Math.max(0, distanceM);
  const idx = zoneIndexAt(d);
  const zone = RUNNER_ZONES[idx] ?? RUNNER_ZONES[0]!;
  const prev = RUNNER_ZONES[(idx + RUNNER_ZONES.length - 1) % RUNNER_ZONES.length] ?? zone;
  const local = d % ZONE_STEP_M;
  const blendM = 40;
  const t = clamp(local / blendM, 0, 1);
  const k = t * t * (3 - 2 * t);
  const here = zoneGrade(zone, local);
  const before = zoneGrade(prev, ZONE_STEP_M);
  return {
    gradePct: before + (here - before) * k,
    windDragMult: prev.windDragMult + (zone.windDragMult - prev.windDragMult) * k,
    zone,
  };
}

// ── TRAFFIC HELPERS ───────────────────────────────────────────────────────

function isVehicle(e: RunnerEntity): boolean {
  return e.kind === "obstacle" && (e.subKind === "car" || e.subKind === "bus");
}

/** Lanes overlap when lane positions are closer than ~3/4 of a lane (covers mid-change cars). */
function sharesLane(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.75;
}

/** Required center-to-center spacing between two vehicles. */
function requiredSpacing(a: { lengthM: number; lanePos: number }, b: { lengthM: number; lanePos: number }): number {
  const gap = sharesLane(a.lanePos, b.lanePos) ? SAME_LANE_GAP_M : CROSS_LANE_GAP_M;
  return (a.lengthM + b.lengthM) / 2 + gap;
}

/** Would a vehicle at (xM, lanePos) respect the gap rule against every other vehicle? */
function vehicleSlotClear(s: RunnerState, self: RunnerEntity | null, xM: number, lanePos: number, lengthM: number): boolean {
  for (const u of s.entities) {
    if (u === self || !isVehicle(u)) continue;
    const need = requiredSpacing({ lengthM, lanePos }, u);
    if (Math.abs(u.xM - xM) < need) return false;
  }
  return true;
}

/**
 * Find a spawn position at or ahead of `xM` that respects the traffic gap rule.
 * Returns null if it would have to be pushed unreasonably far.
 */
function placeVehicle(s: RunnerState, xM: number, lanePos: number, lengthM: number): number | null {
  let x = xM;
  for (let iter = 0; iter < 8; iter++) {
    let moved = false;
    for (const u of s.entities) {
      if (!isVehicle(u)) continue;
      const need = requiredSpacing({ lengthM, lanePos }, u);
      if (Math.abs(u.xM - x) < need) {
        x = u.xM + need + 0.01;
        moved = true;
      }
    }
    if (!moved) return x - xM > 32 ? null : x;
  }
  return null;
}

/**
 * Move traffic forward while guaranteeing it never overtakes into (or clips
 * through) a vehicle ahead: ≥ 20 m bumper gap in the same lane, ≥ 15 m across
 * all lanes, so impossible 3-lane walls can never form. Never moves a car back.
 */
function advanceTraffic(s: RunnerState, dt: number): void {
  const vehicles = s.entities.filter(isVehicle).sort((a, b) => b.xM - a.xM);
  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i]!;
    let limit = Infinity;
    for (let j = 0; j < i; j++) {
      const u = vehicles[j]!;
      if (u.xM < v.xM) continue;
      limit = Math.min(limit, u.xM - requiredSpacing(u, v));
    }
    const desired = v.xM + v.speedMps * dt;
    v.xM = Math.max(v.xM, Math.min(desired, limit));
  }
  for (const e of s.entities) {
    if (e.kind === "obstacle" && !isVehicle(e) && e.speedMps > 0) e.xM += e.speedMps * dt;
  }
}

/** Signalled lane changes for escalated traffic (blink 1.2 s, then drift one lane). */
function updateLaneChangers(s: RunnerState, dt: number): void {
  for (const car of s.entities) {
    if (!isVehicle(car)) continue;
    const relX = car.xM - s.distanceM;

    if (car.laneChangeTargetLane !== undefined) {
      const target = car.laneChangeTargetLane;
      const diff = target - car.lanePos;
      const step = Math.sign(diff) * Math.min(Math.abs(diff), LANE_CHANGE_SPEED * dt);
      car.lanePos += step;
      if (Math.abs(target - car.lanePos) < 0.01) {
        car.lanePos = target;
        car.lane = target;
        car.laneChangeTargetLane = undefined;
        car.blinkerDir = 0;
        car.laneChangeTimerSec = undefined;
      } else {
        car.lane = clamp(Math.round(car.lanePos), 0, 2) as RunnerLane;
      }
      continue;
    }

    if (car.laneChangeTimerSec !== undefined && car.blinkerDir) {
      car.laneChangeTimerSec -= dt;
      if (car.laneChangeTimerSec <= 0) {
        const target = clamp(car.lane + car.blinkerDir, 0, 2) as RunnerLane;
        if (target !== car.lane && vehicleSlotClear(s, car, car.xM, target, car.lengthM)) {
          car.laneChangeTargetLane = target;
          car.laneChangeTimerSec = 0;
        } else {
          car.blinkerDir = 0;
          car.laneChangeTimerSec = undefined;
        }
      }
      continue;
    }

    if (car.laneChangeArmed && !car.hit && relX > 30 && relX < 62) {
      car.laneChangeArmed = false;
      const dirs: (-1 | 1)[] = car.lane === 0 ? [1] : car.lane === 2 ? [-1] : s.rng() < 0.5 ? [-1, 1] : [1, -1];
      for (const dir of dirs) {
        const target = car.lane + dir;
        if (vehicleSlotClear(s, car, car.xM, target, car.lengthM)) {
          car.blinkerDir = dir;
          car.laneChangeTimerSec = LANE_CHANGE_SIGNAL_SEC;
          break;
        }
      }
    }
  }
}

// ── WHEELIE ───────────────────────────────────────────────────────────────

function triggerWheelie(s: RunnerState, out: RunnerEvent[]): void {
  if (s.isWheeling || !s.engine.running || s.speedMps < 3) return;
  const eng = s.engine;
  // Tune directly affects wheelie crispness!
  // Rich four-stroking, fouled stutters, slipping clutch, or low speed shorten the wheelie.
  const healthFactor =
    (1 - eng.misfireRate * 0.45) *
    (1 - eng.clutchSlip * 0.4) *
    clamp(s.speedMps / 11, 0.72, 1.12) *
    (eng.powerbandActive || s.turboSec > 0 ? 1.12 : 1);
  const duration = clamp(0.68 * healthFactor, 0.36, 0.82);

  s.isWheeling = true;
  s.wheelieDurationSec = duration;
  s.wheelieTimerSec = duration;
  s.queuedWheelieSec = 0;
  s.wheelieBalanceSec = 0;
  // Holding the button lets a healthy, on-the-pipe engine balance the wheelie longer.
  s.wheelieBalanceMaxSec = clamp(1.5 * healthFactor - 0.35, 0.2, 1.25);
  const strong = duration >= 0.56;
  out.push({ type: "wheelie", strong });
  if (!strong) {
    addPopup(s, "BOGGY WHEELIE!", "orange", {
      subtext: "Front end barely lifts",
      key: "boggy-wheelie",
      cooldownSec: 12,
      ttlMs: 1800,
    });
  }
}

function updateWheelie(s: RunnerState, held: boolean, dt: number, out: RunnerEvent[]): void {
  if (!s.isWheeling) {
    s.wheelieHeightFrac = 0;
    return;
  }
  const dur = Math.max(0.05, s.wheelieDurationSec);
  const progress = 1 - s.wheelieTimerSec / dur;
  const atApex = progress >= 0.5;
  if (held && atApex && s.wheelieBalanceSec < s.wheelieBalanceMaxSec) {
    // Balance point: hold the nose up (gentle wobble), timer paused.
    s.wheelieBalanceSec += dt;
    s.wheelieHeightFrac = 0.94 + 0.06 * Math.cos(s.wheelieBalanceSec * 9);
    if (s.wheelieBalanceSec >= s.wheelieBalanceMaxSec) {
      addPopup(s, "NOSE DROPS!", "orange", { key: "wheelie-drop", cooldownSec: 6, ttlMs: 1000 });
    }
    return;
  }
  s.wheelieTimerSec -= dt;
  if (s.wheelieTimerSec <= 0) {
    s.isWheeling = false;
    s.wheelieTimerSec = 0;
    s.wheelieHeightFrac = 0;
    s.wheelieBalanceSec = 0;
    if (s.queuedWheelieSec > 0) triggerWheelie(s, out);
  } else {
    const p = 1 - s.wheelieTimerSec / dur;
    s.wheelieHeightFrac = Math.sin(p * Math.PI);
  }
}

// ── SPAWNERS ───────────────────────────────────────────────────────────────

function spawnObstacleWave(s: RunnerState): void {
  const rng = s.rng;
  const difficulty = clamp(s.distanceM / 1800, 0, 1);
  const baseM = s.nextObstacleAtM;

  // Choose 1 or 2 obstacles in distinct lanes
  const lanes: RunnerLane[] = [0, 1, 2];
  for (let i = lanes.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [lanes[i], lanes[j]] = [lanes[j]!, lanes[i]!];
  }

  const waveCount = chance(rng, 0.32 + difficulty * 0.38) ? 2 : 1;
  let vehiclesInWave = 0;

  for (let idx = 0; idx < waveCount; idx++) {
    const lane = lanes[idx]!;
    const roll = rng();
    let subKind: RunnerObstacleKind;
    if (roll < 0.36 && vehiclesInWave < 2) {
      subKind = "car";
    } else if (roll < 0.43 && vehiclesInWave < 2 && s.distanceM > 250) {
      subKind = "bus";
    } else if (roll < 0.62) {
      subKind = "pothole";
    } else if (roll < 0.77) {
      subKind = "traffic-cone";
    } else if (roll < 0.9) {
      subKind = "oil-slick";
    } else {
      subKind = "dog";
    }

    let xM = baseM + idx * nextRange(rng, 2, 7);
    const isBus = subKind === "bus";
    const isCar = subKind === "car";
    const carVariants: RunnerCarVariant[] = ["sedan", "hatchback", "van"];
    const carVariant = isCar ? carVariants[Math.floor(rng() * carVariants.length)] : undefined;
    const carColor = isCar ? CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)] : undefined;
    const lengthM = isBus ? BUS_LENGTH_M : isCar ? (carVariant === "van" ? 6.2 : 5.2) : 2.5;
    const vehicleSpeed = isBus ? nextRange(rng, 3.4, 4.4) : isCar ? nextRange(rng, 3.8, 6.5) : 0;

    if (isCar || isBus) {
      const placed = placeVehicle(s, xM, lane, lengthM);
      if (placed === null) {
        // No legal slot nearby — drop a static cone instead of forming a wall.
        subKind = "traffic-cone";
      } else {
        xM = placed;
        vehiclesInWave++;
      }
    }

    const vehicle = subKind === "car" || subKind === "bus";
    const isDog = subKind === "dog";
    const armLaneChange = vehicle && subKind === "car" && s.distanceM > LANE_CHANGE_START_M && chance(rng, 0.3);
    const dogDir: number = lane === 0 ? 1 : lane === 2 ? -1 : rng() < 0.5 ? -1 : 1;

    s.entities.push({
      id: s.nextEntityId++,
      kind: "obstacle",
      subKind,
      xM,
      lane,
      lanePos: lane,
      lengthM: vehicle ? lengthM : 2.5,
      // Dogs and traffic must be dodged; potholes, cones & oil can be wheelied over.
      groundHazard: !vehicle && !isDog,
      speedMps: vehicle ? vehicleSpeed : isDog ? 0.5 : 0,
      carVariant: subKind === "car" ? carVariant : undefined,
      carColor: subKind === "car" ? carColor : undefined,
      ...(isDog ? { lateralSpeed: dogDir * DOG_LATERAL_SPEED, barked: false } : {}),
      ...(armLaneChange ? { laneChangeArmed: true, blinkerDir: 0 as const } : {}),
      collected: false,
      hit: false,
      wheelieCleared: false,
      nearMissAwarded: false,
    });
  }

  // Spacing tightens with distance, and stretches modestly with speed so fast builds stay readable.
  const speedScale = clamp(s.speedMps / 12, 0.9, 1.22);
  const minGap = (32 - difficulty * 9) * speedScale;
  const maxGap = (54 - difficulty * 14) * speedScale;
  s.nextObstacleAtM = baseM + nextRange(rng, minGap, maxGap);
}

function spawnCollectibleLine(s: RunnerState): void {
  const rng = s.rng;
  const lane = Math.floor(rng() * 3) as RunnerLane;
  const kinds: RunnerCollectibleKind[] = ["spark-plug", "jet", "pipe", "cylinder"];
  const roll = rng();
  const subKind: RunnerCollectibleKind =
    roll < 0.4 ? kinds[0]! : roll < 0.72 ? kinds[1]! : roll < 0.9 ? kinds[2]! : kinds[3]!;
  const count = chance(rng, 0.45) ? 3 : 1;

  for (let i = 0; i < count; i++) {
    s.entities.push({
      id: s.nextEntityId++,
      kind: "collectible",
      subKind,
      xM: s.nextCollectibleAtM + i * 7,
      lane,
      lanePos: lane,
      lengthM: 2.2,
      groundHazard: false,
      speedMps: 0,
      collected: false,
      hit: false,
      wheelieCleared: false,
      nearMissAwarded: false,
    });
  }

  s.nextCollectibleAtM += nextRange(rng, 38, 62);
}

function spawnShopArch(s: RunnerState): void {
  const shop = SHOP_ORDER[s.nextShopIdx % SHOP_ORDER.length]!;
  s.nextShopIdx += 1;
  const lane = Math.floor(s.rng() * 3) as RunnerLane;
  s.entities.push({
    id: s.nextEntityId++,
    kind: "shop",
    subKind: shop,
    xM: s.nextShopAtM,
    lane,
    lanePos: lane,
    lengthM: 5,
    groundHazard: false,
    speedMps: 0,
    collected: false,
    hit: false,
    wheelieCleared: false,
    nearMissAwarded: false,
  });
  s.nextShopAtM += SHOP_INTERVAL_M;
}

// ── DEATH BEAT & HIT-STOP ─────────────────────────────────────────────────

/** Hit-stop & the death beat skip `stepEngine`, so un-latch its one-frame pulses. */
function clearEnginePulses(eng: { detonationPulse: boolean; gearShiftPulse?: boolean }): void {
  eng.detonationPulse = false;
  if (eng.gearShiftPulse) eng.gearShiftPulse = false;
}

function enterDying(s: RunnerState, reason: RunnerEndReason): void {
  if (s.dying || s.finished) return;
  s.dying = true;
  s.deathReason = reason;
  s.deathElapsedSec = 0;
  s.deathDurationSec = DEATH_DURATION_SEC;
  s.isWheeling = false;
  s.queuedWheelieSec = 0;
  s.turboSec = 0;
  s.cameraShakeSec = Math.max(s.cameraShakeSec, reason === "stalled" ? 0.15 : 0.6);
  const eng = s.engine;
  clearEnginePulses(eng);
  if (reason === "crashed" && eng.running) {
    // Rider's down — the motor cuts out as the bike slides.
    eng.running = false;
    eng.powerbandActive = false;
    eng.driveForceN = 0;
  }
}

function tickVisualTimers(s: RunnerState, dt: number): void {
  s.hitFlashSec = Math.max(0, s.hitFlashSec - dt);
  s.cameraShakeSec = Math.max(0, s.cameraShakeSec - dt);
  for (const p of s.popups) p.ttlMs -= dt * 1000;
  s.popups = s.popups.filter((p) => p.ttlMs > 0);
}

function stepDying(s: RunnerState, dt: number): void {
  const eng = s.engine;
  s.deathElapsedSec += dt;
  eng.rpm = Math.max(0, eng.rpm - 6000 * dt);
  eng.powerbandActive = false;
  s.leanAngle *= Math.max(0, 1 - dt * 4);
  s.wheelieHeightFrac = Math.max(0, s.wheelieHeightFrac - dt * 3);

  if (s.hitStopSec > 0) {
    s.hitStopSec = Math.max(0, s.hitStopSec - dt);
  } else if (s.deathElapsedSec <= DEATH_SLOWMO_SEC) {
    // Slow-mo slide / skid, then the frame freezes on the wreck.
    const simDt = dt * DEATH_SLOWMO_SCALE;
    const decel = s.deathReason === "stalled" ? 3 : 9;
    s.speedMps = Math.max(0, s.speedMps - decel * simDt);
    s.distanceM += s.speedMps * simDt;
    advanceTraffic(s, simDt);
  }

  if (s.deathElapsedSec >= s.deathDurationSec) {
    s.finished = true;
    s.endReason = s.deathReason ?? "crashed";
    s.dying = false;
  }
}

// ── STEP LOOP ──────────────────────────────────────────────────────────────

export function stepRunner(s: RunnerState, rawInput: RunnerInput, dt: number): RunnerEvent[] {
  const out: RunnerEvent[] = [];
  if (s.finished) return out;

  s.elapsedSec += dt;
  tickVisualTimers(s, dt);

  if (s.dying) {
    stepDying(s, dt);
    return out;
  }

  // ── Hit-stop: freeze physics for a crunchy beat, but never eat one-shot inputs ──
  if (s.hitStopSec > 0) {
    s.hitStopSec = Math.max(0, s.hitStopSec - dt);
    clearEnginePulses(s.engine);
    const b = s.bufferedInput;
    if (rawInput.laneDir !== 0) b.laneDir = rawInput.laneDir;
    b.wheeliePulse = b.wheeliePulse || rawInput.wheeliePulse;
    b.kickstartPulse = b.kickstartPulse || rawInput.kickstartPulse;
    return out;
  }
  const buf = s.bufferedInput;
  const input: RunnerInput = {
    ...rawInput,
    laneDir: rawInput.laneDir !== 0 ? rawInput.laneDir : buf.laneDir,
    wheeliePulse: rawInput.wheeliePulse || buf.wheeliePulse,
    kickstartPulse: rawInput.kickstartPulse || buf.kickstartPulse,
  };
  s.bufferedInput = { laneDir: 0, wheeliePulse: false, kickstartPulse: false };

  const eng = s.engine;
  const profile = s.profile;
  const simEvents: SimEvent[] = [];

  // Gameplay timers
  s.invincibleSec = Math.max(0, s.invincibleSec - dt);
  const hadTurbo = s.turboSec > 0;
  s.turboSec = Math.max(0, s.turboSec - dt);
  s.magnetSec = Math.max(0, s.magnetSec - dt);
  s.queuedWheelieSec = Math.max(0, s.queuedWheelieSec - dt);

  if (s.comboTimerSec > 0) {
    s.comboTimerSec = Math.max(0, s.comboTimerSec - dt);
    if (s.comboTimerSec === 0) {
      s.comboCount = 0;
      s.comboMultiplier = 1;
    }
  }

  // ── Road grade, wind & hot bus exhaust ──
  const road = roadAt(s.distanceM);
  s.gradePct = road.gradePct;
  s.windDragMult = road.windDragMult;
  s.headwindActive = road.windDragMult > 1.05;
  const onGas = !input.brake;
  const soakPerPct = CLIMB_HEAT_SOAK_BASE_C_PER_PCT + CLIMB_HEAT_SOAK_LEAN_C_PER_PCT * clamp(eng.leanTone, 0, 1);
  let ambientTarget = AMBIENT_AIR_C + Math.max(0, s.gradePct - 2) * soakPerPct * (onGas ? 1 : 0.15);
  for (const ent of s.entities) {
    if (ent.subKind !== "bus" || ent.hit) continue;
    const relX = ent.xM - s.distanceM;
    if (relX > 2 && relX < 32 && Math.abs(ent.lanePos - s.lanePos) < 0.5) {
      // Stuck in the bus's diesel wake: hot, dirty air & no clean airflow over the fins.
      ambientTarget += 30 * (1 - (relX - 2) / 30);
    }
  }
  s.ambientC += (ambientTarget - s.ambientC) * clamp(dt * 2.5, 0, 1);

  // ── Auto-kick on start + manual kickstart ──
  let kick = input.kickstartPulse;
  if (!s.everStarted && s.autoKicksLeft > 0 && !eng.running) {
    s.autoKickTimerSec -= dt;
    if (s.autoKickTimerSec <= 0) {
      kick = true;
      s.autoKicksLeft -= 1;
      s.autoKickTimerSec = 0.55;
    }
  }

  if (kick && !eng.running && !eng.seizedHard) {
    const started = attemptKickstart(eng, profile, s.bike.tuning, false, s.rng, simEvents, false);
    if (started) {
      s.everStarted = true;
      s.deadStopSec = 0;
      // Give a brisk rolling launch off the line if first start
      if (s.speedMps < 5.5) s.speedMps = 5.5;
      addPopup(s, "BRAAAP! SEND IT!", "gold", { key: "launch", cooldownSec: 6, ttlMs: 1400 });
    } else if (eng.seizeSavedPending && eng.chtC > SEIZE_RESTART_CHT_C) {
      addPopup(s, "TOO HOT TO KICK!", "orange", {
        subtext: "Coast a few seconds to cool down",
        key: "too-hot",
        cooldownSec: 3,
      });
    } else if (profile.effects.killSwitchOn) {
      addPopup(s, "KILL SWITCH IS ON!", "red", {
        subtext: "Flip it back to RUN in the Garage",
        key: "no-spark-kick",
        cooldownSec: 4,
      });
    } else if (s.autoKicksLeft === 0 || s.everStarted) {
      addPopup(s, "KICK… NOTHING!", "orange", {
        subtext: "Not even a cough",
        key: "kick-fail",
        cooldownSec: 4,
      });
      observe(s, "Kicked and kicked — not even a cough.");
    }
  }

  // ── Real 2-stroke engine physics step ──
  const throttle = input.brake ? 0.12 : 0.96;
  const wasRunning = eng.running;
  stepEngine(
    eng,
    profile,
    s.bike.tuning,
    {
      throttle,
      choke: false,
      clutch: input.clutch,
      killSwitch: false,
      kickstart: false,
    },
    { speedMps: s.speedMps, ambientC: s.ambientC },
    dt,
    s.rng,
    simEvents,
  );
  if (eng.running) s.everStarted = true;

  // Forward simEvents & handle critical engine events
  for (const ev of simEvents) {
    out.push({ type: "sim", event: ev });
    if (ev.type === "detonation") {
      addPopup(s, "PING-PING! DETONATION!", "red", {
        subtext: "Hold [B] coast or [Q] clutch!",
        key: "det",
        cooldownSec: 6,
      });
      observe(s, "Pinging under full throttle as the head got hot.");
    } else if (ev.type === "seize-warning") {
      addPopup(s, "RUNNING HOT! READY [Q] CLUTCH!", "red", {
        subtext: "It's getting tight…",
        key: "seize-warn",
        cooldownSec: 5,
      });
    } else if (ev.type === "seize-saved") {
      addPopup(s, "CLUTCH SAVE!", "cyan", {
        subtext: "Coasting — tap [R] once cooled",
        ttlMs: 2400,
      });
      observe(s, "Saved a seize mid-traffic with the clutch!");
    } else if (ev.type === "seize-crash") {
      observe(s, "Engine seized hard in Oakland traffic.");
      addPopup(s, "SEIZED!", "red", { subtext: "Rear wheel locks up!", ttlMs: 1800 });
      enterDying(s, "seized");
    } else if (ev.type === "stalled") {
      if (ev.reason === "fuel") {
        addPopup(s, "SPUTTER… DIED! TAP [R]!", "orange", {
          subtext: "Coughed and faded out under load",
          key: "stall-fuel",
          cooldownSec: 5,
        });
        observe(s, "Sputtered, surged and died under load.");
      } else {
        addPopup(s, "ENGINE STALLED! TAP [R]!", "orange", {
          key: "stall-other",
          cooldownSec: 5,
        });
        observe(s, "Stalled out mid-run.");
      }
    }
  }
  if (s.dying) return out;

  // ── Longitudinal speed from real engine drive force, grade & wind ──
  const m = profile.massKg;
  // Slightly lower aero drag than upright cruising (rider tucked in traffic)
  const cdA = profile.cdA * 0.88;
  const drag = 0.5 * AIR_DENSITY * cdA * s.speedMps * s.speedMps * s.windDragMult;
  const rolling = s.speedMps > 0.05 ? profile.crr * m * G : 0;
  const gravity = m * G * (s.gradePct / 100);
  const brakeForce = input.brake && s.speedMps > 0.1 ? 340 : 0;
  const turboForce = s.turboSec > 0 ? 185 : 0;
  // Auto LPA: when the motor bogs on a climb the rider pedals along, like any real moped.
  s.pedalAssist = eng.running && !input.brake && s.gradePct > 1.5 && s.speedMps < 6.5;
  const pedalForce = s.pedalAssist ? Math.min(LPA_MAX_FORCE_N, LPA_LEG_POWER_W / Math.max(1.2, s.speedMps)) : 0;
  const netForce = eng.driveForceN + turboForce + pedalForce - drag - rolling - gravity - brakeForce;

  const prevV = s.speedMps;
  let nextV = Math.max(0, s.speedMps + (netForce / m) * dt);
  // A stopped bike on a climb is held (no rolling backwards in a runner).
  if (prevV <= 0.05 && netForce < 0) nextV = 0;
  if (eng.wheelLocked) nextV = Math.max(0, s.speedMps - 7 * dt);
  if (s.turboSec > 0 && eng.running) {
    nextV = Math.max(nextV, Math.min(24.5, nextV + 3 * dt));
  }
  s.speedMps = nextV;

  const ds = s.speedMps * dt;
  s.distanceM += ds;
  const mph = s.speedMps * MPS_TO_MPH;
  s.topSpeedMph = Math.max(s.topSpeedMph, mph);

  // True engine top speed: ignore turbo and the coast-down of its borrowed speed.
  if (s.turboSec > 0 || hadTurbo) s.turboCoastdown = true;
  else if (s.turboCoastdown && (nextV - prevV) / dt > -0.05) s.turboCoastdown = false;
  if (s.turboSec <= 0 && !s.turboCoastdown && eng.running) {
    s.engineTopSpeedMph = Math.max(s.engineTopSpeedMph, mph);
  }

  // Distance score (respects leaderboard plausibility bound)
  if (ds > 0) {
    s.score += ds * (10 + (s.comboMultiplier - 1) * 3);
  }

  // Zone transitions
  const nextZoneIdx = zoneIndexAt(s.distanceM);
  if (nextZoneIdx !== s.zoneIndex) {
    s.zoneIndex = nextZoneIdx;
    const z = RUNNER_ZONES[nextZoneIdx]!;
    out.push({ type: "zone-change", zoneName: z.name });
    addPopup(s, z.name, "cyan", { subtext: z.subtitle, ttlMs: 2200 });
  }

  // Detect dead-stopped stall / won't-start end condition
  if (!eng.running && s.speedMps < 1.2) {
    s.deadStopSec += dt;
    const limit = s.everStarted ? 4.0 : 3.2;
    if (s.deadStopSec >= limit) {
      enterDying(s, "stalled");
      return out;
    }
  } else {
    s.deadStopSec = 0;
  }
  // Safety net: a running motor that can't move the bike at all eventually bogs out.
  if (eng.running && s.speedMps < 0.5 && !input.brake && !input.clutch) {
    s.boggedSec += dt;
    if (s.boggedSec >= BOG_OUT_SEC) {
      observe(s, "Bogged down to a crawl and couldn't pull away.");
      enterDying(s, "stalled");
      return out;
    }
  } else {
    s.boggedSec = 0;
  }

  // ── Lane switching with input buffering ──
  const prevLanePos = s.lanePos;
  if (input.laneDir !== 0) {
    const inTransition = Math.abs(s.lanePos - s.targetLane) > 0.22;
    if (inTransition) {
      s.queuedLaneDir = input.laneDir;
    } else {
      const nextLane = clamp(s.targetLane + input.laneDir, 0, 2) as RunnerLane;
      if (nextLane !== s.targetLane) {
        s.targetLane = nextLane;
        out.push({ type: "lane-shift" });
      }
    }
  }

  const laneDiff = s.targetLane - s.lanePos;
  if (Math.abs(laneDiff) > 0.005) {
    const step = Math.sign(laneDiff) * Math.min(Math.abs(laneDiff), LANE_SWITCH_SPEED * dt);
    s.lanePos += step;
    s.leanAngle = clamp(laneDiff * 1.4, -1, 1);
  } else {
    s.lanePos = s.targetLane;
    s.lane = s.targetLane;
    s.leanAngle *= Math.max(0, 1 - dt * 12);
    if (s.queuedLaneDir !== 0) {
      const nextLane = clamp(s.targetLane + s.queuedLaneDir, 0, 2) as RunnerLane;
      s.queuedLaneDir = 0;
      if (nextLane !== s.targetLane) {
        s.targetLane = nextLane;
        out.push({ type: "lane-shift" });
      }
    }
  }

  // ── Wheelie: tap pops it, holding balances it (capped) ──
  if (input.wheeliePulse) {
    if (!s.isWheeling) {
      triggerWheelie(s, out);
      if (!s.isWheeling) s.queuedWheelieSec = 0.2;
    } else {
      s.queuedWheelieSec = 0.2;
    }
  }
  updateWheelie(s, input.wheelieHeld ?? false, dt, out);

  // ── Spawn entities ahead ──
  const spawnHorizonM = s.distanceM + 115;
  while (s.nextObstacleAtM < spawnHorizonM) spawnObstacleWave(s);
  while (s.nextCollectibleAtM < spawnHorizonM) spawnCollectibleLine(s);
  while (s.nextShopAtM < spawnHorizonM) spawnShopArch(s);

  // ── Traffic & dogs move ──
  updateLaneChangers(s, dt);
  advanceTraffic(s, dt);
  for (const ent of s.entities) {
    if (ent.subKind !== "dog" || ent.hit) continue;
    const lat = ent.lateralSpeed ?? 0;
    ent.lanePos += lat * dt;
    if (ent.lanePos <= 0) {
      ent.lanePos = 0;
      ent.lateralSpeed = Math.abs(lat);
    } else if (ent.lanePos >= 2) {
      ent.lanePos = 2;
      ent.lateralSpeed = -Math.abs(lat);
    }
    ent.lane = clamp(Math.round(ent.lanePos), 0, 2) as RunnerLane;
  }

  // ── Resolve collisions & arcade events ──
  const playerX = s.distanceM;
  for (const ent of s.entities) {
    const relX = ent.xM - playerX;

    // Magnet pulls nearby collectibles into player's lane
    if (ent.kind === "collectible" && !ent.collected && s.magnetSec > 0 && relX > -3 && relX < 26) {
      const pull = s.lanePos - ent.lanePos;
      ent.lanePos += pull * Math.min(1, dt * 8);
    }

    const laneGap = Math.abs(ent.lanePos - s.lanePos);
    const halfLen = ent.lengthM * 0.5 + 1.1;

    if (ent.kind === "collectible" && !ent.collected) {
      if (Math.abs(relX) < halfLen && laneGap < 0.55) {
        ent.collected = true;
        s.partsCollected += 1;
        bumpCombo(s, 1);
        const basePts =
          ent.subKind === "cylinder" ? 120 : ent.subKind === "pipe" ? 95 : ent.subKind === "jet" ? 75 : 60;
        const pts = basePts * s.comboMultiplier;
        s.score += pts;
        out.push({
          type: "pickup",
          kind: ent.subKind as RunnerCollectibleKind,
          points: pts,
          comboStep: s.comboCount,
        });
      }
      continue;
    }

    if (ent.kind === "shop" && !ent.collected) {
      // Shop arches span all lanes visually, bonus lane gives extra punch, passing through triggers effect
      if (Math.abs(relX) < 3.0) {
        ent.collected = true;
        const shop = ent.subKind as RunnerShopKind;
        out.push({ type: "shop-arch", shop });
        if (shop === "treatland") {
          s.turboSec = 5.5;
          s.turboCoastdown = true;
          s.invincibleSec = Math.max(s.invincibleSec, 1.5);
          s.score += 250;
          addPopup(s, "TREATLAND TURBO!", "gold", { subtext: "+250 • Speed boost!", ttlMs: 2000 });
        } else if (shop === "1977-mopeds") {
          s.health = Math.min(s.maxHealth, s.health + 1);
          eng.chtC = Math.max(70, eng.chtC - 30);
          eng.fuelBowlPct = 100;
          s.score += 200;
          addPopup(s, "1977 PIT STOP!", "green", { subtext: "+1 HP & cooled off!", ttlMs: 2000 });
        } else {
          s.magnetSec = 7.5;
          s.score += 200;
          addPopup(s, "MYRON'S MAGNET!", "cyan", { subtext: "+200 • Pulling parts!", ttlMs: 2000 });
        }
      }
      continue;
    }

    if (ent.kind !== "obstacle" || ent.hit) continue;
    const vehicle = isVehicle(ent);

    // Telegraphs: a dog barks as you approach it
    if (ent.subKind === "dog" && !ent.barked && relX > 0 && relX < 42) {
      ent.barked = true;
      out.push({ type: "dog-bark" });
    }

    // Car horn when you cut tightly in front of a vehicle
    if (
      vehicle &&
      !ent.hornSounded &&
      relX < -1 &&
      relX > -(ent.lengthM * 0.5 + 7) &&
      Math.abs(prevLanePos - ent.lanePos) >= 0.45 &&
      laneGap < 0.45
    ) {
      ent.hornSounded = true;
      out.push({ type: "car-horn" });
      addPopup(s, "HONK!", "orange", { key: "honk", cooldownSec: 3, ttlMs: 900 });
    }

    // Wheelie Clear check over ground hazards
    if (ent.groundHazard && Math.abs(relX) < halfLen && laneGap < 0.48) {
      if (s.isWheeling && s.wheelieHeightFrac > 0.22) {
        if (!ent.wheelieCleared) {
          ent.wheelieCleared = true;
          s.wheelieClears += 1;
          bumpCombo(s, 1);
          const pts = 150 * s.comboMultiplier;
          s.score += pts;
          s.hitStopSec = Math.max(s.hitStopSec, HIT_STOP_SEC);
          out.push({ type: "wheelie-clear", points: pts });
          addPopup(s, `WHEELIE CLEAR +${pts}`, "gold", {
            subtext: `Combo x${s.comboMultiplier}`,
            ttlMs: 1400,
          });
        }
        continue;
      }
    }

    // Close call when passing traffic (or a dog) in an adjacent lane
    const passBack = ent.lengthM * 0.5;
    if (
      !ent.groundHazard &&
      !ent.nearMissAwarded &&
      relX < -passBack + 1 &&
      relX > -(passBack + 6) &&
      laneGap >= 0.52 &&
      laneGap <= 1.28
    ) {
      ent.nearMissAwarded = true;
      s.closeCalls += 1;
      bumpCombo(s, 1);
      const pts = 100 * s.comboMultiplier;
      s.score += pts;
      out.push({ type: "close-call", points: pts });
      addPopup(s, `CLOSE CALL +${pts}`, "cyan", {
        subtext: `Combo x${s.comboMultiplier}`,
        ttlMs: 1300,
      });
    }

    // Collision check
    if (Math.abs(relX) < halfLen - 0.35 && laneGap < 0.42) {
      ent.hit = true;
      if (s.invincibleSec > 0 || s.turboSec > 0) continue;
      s.health = Math.max(0, s.health - 1);
      s.invincibleSec = 1.65;
      s.hitFlashSec = 0.35;
      s.cameraShakeSec = 0.45;
      s.hitStopSec = HIT_STOP_SEC;
      s.comboCount = 0;
      s.comboMultiplier = 1;
      s.comboTimerSec = 0;
      s.speedMps *= 0.6;
      out.push({ type: "hit", remainingHp: s.health });

      const label =
        ent.subKind === "car"
          ? "CLIPPED TRAFFIC!"
          : ent.subKind === "bus"
            ? "AC TRANSIT BUS!"
            : ent.subKind === "pothole"
              ? "OAKLAND POTHOLE!"
              : ent.subKind === "dog"
                ? "DODGE THAT DOG!"
                : ent.subKind === "oil-slick"
                  ? "OIL SLICK!"
                  : "SMASHED CONE!";
      addPopup(s, label, "red", {
        subtext: s.health > 0 ? `${s.health} HP left` : "WIPEOUT!",
        ttlMs: 1600,
      });

      if (s.health <= 0) {
        enterDying(s, "crashed");
        return out;
      }
    }
  }

  // Prune entities far behind
  s.entities = s.entities.filter((e) => e.xM - playerX > -24 && !e.collected);

  // ── Observable symptom callouts — pure sensations, never a diagnosis ──
  if (eng.running && wasRunning) {
    if (sustained(s, "fourstroke", eng.misfirePattern === "alternate", dt, 1.5)) {
      addPopup(s, "BLUB-BLUB… FOUR-STROKING!", "orange", {
        subtext: "Thick blue fog — sounds wet and lazy",
        key: "sym-rich",
        cooldownSec: 20,
      });
      observe(s, "Four-stroked with thick blue-grey smoke — top speed & wheelies suffered.");
    }
    if (sustained(s, "highrpm", eng.misfirePattern === "high-rpm", dt, 1.0)) {
      addPopup(s, "BREAKING UP UP TOP!", "orange", {
        subtext: "Cuts out when you wring it",
        key: "sym-spark",
        cooldownSec: 20,
      });
      observe(s, "Broke up at high RPM under load.");
    }
    if (sustained(s, "random", eng.misfirePattern === "random" && eng.fuelBowlPct > 35, dt, 1.3)) {
      addPopup(s, "STUTTERING IN TRAFFIC!", "orange", {
        subtext: "Stumbling under load",
        key: "sym-foul",
        cooldownSec: 20,
      });
      observe(s, "Random misfires and stumbling in traffic.");
    }
    if (sustained(s, "slip", eng.clutchSlip > 0.25, dt, 1.2)) {
      addPopup(s, "REVS SCREAM, NO PULL!", "orange", {
        subtext: "Engine howls but the bike barely picks up",
        key: "sym-clutch",
        cooldownSec: 20,
      });
      observe(s, "Revs flared without the speed following — weak pulls and short wheelies.");
    }
    if (sustained(s, "lean", eng.leanTone > 0.5, dt, 2.5)) {
      addPopup(s, "RAZOR-THIN SCREAM!", "orange", {
        subtext: "Sounds thin and angry",
        key: "sym-lean",
        cooldownSec: 24,
      });
      observe(s, "Sounded thin and angry — ran hot.");
    }
    if (sustained(s, "pipe", eng.powerbandActive, dt, 0.3)) {
      addPopup(s, "ON THE PIPE! BRAAAAP!", "gold", {
        key: "sym-pipe",
        cooldownSec: 16,
        ttlMs: 1400,
      });
    }
    if (sustained(s, "dry", !profile.effects.premix, dt, 4.5)) {
      addPopup(s, "DRY & TINNY!", "red", {
        subtext: "No smoke — sounds bone dry!",
        key: "sym-premix",
        cooldownSec: 18,
      });
      observe(s, "Almost no smoke; sounded dry and tinny.");
    }
  }

  return out;
}

// ── SNAPSHOTS & ADAPTERS ───────────────────────────────────────────────────

export function buildRunnerHudSnapshot(s: RunnerState): RunnerHudSnapshot {
  const eng = s.engine;
  const zone = RUNNER_ZONES[s.zoneIndex] ?? RUNNER_ZONES[0]!;
  return {
    finished: s.finished,
    endReason: s.endReason,
    dying: s.dying,
    deathElapsedSec: s.deathElapsedSec,
    deathDurationSec: s.deathDurationSec,
    deathReason: s.deathReason,
    score: Math.round(s.score),
    distanceM: Math.round(s.distanceM),
    speedMph: s.speedMps * MPS_TO_MPH,
    topSpeedMph: s.topSpeedMph,
    engineTopSpeedMph: s.engineTopSpeedMph,
    gradePct: s.gradePct,
    headwindActive: s.headwindActive,
    health: s.health,
    maxHealth: s.maxHealth,
    comboCount: s.comboCount,
    comboMultiplier: s.comboMultiplier,
    comboPct: clamp((s.comboTimerSec / COMBO_WINDOW_SEC) * 100, 0, 100),
    wheelieClears: s.wheelieClears,
    closeCalls: s.closeCalls,
    partsCollected: s.partsCollected,
    zoneName: zone.name,
    zoneSubtitle: zone.subtitle,
    zoneAccentHex: zone.accentHex,
    turboSec: s.turboSec,
    magnetSec: s.magnetSec,
    isWheeling: s.isWheeling,
    engineRunning: eng.running,
    rpm: eng.rpm,
    maxRpm: s.profile.maxRpm,
    chtC: eng.chtC,
    hasTach: s.opts.hasTach,
    hasChtGauge: s.opts.hasChtGauge,
    powerbandActive: eng.powerbandActive,
    fuelBowlPct: eng.fuelBowlPct,
    stalled: eng.stalled,
    seizeWarning: eng.seizeWarning,
    seizeActive: eng.seizeActive,
    seizeClutchWindowMs: eng.seizeActive ? Math.max(0, eng.seizeWindowMs) : 0,
    seizedHard: eng.seizedHard,
    seizeCooldownHot: eng.seizeSavedPending && eng.chtC > SEIZE_RESTART_CHT_C,
    misfirePattern: eng.misfirePattern,
    smokeTint: eng.smokeTint,
    smokeDensity: eng.smokeDensity,
    clutchSlip: eng.clutchSlip,
    popups: s.popups.map((p) => ({ ...p })),
  };
}

/**
 * Adapter so Runner Mode feeds our exact firing-pulse 2-stroke Web Audio synth (`PulseSynth`)
 * with zero duplicate synth code and zero FaultIds.
 */
export function buildRunnerAudioTelemetry(s: RunnerState, brakeHeld: boolean, clutchHeld: boolean): RideTelemetrySnapshot {
  const eng = s.engine;
  const p = s.profile;
  const zone = RUNNER_ZONES[s.zoneIndex] ?? RUNNER_ZONES[0]!;
  // During the death beat the rider is off the gas — no droning at full throttle.
  const offGas = s.dying || s.finished;
  return {
    active: !s.finished,
    routeId: "telegraph-coffee",
    routeName: zone.name,
    timeOfDay: zone.timeOfDay,
    bikeMake: s.bike.make,
    bikeColorHex: s.bike.colorHex,
    bikeAccentHex: s.bike.accentHex,
    exhaustVisual: p.exhaustVisual,
    cylinderVisual: p.cylinderVisual,
    distanceM: s.distanceM,
    routeLengthM: Math.max(1000, s.distanceM + 500),
    speedMph: s.speedMps * MPS_TO_MPH,
    gradePct: s.gradePct,
    landmark: zone.name,
    atStoplight: false,
    stoplightRedSec: 0,
    throttle: offGas ? 0 : brakeHeld ? 0.12 : 0.96,
    brake: offGas || brakeHeld,
    tuck: s.turboSec > 0,
    choke: false,
    clutchPulled: clutchHeld,
    pedaling: s.pedalAssist && !offGas,
    stamina: 100,
    engineRunning: eng.running,
    rpm: eng.rpm,
    maxRpm: p.maxRpm,
    hasTach: s.opts.hasTach,
    hasChtGauge: s.opts.hasChtGauge,
    hasStethoscope: s.opts.hasStethoscope,
    listenMode: false,
    chtC: eng.chtC,
    powerbandActive: !offGas && (eng.powerbandActive || s.turboSec > 0),
    fuelBowlPct: eng.fuelBowlPct,
    smoke: { density: eng.smokeDensity, tint: eng.smokeTint },
    misfirePattern: eng.misfirePattern,
    misfireRate: eng.misfireRate,
    leanTone: eng.leanTone,
    detonationPulse: eng.detonationPulse,
    clutchSlip: eng.clutchSlip,
    pistonKnock: eng.pistonKnock,
    compressionFeel: eng.compressionFeel,
    stalled: eng.stalled,
    stallReason: eng.stallReason,
    seizeWarning: eng.seizeWarning,
    seizeActive: eng.seizeActive,
    seizeClutchWindowMs: eng.seizeActive ? Math.max(0, eng.seizeWindowMs) : 0,
    seizedHard: eng.seizedHard,
    seizeCooldownHot: eng.seizeSavedPending && eng.chtC > SEIZE_RESTART_CHT_C,
    pedalingHome: false,
    pedalHomeRemainingM: 0,
    coffeeTempPct: null,
    coffeeSpillPct: null,
    elapsedSec: s.elapsedSec,
    captions: [],
  };
}

export function finalizeRunnerRun(
  s: RunnerState,
  reason: RunnerEndReason = s.endReason ?? s.deathReason ?? "aborted",
): RunnerRunResult {
  // Aborting mid death-beat can never dodge a crash/seize/stall.
  const endReason: RunnerEndReason = reason === "aborted" && s.deathReason ? s.deathReason : reason;
  const eng = s.engine;
  const distM = Math.round(s.distanceM);
  const rawScore = Math.round(s.score);
  // Respect server leaderboard plausibility bound just in case
  const maxPlausible = distM * 30 + s.partsCollected * 600 + 9_500;
  const score = Math.min(rawScore, maxPlausible);

  const km = s.distanceM / 1000;
  // Dialed builds that ran symptom-free get a 1.25× cash bonus.
  const cleanTuneBonus = s.notes.length === 0 && distM >= 150;
  const baseCash = Math.round(score / 190) + s.partsCollected * 2;
  const cashEarned = distM < 25 ? 0 : Math.min(120, Math.round(baseCash * (cleanTuneBonus ? 1.25 : 1)));
  const repEarned = distM < 40 ? 0 : Math.min(35, Math.floor(distM / 180) + Math.floor(s.wheelieClears / 3));

  const zone = RUNNER_ZONES[s.zoneIndex] ?? RUNNER_ZONES[0]!;
  const notes = [...s.notes];
  if (eng.detonations > 0) {
    notes.push(`Heard ${eng.detonations} detonation ping${eng.detonations === 1 ? "" : "s"}.`);
  }
  if (eng.seizesSaved > 0) notes.push("Saved a seize in traffic with the clutch!");
  if (notes.length === 0 && distM >= 100) {
    notes.push("Engine ran clean through Oakland traffic.");
  }

  const summary: RunnerRunSummary = {
    bikeId: s.bike.id,
    bikeMake: s.bike.make,
    bikeNickname: s.bike.nickname,
    score,
    distanceM: distM,
    topSpeedMph: Math.round(s.topSpeedMph * 10) / 10,
    engineTopSpeedMph: Math.round(s.engineTopSpeedMph * 10) / 10,
    maxChtC: Math.round(eng.maxChtC),
    maxCombo: s.maxCombo,
    wheelieClears: s.wheelieClears,
    closeCalls: s.closeCalls,
    partsCollected: s.partsCollected,
    zoneReached: zone.name,
    endReason,
    cashEarned,
    repEarned,
    cleanTuneBonus,
    notes,
  };

  // Lighter wear than tuning hills so Runner Mode stays fun, while still honoring real heat/seizes
  const wearDelta: OwnedBike["wear"] = {
    plugFouling: eng.plugFoulGain * 0.55,
    pistonScore: eng.detonations * 0.4 + eng.seizesSaved * 14 + eng.seizeCrashes * 55 + eng.hotSec * 0.04,
    clutchWear: km * 0.9 + eng.slipSec * 0.8,
    fuelFilterClog: km * 1.2,
    gasketWear: km * 1.0,
    airFilterDirt: km * 1.1,
  };

  return {
    summary,
    wearDelta,
    plugColor: rideEndPlugColor(eng, s.profile),
    pushedHard: eng.hotSec > 15 || eng.detonations > 3 || eng.seizesSaved + eng.seizeCrashes > 0,
    hotSeconds: eng.hotSec,
    odometerDeltaM: s.distanceM,
    seizesSaved: eng.seizesSaved,
  };
}

export { SEIZE_CLUTCH_WINDOW_MS };
