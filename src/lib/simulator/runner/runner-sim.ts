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
export type RunnerObstacleKind = "car" | "pothole" | "oil-slick" | "traffic-cone" | "dog";
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
  | { type: "pickup"; kind: RunnerCollectibleKind; points: number }
  | { type: "shop-arch"; shop: RunnerShopKind }
  | { type: "hit"; remainingHp: number }
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
  score: number;

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
  score: number;
  distanceM: number;
  speedMph: number;
  topSpeedMph: number;
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
const LANE_SWITCH_SPEED = 9.5; // lanes per second
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
    score: 0,

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
  const strong = duration >= 0.56;
  out.push({ type: "wheelie", strong });
  if (!strong) {
    addPopup(s, "BOGGY WHEELIE!", "orange", {
      subtext: "Bike feels sluggish — check tune",
      key: "boggy-wheelie",
      cooldownSec: 12,
      ttlMs: 1800,
    });
  }
}

// ── SPAWNERS ───────────────────────────────────────────────────────────────

function spawnObstacleWave(s: RunnerState): void {
  const rng = s.rng;
  const difficulty = clamp(s.distanceM / 1800, 0, 1);
  const baseM = s.nextObstacleAtM;

  // Choose 1 or 2 obstacles in distinct lanes (never wall off all 3 lanes with cars)
  const lanes: RunnerLane[] = [0, 1, 2];
  // Shuffle lanes
  for (let i = lanes.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [lanes[i], lanes[j]] = [lanes[j]!, lanes[i]!];
  }

  const waveCount = chance(rng, 0.32 + difficulty * 0.38) ? 2 : 1;
  let carsInWave = 0;

  for (let idx = 0; idx < waveCount; idx++) {
    const lane = lanes[idx]!;
    const roll = rng();
    let subKind: RunnerObstacleKind;
    if (roll < 0.42 && carsInWave < 2) {
      subKind = "car";
      carsInWave++;
    } else if (roll < 0.62) {
      subKind = "pothole";
    } else if (roll < 0.77) {
      subKind = "traffic-cone";
    } else if (roll < 0.9) {
      subKind = "oil-slick";
    } else {
      subKind = "dog";
    }

    const isCar = subKind === "car";
    const carVariants: RunnerCarVariant[] = ["sedan", "hatchback", "van"];
    const carVariant = isCar ? carVariants[Math.floor(rng() * carVariants.length)] : undefined;
    const carColor = isCar ? CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)] : undefined;

    s.entities.push({
      id: s.nextEntityId++,
      kind: "obstacle",
      subKind,
      xM: baseM + idx * nextRange(rng, 2, 7),
      lane,
      lanePos: lane,
      lengthM: isCar ? (carVariant === "van" ? 6.2 : 5.2) : 2.5,
      groundHazard: !isCar,
      speedMps: isCar ? nextRange(rng, 3.8, 6.5) : subKind === "dog" ? 1.4 : 0,
      carVariant,
      carColor,
      collected: false,
      hit: false,
      wheelieCleared: false,
      nearMissAwarded: false,
    });
  }

  // Spacing tightens smoothly as distance increases, but scales with speed so it stays fair
  const minGap = 32 - difficulty * 9;
  const maxGap = 54 - difficulty * 14;
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

// ── STEP LOOP ──────────────────────────────────────────────────────────────

export function stepRunner(s: RunnerState, input: RunnerInput, dt: number): RunnerEvent[] {
  const out: RunnerEvent[] = [];
  if (s.finished) return out;

  const eng = s.engine;
  const profile = s.profile;
  const simEvents: SimEvent[] = [];

  s.elapsedSec += dt;

  // Timers
  s.invincibleSec = Math.max(0, s.invincibleSec - dt);
  s.hitFlashSec = Math.max(0, s.hitFlashSec - dt);
  s.cameraShakeSec = Math.max(0, s.cameraShakeSec - dt);
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

  for (const p of s.popups) p.ttlMs -= dt * 1000;
  s.popups = s.popups.filter((p) => p.ttlMs > 0);

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
      addPopup(s, "NO SPARK — KILL SWITCH!", "red", {
        subtext: "Flip kill switch to RUN in Garage",
        key: "no-spark-kick",
        cooldownSec: 4,
      });
      observe(s, "Refused to fire on the starting line — no spark.");
    } else if (s.autoKicksLeft === 0 || s.everStarted) {
      addPopup(s, "KICK… NOTHING!", "orange", {
        subtext: "Check spark / fuel in Garage",
        key: "kick-fail",
        cooldownSec: 4,
      });
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
    { speedMps: s.speedMps },
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
      observe(s, "Detonation pinging under full throttle — running lean/hot.");
    } else if (ev.type === "seize-warning") {
      addPopup(s, "RUNNING HOT! READY [Q] CLUTCH!", "red", {
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
      s.finished = true;
      s.endReason = "seized";
      s.cameraShakeSec = 0.6;
      observe(s, "Engine seized hard in Oakland traffic.");
      return out;
    } else if (ev.type === "stalled") {
      if (ev.reason === "fuel") {
        addPopup(s, "FUEL STARVED! TAP [R]!", "orange", {
          subtext: "Bowl drained under load",
          key: "stall-fuel",
          cooldownSec: 5,
        });
        observe(s, "Starved for fuel and stalled under load.");
      } else {
        addPopup(s, "ENGINE STALLED! TAP [R]!", "orange", {
          key: "stall-other",
          cooldownSec: 5,
        });
        observe(s, "Stalled out mid-run.");
      }
    }
  }

  // ── Longitudinal speed from real engine drive force ──
  const m = profile.massKg;
  // Slightly lower aero drag than upright cruising (rider tucked in traffic)
  const cdA = profile.cdA * 0.88;
  const drag = 0.5 * AIR_DENSITY * cdA * s.speedMps * s.speedMps;
  const rolling = s.speedMps > 0.05 ? profile.crr * m * G : 0;
  const brakeForce = input.brake && s.speedMps > 0.1 ? 340 : 0;
  const turboForce = s.turboSec > 0 ? 185 : 0;
  const netForce = eng.driveForceN + turboForce - drag - rolling - brakeForce;

  let nextV = Math.max(0, s.speedMps + (netForce / m) * dt);
  if (eng.wheelLocked) nextV = Math.max(0, s.speedMps - 7 * dt);
  if (s.turboSec > 0 && eng.running) {
    nextV = Math.max(nextV, Math.min(24.5, nextV + 3 * dt));
  }
  s.speedMps = nextV;

  const ds = s.speedMps * dt;
  s.distanceM += ds;
  const mph = s.speedMps * MPS_TO_MPH;
  s.topSpeedMph = Math.max(s.topSpeedMph, mph);

  // Distance score (respects leaderboard plausibility bound)
  if (ds > 0) {
    s.score += ds * (10 + (s.comboMultiplier - 1) * 3);
  }

  // Zone transitions
  const nextZoneIdx = Math.floor(s.distanceM / ZONE_STEP_M) % RUNNER_ZONES.length;
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
      s.finished = true;
      s.endReason = "stalled";
      return out;
    }
  } else {
    s.deadStopSec = 0;
  }

  // ── Lane switching with input buffering ──
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

  // ── Wheelie mechanics with input buffering ──
  if (input.wheeliePulse) {
    if (!s.isWheeling) {
      triggerWheelie(s, out);
      if (!s.isWheeling) s.queuedWheelieSec = 0.2;
    } else {
      s.queuedWheelieSec = 0.2;
    }
  }

  if (s.isWheeling) {
    s.wheelieTimerSec -= dt;
    if (s.wheelieTimerSec <= 0) {
      s.isWheeling = false;
      s.wheelieTimerSec = 0;
      s.wheelieHeightFrac = 0;
      if (s.queuedWheelieSec > 0) {
        triggerWheelie(s, out);
      }
    } else {
      const progress = 1 - s.wheelieTimerSec / Math.max(0.05, s.wheelieDurationSec);
      s.wheelieHeightFrac = Math.sin(progress * Math.PI);
    }
  } else {
    s.wheelieHeightFrac = 0;
  }

  // ── Spawn entities ahead ──
  const spawnHorizonM = s.distanceM + 115;
  while (s.nextObstacleAtM < spawnHorizonM) spawnObstacleWave(s);
  while (s.nextCollectibleAtM < spawnHorizonM) spawnCollectibleLine(s);
  while (s.nextShopAtM < spawnHorizonM) spawnShopArch(s);

  // ── Update entities & resolve collisions ──
  const playerX = s.distanceM;
  for (const ent of s.entities) {
    if (ent.speedMps > 0) {
      ent.xM += ent.speedMps * dt;
    }

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
        out.push({ type: "pickup", kind: ent.subKind as RunnerCollectibleKind, points: pts });
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
          s.invincibleSec = Math.max(s.invincibleSec, 1.5);
          s.score += 250;
          addPopup(s, "TREATLAND TURBO!", "gold", { subtext: "+250 • Speed boost!", ttlMs: 2000 });
        } else if (shop === "1977-mopeds") {
          s.health = Math.min(s.maxHealth, s.health + 1);
          eng.chtC = Math.max(70, eng.chtC - 30);
          eng.fuelBowlPct = 100;
          s.score += 200;
          addPopup(s, "1977 PIT STOP!", "green", { subtext: "+1 HP & Cooled CHT!", ttlMs: 2000 });
        } else {
          s.magnetSec = 7.5;
          s.score += 200;
          addPopup(s, "MYRON'S MAGNET!", "cyan", { subtext: "+200 • Pulling parts!", ttlMs: 2000 });
        }
      }
      continue;
    }

    if (ent.kind === "obstacle" && !ent.hit) {
      // Wheelie Clear check over ground hazards
      if (ent.groundHazard && Math.abs(relX) < halfLen && laneGap < 0.48) {
        if (s.isWheeling && s.wheelieHeightFrac > 0.22) {
          if (!ent.wheelieCleared) {
            ent.wheelieCleared = true;
            s.wheelieClears += 1;
            bumpCombo(s, 1);
            const pts = 150 * s.comboMultiplier;
            s.score += pts;
            out.push({ type: "wheelie-clear", points: pts });
            addPopup(s, `WHEELIE CLEAR +${pts}`, "gold", {
              subtext: `Combo x${s.comboMultiplier}`,
              ttlMs: 1400,
            });
          }
          continue;
        }
      }

      // Close call check when passing a car in an adjacent lane
      if (!ent.groundHazard && !ent.nearMissAwarded && relX < -1.5 && relX > -7 && laneGap >= 0.52 && laneGap <= 1.28) {
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
        if (s.invincibleSec > 0 || s.turboSec > 0) {
          ent.hit = true;
          continue;
        }
        ent.hit = true;
        s.health = Math.max(0, s.health - 1);
        s.invincibleSec = 1.65;
        s.hitFlashSec = 0.35;
        s.cameraShakeSec = 0.45;
        s.comboCount = 0;
        s.comboMultiplier = 1;
        s.comboTimerSec = 0;
        s.speedMps *= 0.6;
        out.push({ type: "hit", remainingHp: s.health });

        const label =
          ent.subKind === "car"
            ? "CLIPPED TRAFFIC!"
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
          s.finished = true;
          s.endReason = "crashed";
          return out;
        }
      }
    }
  }

  // Prune entities far behind
  s.entities = s.entities.filter((e) => e.xM - playerX > -24 && !e.collected);

  // ── Observable symptom callouts (teach players WHY tuning matters in runner!) ──
  if (eng.running && wasRunning) {
    if (sustained(s, "fourstroke", eng.misfirePattern === "alternate", dt, 1.5)) {
      addPopup(s, "BLUB-BLUB… FOUR-STROKING!", "orange", {
        subtext: "Too rich — jet down in Garage!",
        key: "sym-rich",
        cooldownSec: 20,
      });
      observe(s, "Four-stroked with thick blue-grey smoke — top speed & wheelies suffered.");
    }
    if (sustained(s, "highrpm", eng.misfirePattern === "high-rpm", dt, 1.0)) {
      addPopup(s, "BREAKING UP AT HIGH RPM!", "orange", {
        subtext: "Check spark in Garage",
        key: "sym-spark",
        cooldownSec: 20,
      });
      observe(s, "Broke up at high RPM under load.");
    }
    if (sustained(s, "random", eng.misfirePattern === "random" && eng.fuelBowlPct > 35, dt, 1.3)) {
      addPopup(s, "STUTTERING IN TRAFFIC!", "orange", {
        subtext: "Pull the plug in Garage",
        key: "sym-foul",
        cooldownSec: 20,
      });
      observe(s, "Random misfires and stumbling in traffic.");
    }
    if (sustained(s, "slip", eng.clutchSlip > 0.25, dt, 1.2)) {
      addPopup(s, "CLUTCH SLIPPING!", "orange", {
        subtext: "Revs scream, weak pull",
        key: "sym-clutch",
        cooldownSec: 20,
      });
      observe(s, "Clutch slipped hard — weak acceleration and short wheelies.");
    }
    if (sustained(s, "lean", eng.leanTone > 0.5, dt, 2.5)) {
      addPopup(s, "THIN, ANGRY EXHAUST NOTE!", "orange", {
        subtext: "Running lean — watch CHT!",
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
      addPopup(s, "NO SMOKE — SOUNDS DRY!", "red", {
        subtext: "Did you forget 2T premix oil?!",
        key: "sym-premix",
        cooldownSec: 18,
      });
      observe(s, "Almost no smoke and sounded dry — check 2-stroke premix oil!");
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
    score: Math.round(s.score),
    distanceM: Math.round(s.distanceM),
    speedMph: s.speedMps * MPS_TO_MPH,
    topSpeedMph: s.topSpeedMph,
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
    gradePct: 0,
    landmark: zone.name,
    atStoplight: false,
    stoplightRedSec: 0,
    throttle: brakeHeld ? 0.12 : 0.96,
    brake: brakeHeld,
    tuck: s.turboSec > 0,
    choke: false,
    clutchPulled: clutchHeld,
    pedaling: false,
    stamina: 100,
    engineRunning: eng.running,
    rpm: eng.rpm,
    maxRpm: p.maxRpm,
    hasTach: s.opts.hasTach,
    hasChtGauge: s.opts.hasChtGauge,
    hasStethoscope: s.opts.hasStethoscope,
    listenMode: false,
    chtC: eng.chtC,
    powerbandActive: eng.powerbandActive || s.turboSec > 0,
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
  reason: RunnerEndReason = s.endReason ?? "aborted",
): RunnerRunResult {
  const eng = s.engine;
  const distM = Math.round(s.distanceM);
  const rawScore = Math.round(s.score);
  // Respect server leaderboard plausibility bound just in case
  const maxPlausible = distM * 30 + s.partsCollected * 600 + 9_500;
  const score = Math.min(rawScore, maxPlausible);

  const km = s.distanceM / 1000;
  const cashEarned = distM < 25 ? 0 : Math.min(120, Math.round(score / 140) + s.partsCollected * 2);
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
    maxChtC: Math.round(eng.maxChtC),
    maxCombo: s.maxCombo,
    wheelieClears: s.wheelieClears,
    closeCalls: s.closeCalls,
    partsCollected: s.partsCollected,
    zoneReached: zone.name,
    endReason: reason,
    cashEarned,
    repEarned,
    notes,
  };

  // Lighter wear than tuning hills so Runner Mode stays fun, while still honoring real heat/seizes
  const wearDelta: OwnedBike["wear"] = {
    plugFouling: eng.plugFoulGain * 0.55,
    pistonScore: eng.detonations * 0.4 + eng.seizesSaved * 14 + eng.seizeCrashes * 55 + eng.hotSec * 0.04,
    clutchWear: km * 0.9 + eng.slipSec * 0.8,
    fuelFilterClog: km * 1.2,
    gasketWear: km * 1.0,
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
