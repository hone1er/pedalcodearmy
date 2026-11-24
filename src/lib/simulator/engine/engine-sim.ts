// Continuous 2-stroke engine model for Ran When Parked.
//
// Honest-but-fun physics: mixture from jet area / needle / idle circuit,
// a float bowl fed through the fuel filter, a torque curve with a pipe
// powerband, a lumped CHT thermal model, detonation, progressive seizing,
// and *observable* symptoms (smoke, misfire patterns, tone, plug color).
//
// The engine never exposes fault IDs — only physical consequences.

import { type Rng, chance, mulberry32 } from "../core/rng";
import type {
  ComicCaption,
  MisfirePattern,
  OwnedBike,
  PlugColor,
  RideTelemetrySnapshot,
  SimBikeMake,
  SimEvent,
  SmokeTint,
  StallReason,
  StandTestInput,
} from "../contract";
import { getIdealJetForBike, getPartById } from "../economy/catalog";
import { type FaultEffects, getFaultEffects } from "../faults/catalog";

// ── CONSTANTS ──────────────────────────────────────────────────────────────

export const AMBIENT_C = 20;
/** Engine rpm per m/s of road speed (fixed final drive, ~30 mph ≈ 6,800 rpm). */
export const RPM_PER_MPS = 507;
/** Newtons at the contact patch per N·m of crank torque (gearing / wheel radius). */
export const FORCE_PER_NM = 64;
export const DETONATION_CHT_C = 195;
export const SEIZE_CHT_C = 225;
export const SEIZE_CLUTCH_WINDOW_MS = 1500;
/** CHT below which a seized-then-saved piston has shrunk enough to kick over. */
export const SEIZE_RESTART_CHT_C = 180;

// ── DRIVETRAINS (G6 — authentic make identity) ─────────────────────────────

/**
 * - `single`: Puch Maxi E50 — one fixed reduction (ratio 1 = RPM_PER_MPS).
 * - `cvt`: Honda Hobbit / Derbi Variant — a belt variator that slides from a
 *   short launch ratio toward overdrive to hold the engine near the pipe.
 * - `two-speed`: Tomos A35 — a real 2-speed automatic that clicks into 2nd.
 */
export type DrivetrainKind = "single" | "cvt" | "two-speed";

export const DRIVETRAIN_BY_MAKE: Record<SimBikeMake, DrivetrainKind> = {
  "puch-maxi": "single",
  "honda-hobbit": "cvt",
  "derbi-variant": "cvt",
  "tomos-a35": "two-speed",
};

/** Variator launch ratio (× RPM_PER_MPS). */
export const CVT_LOW_RATIO = 1.38;
/** Variator overdrive ratio (× RPM_PER_MPS). */
export const CVT_HIGH_RATIO = 0.88;
/** Tomos A35 gear ratios (× RPM_PER_MPS). */
export const TWO_SPEED_RATIOS: Record<1 | 2, number> = { 1: 1.32, 2: 0.94 };
/** Tomos 1→2 upshift road speed (~17.5 mph). */
export const TWO_SPEED_UPSHIFT_MPS = 7.8;
/** Tomos 2→1 downshift road speed (hysteresis). */
export const TWO_SPEED_DOWNSHIFT_MPS = 5.6;
/** Length of the torque "kick" right after the Tomos snaps into 2nd. */
const SHIFT_KICK_SEC = 0.3;

/** Dirty air filter starts choking airflow above this much dirt (0..100). */
export const AIR_FILTER_DIRT_THRESHOLD = 45;
/** Extra richness from a fully clogged (100) air filter. */
const AIR_FILTER_MAX_RICHEN = 0.12;

/** Richness multiplier from a dusty air filter (1 = clean). */
export function airFilterRichenFor(dirt: number | undefined): number {
  const d = clamp(dirt ?? 0, 0, 100);
  if (d <= AIR_FILTER_DIRT_THRESHOLD) return 1;
  return 1 + AIR_FILTER_MAX_RICHEN * ((d - AIR_FILTER_DIRT_THRESHOLD) / (100 - AIR_FILTER_DIRT_THRESHOLD));
}

// ── BIKE PROFILE ───────────────────────────────────────────────────────────

export interface BikeProfile {
  make: SimBikeMake;
  idleRpm: number;
  maxRpm: number;
  clutchEngageRpm: number;
  peakTorqueNm: number;
  powerbandRpm: number;
  powerbandKick: number;
  powerbandWidth: number;
  /** 0..1 torque sag below the powerband for peaky race pipes. */
  belowBandBog: number;
  idealJet: number;
  airflowMult: number;
  fuelSupply: number;
  coolingMult: number;
  sparkBonus: number;
  compressionBonus: number;
  clutchGrip: number;
  massKg: number;
  cdA: number;
  crr: number;
  /** Colder plug on an un-kitted engine fouls faster. */
  plugFoulRateMult: number;
  exhaustVisual: "stock" | "performance" | "race";
  cylinderVisual: "stock" | "performance" | "race";
  airFilterVisual: "stock" | "performance" | "race";
  drivetrain: DrivetrainKind;
  /** Richness multiplier from a dusty air filter (1 = clean). */
  airFilterRichen: number;
  effects: FaultEffects;
}

const MAKE_BASE: Record<
  SimBikeMake,
  { maxRpm: number; torque: number; mass: number; cdA: number; idle: number }
> = {
  // Crisp single-speed E50: the strongest bottom end of the bunch.
  "puch-maxi": { maxRpm: 7200, torque: 2.45, mass: 50, cdA: 0.62, idle: 1500 },
  "honda-hobbit": { maxRpm: 7100, torque: 2.25, mass: 55, cdA: 0.6, idle: 1600 },
  "derbi-variant": { maxRpm: 7300, torque: 2.35, mass: 52, cdA: 0.61, idle: 1550 },
  "tomos-a35": { maxRpm: 7300, torque: 2.3, mass: 48, cdA: 0.62, idle: 1500 },
};

const PIPE_BAND: Record<string, { kick: number; width: number; bog: number }> = {
  "pipe-stock-maxi": { kick: 0.08, width: 1500, bog: 0 },
  "pipe-tecno-boss": { kick: 0.34, width: 1400, bog: 0.04 },
  "pipe-proma-circuit": { kick: 0.62, width: 1250, bog: 0.2 },
};

export function buildBikeProfile(bike: OwnedBike): BikeProfile {
  const base = MAKE_BASE[bike.make] ?? MAKE_BASE["puch-maxi"];
  let maxRpm = base.maxRpm;
  let torqueMult = 1;
  let airflowMult = 1;
  let fuelSupply = 2.0;
  let coolingMult = 1;
  let sparkBonus = 0;
  let compressionBonus = 0;
  let clutchGrip = 1;
  let powerbandRpm = 5200;

  for (const id of Object.values(bike.parts) as (string | undefined)[]) {
    if (!id) continue;
    const p = getPartById(id);
    if (!p) continue;
    if (p.torqueMult) torqueMult *= p.torqueMult;
    if (p.airflowMult) airflowMult *= p.airflowMult;
    if (p.maxRpmBonus) maxRpm += p.maxRpmBonus;
    if (p.coolingBonus) coolingMult += p.coolingBonus;
    if (p.sparkBonus) sparkBonus += p.sparkBonus;
    if (p.compressionBonus) compressionBonus += p.compressionBonus;
    if ((p.slot === "clutch" || p.slot === "belt") && p.clutchGrip) clutchGrip *= p.clutchGrip;
    if (p.slot === "carburetor" && p.fuelFlowRate) fuelSupply *= p.fuelFlowRate;
    if (p.slot === "exhaust" && p.powerbandRpm) powerbandRpm = p.powerbandRpm;
  }

  // Kits shift the band upward a touch.
  const cylId = bike.parts.cylinder;
  if (cylId === "cyl-airsal-65") powerbandRpm += 300;
  if (cylId === "cyl-treat-70") powerbandRpm += 500;

  const band = PIPE_BAND[bike.parts.exhaust] ?? PIPE_BAND["pipe-stock-maxi"]!;
  const exhaust = getPartById(bike.parts.exhaust);
  const cylinder = getPartById(bike.parts.cylinder);
  const airFilter = getPartById(bike.parts["air-filter"]);
  const kitted = cylId !== "cyl-stock-50";

  return {
    make: bike.make,
    idleRpm: base.idle,
    maxRpm,
    clutchEngageRpm: bike.parts.clutch === "clutch-3shoe-race" ? 4300 : 3600,
    peakTorqueNm: base.torque * torqueMult,
    powerbandRpm,
    powerbandKick: band.kick,
    powerbandWidth: band.width,
    belowBandBog: band.bog,
    idealJet: getIdealJetForBike(bike),
    airflowMult,
    fuelSupply,
    coolingMult,
    sparkBonus,
    compressionBonus,
    clutchGrip,
    massKg: base.mass + 75, // + rider
    cdA: base.cdA,
    crr: 0.015,
    plugFoulRateMult: bike.parts["spark-plug"] === "plug-ngk-b7hs" && !kitted ? 1.6 : 1,
    exhaustVisual: exhaust?.visualTag ?? "stock",
    cylinderVisual: cylinder?.visualTag ?? "stock",
    airFilterVisual: airFilter?.visualTag ?? "stock",
    drivetrain: DRIVETRAIN_BY_MAKE[bike.make] ?? "single",
    airFilterRichen: airFilterRichenFor(bike.wear.airFilterDirt),
    effects: getFaultEffects(bike),
  };
}

// ── MIXTURE ────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export interface MixtureInputs {
  mainJet: number;
  needleClip: number;
  idleScrew: number;
  throttle: number;
  choke: boolean;
  chtC: number;
}

/**
 * Air/fuel richness relative to ideal (1.0 = perfect, >1 rich, <1 lean)
 * BEFORE any float-bowl starvation.
 *  - Main jet circuit dominates above ~60% throttle: fuel ∝ jet area (size²).
 *  - Needle circuit at part throttle (clip position + some main-jet bleed).
 *  - Idle circuit at closed throttle (air screw turns out = leaner).
 *  - Unmetered air from an intake leak scales with manifold vacuum.
 */
export function computeMixture(profile: BikeProfile, m: MixtureInputs): number {
  const mainMix = (m.mainJet / profile.idealJet) ** 2;
  const needleMix = 1 + (m.needleClip - 3) * 0.06 + (mainMix - 1) * 0.55;
  const idleMix = 1 + (1.5 - m.idleScrew) * 0.12;
  const thr = clamp(m.throttle, 0, 1);
  let mix = lerp(idleMix, needleMix, smoothstep(0.02, 0.3, thr));
  mix = lerp(mix, mainMix, smoothstep(0.4, 0.9, thr));

  // Intake air leak: idle vacuum pulls in extra air.
  const vacuum = 1 - thr;
  mix /= 1 + profile.effects.airLeak * (0.42 * vacuum + 0.07);

  // Dusty air filter restricts airflow → richer across the board.
  mix *= profile.airFilterRichen;

  // Cold engine: fuel doesn't atomize well (needs choke).
  if (m.chtC < 40) mix *= 0.92;
  if (m.choke) mix *= 1.45;
  return mix;
}

// ── TORQUE CURVE ───────────────────────────────────────────────────────────

/** Normalized torque shape (≈1 at peak) incl. pipe powerband. */
export function torqueShape(profile: BikeProfile, rpm: number): {
  shape: number;
  bandFrac: number;
} {
  const x = rpm / profile.maxRpm;
  let shape = Math.exp(-(((x - 0.6) / 0.44) ** 2));
  // Powerband: expansion chamber resonance
  const bandFrac = Math.exp(-(((rpm - profile.powerbandRpm) / profile.powerbandWidth) ** 2));
  shape += profile.powerbandKick * bandFrac;
  // Race pipes are soggy below the band
  if (profile.belowBandBog > 0) {
    const below = smoothstep(profile.powerbandRpm - 1200, profile.powerbandRpm - 3500, rpm);
    shape *= 1 - profile.belowBandBog * below;
  }
  // Over-rev: falls off a cliff past max rpm
  if (rpm > profile.maxRpm) {
    shape *= clamp(1 - (rpm - profile.maxRpm) / (profile.maxRpm * 0.06), 0, 1);
  }
  return { shape: Math.max(0, shape), bandFrac };
}

/** Combustion efficiency vs mixture. Slightly lean = max power (but hot). */
export function combustionEfficiency(mix: number): number {
  if (mix >= 1.02) return clamp(1 - 0.5 * (mix - 1.02) - 0.4 * (mix - 1.02) ** 2, 0.3, 1);
  if (mix >= 0.9) return 1;
  return clamp(1 - 3.4 * (0.9 - mix) ** 2 - 0.4 * (0.9 - mix), 0.2, 1);
}

// ── PLUG COLOR ─────────────────────────────────────────────────────────────

export function plugColorFor(args: {
  mixture: number;
  plugFoul: number;
  sparkStrength: number;
  premix: boolean;
  maxChtC: number;
}): PlugColor {
  if (args.sparkStrength <= 0.01) return "black-wet"; // raw fuel soaks it
  if (args.plugFoul >= 0.55) return "oily-fouled";
  if (!args.premix) return "dry-clean"; // no oil residue at all — eerily clean
  const m = args.mixture;
  if (m >= 1.16) return "black-wet";
  if (m >= 1.07) return "black-sooty";
  if (m >= 0.93) return args.sparkStrength < 0.7 ? "black-sooty" : "tan-ideal";
  if (m >= 0.84) return args.maxChtC > 215 ? "white-blistered" : "white-lean";
  return "white-blistered";
}

/** Steady-state wide-open-throttle mixture incl. fuel starvation (garage estimate). */
export function steadyWotMixture(bike: OwnedBike, profile = buildBikeProfile(bike)): number {
  let mix = computeMixture(profile, {
    mainJet: bike.tuning.mainJet,
    needleClip: bike.tuning.needleClip,
    idleScrew: bike.tuning.idleScrew,
    throttle: 1,
    choke: false,
    chtC: 120,
  });
  const supply = profile.fuelSupply * profile.effects.fuelFlowMult;
  const demand = fuelDemand(profile, 1, 0.9, mix);
  if (supply < demand) mix *= clamp(supply / demand + 0.25, 0.55, 1);
  return mix;
}

/** What the plug would look like after a proper WOT run on this setup. */
export function predictPlugColor(bike: OwnedBike): PlugColor {
  const profile = buildBikeProfile(bike);
  const e = profile.effects;
  return plugColorFor({
    mixture: steadyWotMixture(bike, profile),
    plugFoul: e.plugFoul,
    sparkStrength: e.sparkStrength,
    premix: e.premix,
    maxChtC: 150,
  });
}

function fuelDemand(profile: BikeProfile, throttle: number, rpmFrac: number, mix: number): number {
  return 0.08 + 1.15 * throttle * clamp(rpmFrac, 0, 1.1) * Math.min(mix, 1.3) * profile.airflowMult;
}

// ── ENGINE STATE ───────────────────────────────────────────────────────────

export type { StallReason };

export interface EngineState {
  running: boolean;
  rpm: number;
  chtC: number;
  mixture: number;
  /** Load-weighted mixture memory → what the plug "reads". */
  plugMixtureEma: number;
  plugLoadSec: number;
  fuelBowlPct: number;
  powerbandActive: boolean;
  misfirePattern: MisfirePattern;
  misfireRate: number;
  misfireAccum: number;
  smokeDensity: number;
  smokeTint: SmokeTint;
  leanTone: number;
  detonationPulse: boolean;
  clutchSlip: number;
  pistonKnock: number;
  compressionFeel: "strong" | "weak";

  stalled: boolean;
  stallReason: StallReason;
  seizeRisk: number;
  seizeWarning: boolean;
  seizeActive: boolean;
  seizeWindowMs: number;
  seizedHard: boolean;
  seizeSavedPending: boolean;
  /** Plug got soaked by kicking with no spark. */
  plugWetFromKicks: boolean;

  plugChopHoldSec: number;
  plugChopColor: PlugColor | null;

  /** Output: tractive force at the rear wheel (N). Negative = engine braking / lock. */
  driveForceN: number;
  wheelLocked: boolean;
  /** Oscillator phase for air-leak idle hunting (deterministic, no wall clock). */
  huntPhase: number;

  // Drivetrain
  /** Active gear (always 1 except the Tomos A35 2-speed in 2nd). */
  currentGear: 1 | 2;
  /** True only on the step the 2-speed changed gear. */
  gearShiftPulse: boolean;
  /** Effective drive ratio (× RPM_PER_MPS) — fixed, gear, or variator position. */
  gearRatio: number;
  /** Remaining seconds of the post-upshift torque kick. */
  shiftKickSec: number;

  // Ride stats
  maxChtC: number;
  detonations: number;
  richSec: number;
  idleSec: number;
  slipSec: number;
  hotSec: number;
  wotSec: number;
  seizesSaved: number;
  seizeCrashes: number;
  plugFoulGain: number;
}

export function createEngineState(profile: BikeProfile, ambientC = AMBIENT_C): EngineState {
  return {
    running: false,
    rpm: 0,
    chtC: ambientC + 5,
    mixture: 1,
    plugMixtureEma: 1,
    plugLoadSec: 0,
    fuelBowlPct: 100,
    powerbandActive: false,
    misfirePattern: "none",
    misfireRate: 0,
    misfireAccum: 0,
    smokeDensity: 0,
    smokeTint: "clear",
    leanTone: 0,
    detonationPulse: false,
    clutchSlip: 0,
    pistonKnock: 0,
    compressionFeel: profile.effects.compression < 0.8 ? "weak" : "strong",
    stalled: false,
    stallReason: "none",
    seizeRisk: 0,
    seizeWarning: false,
    seizeActive: false,
    seizeWindowMs: 0,
    seizedHard: false,
    seizeSavedPending: false,
    plugWetFromKicks: false,
    plugChopHoldSec: 0,
    plugChopColor: null,
    driveForceN: 0,
    wheelLocked: false,
    huntPhase: 0,
    currentGear: 1,
    gearShiftPulse: false,
    gearRatio: initialGearRatio(profile),
    shiftKickSec: 0,
    maxChtC: ambientC + 5,
    detonations: 0,
    richSec: 0,
    idleSec: 0,
    slipSec: 0,
    hotSec: 0,
    wotSec: 0,
    seizesSaved: 0,
    seizeCrashes: 0,
    plugFoulGain: 0,
  };
}

function initialGearRatio(profile: BikeProfile): number {
  if (profile.drivetrain === "cvt") return CVT_LOW_RATIO;
  if (profile.drivetrain === "two-speed") return TWO_SPEED_RATIOS[1];
  return 1;
}

/**
 * Advance the drivetrain: Tomos 2-speed shift logic (with hysteresis) or the
 * variator sliding to hold the pipe. Mutates `s`; emits gear-shift events.
 */
function updateDrivetrain(
  s: EngineState,
  profile: BikeProfile,
  throttle: number,
  speed: number,
  dt: number,
  events: SimEvent[],
): void {
  s.shiftKickSec = Math.max(0, s.shiftKickSec - dt);
  switch (profile.drivetrain) {
    case "two-speed": {
      if (s.currentGear === 1 && speed >= TWO_SPEED_UPSHIFT_MPS && s.running) {
        s.currentGear = 2;
        // Revs drop as the taller gear catches.
        s.rpm *= TWO_SPEED_RATIOS[2] / TWO_SPEED_RATIOS[1];
        s.gearShiftPulse = true;
        s.shiftKickSec = SHIFT_KICK_SEC;
        events.push({ type: "gear-shift", gear: 2 });
      } else if (s.currentGear === 2 && speed <= TWO_SPEED_DOWNSHIFT_MPS) {
        s.currentGear = 1;
        if (s.running) {
          s.gearShiftPulse = true;
          events.push({ type: "gear-shift", gear: 1 });
        }
      }
      s.gearRatio = TWO_SPEED_RATIOS[s.currentGear];
      return;
    }
    case "cvt": {
      s.currentGear = 1;
      // Under load the variator holds the pipe; off-throttle it lets revs settle.
      const load = smoothstep(0.08, 0.8, throttle);
      const holdRpm = s.running ? lerp(profile.clutchEngageRpm + 300, profile.powerbandRpm, load) : 0;
      const baseRpm = speed * RPM_PER_MPS;
      const target =
        !s.running || baseRpm < 1 ? CVT_LOW_RATIO : clamp(holdRpm / baseRpm, CVT_HIGH_RATIO, CVT_LOW_RATIO);
      s.gearRatio = lerp(s.gearRatio, target, clamp(dt * 3, 0, 1));
      return;
    }
    default:
      s.currentGear = 1;
      s.gearRatio = 1;
  }
}

export interface EngineInput {
  throttle: number;
  choke: boolean;
  clutch: boolean;
  /** Kill switch held during the ride (plug chop at WOT). */
  killSwitch: boolean;
  kickstart: boolean;
}

export interface EngineEnv {
  speedMps: number;
  ambientC?: number;
}

export interface EngineTuning {
  mainJet: number;
  needleClip: number;
  idleScrew: number;
}

function stall(s: EngineState, reason: StallReason, events: SimEvent[]): void {
  if (!s.running) return;
  s.running = false;
  s.stalled = true;
  s.stallReason = reason;
  s.powerbandActive = false;
  events.push({ type: "stalled", reason: reason === "none" ? "idle" : reason });
}

/** Current effective spark (0..1) including CDI/plug bonuses. */
export function effectiveSpark(profile: BikeProfile): number {
  const e = profile.effects;
  if (e.killSwitchOn || e.sparkStrength <= 0) return 0;
  return clamp(e.sparkStrength + profile.sparkBonus * 0.5, 0, 1.2);
}

/** Attempt a kickstart. Mutates state, pushes events. Returns success. */
export function attemptKickstart(
  s: EngineState,
  profile: BikeProfile,
  tuning: EngineTuning,
  choke: boolean,
  rng: Rng,
  events: SimEvent[],
  killSwitchHeld = false,
): boolean {
  if (s.running || s.seizedHard) return false;
  const e = profile.effects;
  const compressionFeel: "strong" | "weak" = e.compression < 0.8 ? "weak" : "strong";
  s.compressionFeel = compressionFeel;
  const spark = killSwitchHeld ? 0 : effectiveSpark(profile);

  let p = 0.9;
  if (spark <= 0) p = 0;
  else p *= clamp(0.35 + spark * 0.65, 0, 1);
  p *= 1 - e.plugFoul * 0.6;
  p *= clamp((e.compression - 0.45) / 0.45, 0.2, 1);
  if (s.fuelBowlPct < 8) p *= 0.05;
  const cold = s.chtC < 40;
  const mix = computeMixture(profile, { ...tuning, throttle: 0.05, choke, chtC: s.chtC });
  if (cold && !choke && mix < 1.05) p *= 0.55;
  if (choke && !cold) p *= 0.75; // flooding a warm engine
  if (mix > 1.7) p *= 0.5;
  if (s.seizeSavedPending && s.chtC > SEIZE_RESTART_CHT_C) p = 0;

  const started = p > 0 && rng() < p;
  events.push({ type: "kickstart", started, compressionFeel });
  if (started) {
    s.running = true;
    s.stalled = false;
    s.stallReason = "none";
    s.rpm = profile.idleRpm + 700;
    s.plugChopColor = null;
    s.seizeSavedPending = false;
    s.seizeRisk = Math.min(s.seizeRisk, 0.3);
  } else {
    if (spark <= 0) {
      s.plugWetFromKicks = true;
      s.stallReason = "spark";
    } else if (s.fuelBowlPct < 8) {
      s.stallReason = "fuel";
    } else if (s.stallReason === "none" && !s.seizeSavedPending) {
      s.stallReason = "idle";
    }
    s.stalled = true;
  }
  return started;
}

/**
 * Advance the engine by `dt` seconds. Mutates `s`; pushes SimEvents.
 */
export function stepEngine(
  s: EngineState,
  profile: BikeProfile,
  tuning: EngineTuning,
  input: EngineInput,
  env: EngineEnv,
  dt: number,
  rng: Rng,
  events: SimEvent[],
): void {
  const e = profile.effects;
  const ambient = env.ambientC ?? AMBIENT_C;
  const speed = Math.max(0, env.speedMps);
  s.detonationPulse = false;
  s.gearShiftPulse = false;
  s.driveForceN = 0;
  updateDrivetrain(s, profile, clamp(input.throttle, 0, 1), speed, dt, events);
  const ratio = s.gearRatio;
  const wheelRpm = speed * RPM_PER_MPS * ratio;

  // ── Seize reaction window ──
  if (s.seizeActive) {
    s.seizeWindowMs -= dt * 1000;
    if (input.clutch) {
      s.seizeActive = false;
      s.seizeWindowMs = 0;
      s.seizeWarning = false;
      s.seizesSaved += 1;
      s.seizeSavedPending = true;
      s.seizeRisk = 0.35;
      s.running = false;
      s.stalled = true;
      s.stallReason = "none";
      s.powerbandActive = false;
      events.push({ type: "seize-saved" });
    } else if (s.seizeWindowMs <= 0) {
      s.seizeActive = false;
      s.seizeWindowMs = 0;
      s.seizeWarning = false;
      s.seizedHard = true;
      s.seizeCrashes += 1;
      s.running = false;
      s.stalled = true;
      s.stallReason = "none";
      s.powerbandActive = false;
      events.push({ type: "seize-crash" });
    } else {
      // Piston grabbing: heavy drag through the drivetrain
      s.driveForceN = -260;
      s.rpm = Math.max(0, s.rpm - 9000 * dt);
      s.pistonKnock = 1;
      return;
    }
  }

  s.wheelLocked = s.seizedHard && speed > 0.05;
  if (s.wheelLocked) s.driveForceN = -900; // rear wheel skidding

  // ── Kickstart ──
  if (input.kickstart && !s.running && !s.seizedHard) {
    attemptKickstart(s, profile, tuning, input.choke, rng, events, input.killSwitch);
  }

  // ── Engine off ──
  if (!s.running) {
    s.rpm = Math.max(0, s.rpm - 6000 * dt);
    coolOnly(s, profile, speed, ambient, dt);
    s.powerbandActive = false;
    s.misfirePattern = s.stalled || s.seizedHard ? "dead" : "none";
    s.misfireRate = s.stalled ? 1 : 0;
    s.smokeDensity = Math.max(0, s.smokeDensity - dt * 1.5);
    s.smokeTint = s.smokeDensity > 0.05 ? s.smokeTint : "clear";
    s.leanTone = 0;
    s.clutchSlip = 0;
    s.pistonKnock = s.seizedHard ? 0 : Math.max(0, s.pistonKnock - dt);
    // Bowl refills while sitting
    s.fuelBowlPct = clamp(s.fuelBowlPct + profile.fuelSupply * e.fuelFlowMult * 10 * dt, 0, 100);
    return;
  }

  const thr = clamp(input.throttle, 0, 1);
  const spark = effectiveSpark(profile);

  // ── Kill switch held: plug chop at WOT (or just a dead engine below it) ──
  if (input.killSwitch || spark <= 0) {
    if (input.killSwitch && thr >= 0.75) {
      s.plugChopHoldSec += dt;
    }
    const chopColor = plugColorFor({
      mixture: s.plugLoadSec > 0.5 ? (s.plugMixtureEma + s.mixture) / 2 : s.mixture,
      plugFoul: e.plugFoul,
      sparkStrength: spark > 0 ? spark : 1, // spark was present until we cut it
      premix: e.premix,
      maxChtC: s.maxChtC,
    });
    if (input.killSwitch && thr >= 0.75) {
      s.plugChopColor = chopColor;
      stall(s, "plug-chop", events);
    } else if (input.killSwitch) {
      // Not wide open: the engine just dies — no clean plug read.
      stall(s, "kill-switch", events);
    } else {
      stall(s, "spark", events);
    }
    return;
  }

  // ── Mixture & float bowl ──
  const baseMix = computeMixture(profile, {
    mainJet: tuning.mainJet,
    needleClip: tuning.needleClip,
    idleScrew: tuning.idleScrew,
    throttle: thr,
    choke: input.choke,
    chtC: s.chtC,
  });
  const rpmFrac = s.rpm / profile.maxRpm;
  const demand = fuelDemand(profile, thr, rpmFrac, baseMix);
  const supply = profile.fuelSupply * e.fuelFlowMult;
  s.fuelBowlPct = clamp(s.fuelBowlPct + (supply - demand) * 16 * dt, 0, 100);
  let mix = baseMix;
  if (s.fuelBowlPct < 40) mix *= 0.35 + (s.fuelBowlPct / 40) * 0.65;
  s.mixture = mix;
  if (s.fuelBowlPct < 3) {
    stall(s, "fuel", events);
    return;
  }

  // Plug reads the mixture under load
  if (thr > 0.5) {
    const w = clamp(dt * 0.6 * thr, 0, 1);
    s.plugMixtureEma = lerp(s.plugMixtureEma, mix, s.plugLoadSec < 0.3 ? 1 : w);
    s.plugLoadSec += dt;
  }

  // ── Misfire ──
  const eff = combustionEfficiency(mix);
  const highRpmMiss = spark < 0.95 ? clamp((rpmFrac - 0.5) * (1.05 - spark) * 2.4, 0, 0.75) : 0;
  // A properly fouled plug (>0.5) stutters at random; light sooting barely registers.
  const foulMiss = e.plugFoul > 0.5 ? clamp(e.plugFoul * 0.55 * (thr < 0.1 ? 1.3 : 1), 0, 0.7) : e.plugFoul * 0.1;
  const richMiss = mix > 1.14 && thr > 0.2 ? clamp((mix - 1.1) * 1.3, 0, 0.55) : 0;
  const starveMiss = s.fuelBowlPct < 30 ? clamp((30 - s.fuelBowlPct) / 30, 0, 0.9) : 0;
  const leanMiss = mix < 0.74 ? clamp((0.74 - mix) * 2.5, 0, 0.5) : 0;

  const candidates: { p: MisfirePattern; r: number; prio: number }[] = [
    { p: "high-rpm", r: highRpmMiss, prio: 4 },
    { p: "random", r: Math.max(foulMiss, starveMiss, leanMiss), prio: 3 },
    { p: "alternate", r: richMiss, prio: 2 },
  ];
  let best: { p: MisfirePattern; r: number; prio: number } = { p: "none", r: 0, prio: 0 };
  for (const c of candidates) {
    if (c.r < 0.04) continue;
    if (c.r > best.r + 0.02 || (Math.abs(c.r - best.r) <= 0.02 && c.prio > best.prio)) best = c;
  }
  s.misfirePattern = best.p;
  s.misfireRate = clamp(Math.max(highRpmMiss, foulMiss, richMiss, starveMiss, leanMiss), 0, 1);
  if (best.p === "none") s.misfireRate = Math.min(s.misfireRate, 0.03);

  // ── Torque ──
  const { shape, bandFrac } = torqueShape(profile, s.rpm);
  const compression = clamp(e.compression + profile.compressionBonus, 0.4, 1.15);
  const thrCurve = thr <= 0 ? 0 : 0.12 + 0.88 * Math.pow(thr, 0.85);
  // Four-stroking (alternate) only skips some cycles; random/high-rpm misses hurt more.
  const missPenalty = s.misfirePattern === "alternate" ? 0.65 : 0.85;
  const combustion = eff * (1 - s.misfireRate * missPenalty) * compression;
  // Tomos snapping into 2nd: a short, crisp shove.
  const shiftKick = s.shiftKickSec > 0 ? 1 + 0.18 * (s.shiftKickSec / SHIFT_KICK_SEC) : 1;
  const torque = profile.peakTorqueNm * shape * thrCurve * combustion * shiftKick;

  // ── RPM & clutch coupling ──
  const idleBoost = e.airLeak * 1300 * (1 - thr); // lean leak → high hunting idle
  // Idle air screw: more turns out = leaner idle = higher idle speed (no-op at 1.5).
  const screwRpm = clamp((tuning.idleScrew - 1.5) * 320, -420, 480) * (1 - thr);
  const idleTarget = profile.idleRpm + idleBoost + screwRpm + (input.choke ? 500 : 0);
  const freeTarget = idleTarget + thr * (profile.maxRpm * 1.04 - idleTarget) * clamp(combustion * 1.1, 0.3, 1);
  const stallRpm = profile.clutchEngageRpm + 1000 * thr; // centrifugal clutch "stall speed"
  const engaged = !input.clutch && (s.rpm > profile.clutchEngageRpm - 300 || wheelRpm > profile.clutchEngageRpm);

  // Clutch torque capacity
  const grip = e.clutchGrip * profile.clutchGrip;
  const capacityNm = profile.peakTorqueNm * 1.25 * grip;
  let slipFrac = 0;
  let transmitted = torque;
  if (engaged && torque > capacityNm) {
    slipFrac = clamp((torque - capacityNm) / torque, 0, 1);
    transmitted = capacityNm;
  }

  let targetRpm: number;
  if (!engaged) {
    targetRpm = freeTarget;
  } else if (wheelRpm < Math.min(stallRpm, freeTarget)) {
    // Clutch slipping by design at low speed (launch)
    targetRpm = Math.max(wheelRpm, Math.min(freeTarget, stallRpm));
  } else {
    targetRpm = wheelRpm * (1 + slipFrac * 0.45);
  }
  if (thr < 0.05 && wheelRpm < profile.clutchEngageRpm) targetRpm = Math.max(targetRpm, idleTarget);
  const rpmRate = engaged ? 9 : 6;
  s.rpm = lerp(s.rpm, Math.max(0, targetRpm), clamp(dt * rpmRate, 0, 1));
  // Idle hunting with an air leak
  if (e.airLeak > 0.3 && thr < 0.1) {
    s.huntPhase += dt;
    s.rpm += Math.sin(s.huntPhase * 2.4) * e.airLeak * 220 * dt * 6;
  }

  s.clutchSlip = engaged ? clamp(slipFrac * 1.6, 0, 1) : 0;
  if (engaged) {
    if (thr > 0.02) {
      s.driveForceN = transmitted * FORCE_PER_NM * ratio;
    } else if (wheelRpm > profile.clutchEngageRpm) {
      s.driveForceN = -18 * (wheelRpm / profile.maxRpm) * compression; // engine braking
    }
  }

  // Powerband
  s.powerbandActive = thr > 0.6 && profile.powerbandKick >= 0.25 && bandFrac > 0.55 && engaged;

  // ── Thermal ──
  const powerFrac = clamp((torque / profile.peakTorqueNm) * (s.rpm / profile.maxRpm), 0, 1.4);
  // Free-revving with the clutch out of the loop (center stand, lever pulled)
  // makes far less heat than pulling real load.
  let heat = 10 + 145 * powerFrac * (engaged ? 1 : 0.5);
  if (mix < 1) heat *= 1 + 2.2 * (1 - mix);
  else heat *= 1 - Math.min(0.3, (mix - 1) * 0.5);
  if (!e.premix) heat *= 1.12; // friction
  const k = (0.35 + 0.06 * speed) * profile.coolingMult;
  s.chtC += (heat - k * (s.chtC - ambient)) * 0.04 * dt;
  s.maxChtC = Math.max(s.maxChtC, s.chtC);

  // ── Detonation ──
  if (s.chtC > DETONATION_CHT_C && mix < 0.95 && thr > 0.45) {
    const rate = 1.5 + (s.chtC - DETONATION_CHT_C) * 0.15;
    if (chance(rng, rate * dt)) {
      s.detonationPulse = true;
      s.detonations += 1;
      s.chtC += 1.5;
      events.push({ type: "detonation" });
    }
  }

  // ── Seize hazard ──
  let riskRate = 0;
  if (s.chtC > SEIZE_CHT_C) riskRate += ((s.chtC - SEIZE_CHT_C) / 20) * 0.3 + 0.05;
  if (!e.premix) riskRate += 0.018 + 0.05 * thr * clamp(rpmFrac, 0, 1) + Math.max(0, (s.chtC - 110) / 100) * 0.03;
  if (riskRate > 0) s.seizeRisk += riskRate * dt;
  else if (s.chtC < 205) s.seizeRisk = Math.max(0, s.seizeRisk - 0.04 * dt);
  s.seizeRisk = clamp(s.seizeRisk, 0, 1);

  const wasWarning = s.seizeWarning;
  s.seizeWarning = s.seizeRisk >= 0.55;
  if (s.seizeWarning && !wasWarning) events.push({ type: "seize-warning" });
  if (s.seizeRisk >= 1 && !s.seizeActive) {
    events.push({ type: "seize-start" });
    if (input.clutch) {
      // Already had the clutch in — instant save.
      s.seizesSaved += 1;
      s.seizeSavedPending = true;
      s.seizeRisk = 0.35;
      s.seizeWarning = false;
      s.running = false;
      s.stalled = true;
      s.stallReason = "none";
      s.powerbandActive = false;
      events.push({ type: "seize-saved" });
      return;
    }
    s.seizeActive = true;
    s.seizeWindowMs = SEIZE_CLUTCH_WINDOW_MS;
  }

  // ── Idle stall ──
  if (thr < 0.05 && wheelRpm < profile.clutchEngageRpm) {
    s.idleSec += dt;
    const idleMix = mix;
    let stallRate = 0;
    stallRate += e.plugFoul > 0.5 ? 0.12 * e.plugFoul : 0;
    stallRate += idleMix > 1.45 ? 0.08 : 0;
    stallRate += idleMix < 0.62 ? 0.06 : 0;
    stallRate += spark < 0.5 ? 0.03 : 0;
    // Idle screw cranked way off its sweet spot starves or drowns the idle
    // circuit. Stable band 0.75–2.5 turns; the slider ends (0.5 / 3.0) stall.
    stallRate += Math.max(0, tuning.idleScrew - 2.5) * 0.8; // lean, starving idle
    stallRate += Math.max(0, 0.75 - tuning.idleScrew) * 1.0; // rich, drowning idle
    // Choke left on a warm engine floods it out.
    stallRate += input.choke && s.chtC > 45 ? 0.35 : 0;
    if (stallRate > 0 && chance(rng, stallRate * dt)) {
      stall(s, "idle", events);
      return;
    }
  }

  // ── Symptoms ──
  const load = 0.45 + 0.55 * thr;
  let density: number;
  let tint: SmokeTint;
  if (e.premix) {
    density = 0.1 + Math.max(0, mix - 1) * 1.25 + e.plugFoul * 0.18 + (1 - compression) * 0.25;
    if (input.choke) density += 0.2;
    density *= load;
    tint = mix > 1.14 && density > 0.3 ? "thick-blue-grey" : "light-blue";
  } else {
    density = 0.03 * load;
    tint = "clear";
  }
  if (s.chtC < 50 && (input.choke || ambient < 15)) {
    tint = "white-steam";
    density = Math.max(density, 0.25);
  }
  s.smokeDensity = lerp(s.smokeDensity, clamp(density, 0, 1), clamp(dt * 4, 0, 1));
  s.smokeTint = tint;
  s.leanTone = clamp((0.97 - mix) / 0.17, 0, 1) * (thr > 0.15 ? 1 : 0.5);
  s.pistonKnock = clamp(
    (1 - compression) * 2.2 * (0.4 + 0.6 * rpmFrac) +
      (s.seizeWarning ? 0.5 : 0) +
      (!e.premix ? s.seizeRisk * 0.5 : 0) +
      (s.detonationPulse ? 0.4 : 0),
    0,
    1,
  );
  s.compressionFeel = compression < 0.8 ? "weak" : "strong";

  // ── Stats ──
  if (mix > 1.12 && thr > 0.2) s.richSec += dt;
  if (slipFrac > 0.05) s.slipSec += dt;
  if (s.chtC > 200) s.hotSec += dt;
  if (thr > 0.9) s.wotSec += dt;
  const foulRate =
    (mix > 1.12 ? 0.05 : 0) + (thr < 0.05 ? 0.015 : 0) + (input.choke && s.chtC > 50 ? 0.05 : 0);
  s.plugFoulGain += foulRate * profile.plugFoulRateMult * dt;
}

function coolOnly(s: EngineState, profile: BikeProfile, speed: number, ambient: number, dt: number) {
  const k = (0.75 + 0.06 * speed) * profile.coolingMult;
  s.chtC += -k * (s.chtC - ambient) * 0.04 * dt;
}

/** Final plug read for the ride (or null if it never saw real load). */
export function rideEndPlugColor(s: EngineState, profile: BikeProfile): PlugColor | null {
  if (s.plugChopColor) return s.plugChopColor;
  const e = profile.effects;
  if (s.plugWetFromKicks && s.plugLoadSec < 1) return "black-wet";
  if (s.plugLoadSec < 2) return null;
  return plugColorFor({
    mixture: s.plugMixtureEma,
    plugFoul: e.plugFoul,
    sparkStrength: effectiveSpark(profile),
    premix: e.premix,
    maxChtC: s.maxChtC,
  });
}

// ── GARAGE STAND TEST ("Fire it up!" on the center stand) ──────────────────
//
// Same engine model as the road, but the rear wheel is in the air: clutch out
// of the loop (`clutch: true`) and zero road speed. Everything the player
// hears/sees is emergent: a leak hangs a hunting idle, the idle screw moves
// idle rpm (and stalls it when way off), choke helps a cold start and floods
// a warm one, and blipping the throttle shows rich four-stroking vs a lean
// rasp vs a crisp braap. The snapshot carries ZERO FaultIds.

export interface StandTestOptions {
  seed?: number;
  hasTach?: boolean;
  hasChtGauge?: boolean;
  hasStethoscope?: boolean;
  ambientC?: number;
}

export interface StandTestState {
  bike: OwnedBike;
  profile: BikeProfile;
  engine: EngineState;
  rng: Rng;
  opts: Required<Omit<StandTestOptions, "seed">> & { seed: number };
  input: StandTestInput;
  elapsedSec: number;
  captions: ComicCaption[];
  captionSeq: number;
  captionCooldowns: Record<string, number>;
  /** Number of kicks attempted this session (for flavor captions). */
  kicks: number;
}

export const NEUTRAL_STAND_INPUT: StandTestInput = {
  throttle: 0,
  choke: false,
  killSwitch: false,
  kickstartPulse: false,
};

export function createStandTest(bike: OwnedBike, opts: StandTestOptions = {}): StandTestState {
  const profile = buildBikeProfile(bike);
  const ambientC = opts.ambientC ?? AMBIENT_C;
  const seed = (opts.seed ?? 0x5eed57a1) >>> 0;
  return {
    bike,
    profile,
    engine: createEngineState(profile, ambientC),
    rng: mulberry32(seed),
    opts: {
      seed,
      hasTach: opts.hasTach ?? false,
      hasChtGauge: opts.hasChtGauge ?? false,
      hasStethoscope: opts.hasStethoscope ?? false,
      ambientC,
    },
    input: { ...NEUTRAL_STAND_INPUT },
    elapsedSec: 0,
    captions: [],
    captionSeq: 1,
    captionCooldowns: {},
    kicks: 0,
  };
}

/** Rebuild the profile after a garage change (idle screw, kill switch, parts…). */
export function refreshStandBike(state: StandTestState, bike: OwnedBike): void {
  state.bike = bike;
  state.profile = buildBikeProfile(bike);
}

function standCaption(
  state: StandTestState,
  events: SimEvent[],
  text: string,
  tone: ComicCaption["tone"],
  key: string,
  cooldownSec = 6,
): void {
  const until = state.captionCooldowns[key] ?? -1;
  if (state.elapsedSec < until) return;
  state.captionCooldowns[key] = state.elapsedSec + cooldownSec;
  const ttlMs = 2600;
  state.captions.push({ id: state.captionSeq++, text, tone, ttlMs, maxTtlMs: ttlMs });
  if (state.captions.length > 4) state.captions.shift();
  events.push({ type: "caption", text, tone });
}

/**
 * Advance the stand test by `dt` seconds. Consumes `input.kickstartPulse`.
 * Returns the standard SimEvents emitted this step.
 */
export function stepStandTest(state: StandTestState, input: StandTestInput, dt: number): SimEvent[] {
  const events: SimEvent[] = [];
  const eng = state.engine;
  const { profile, rng } = state;
  const tuning = state.bike.tuning;
  state.elapsedSec += dt;
  state.input = { ...input, kickstartPulse: false };

  for (const c of state.captions) c.ttlMs -= dt * 1000;
  state.captions = state.captions.filter((c) => c.ttlMs > 0);

  if (input.kickstartPulse && !eng.running && !eng.seizedHard) {
    state.kicks += 1;
    const started = attemptKickstart(eng, profile, tuning, input.choke, rng, events, input.killSwitch);
    if (started) {
      standCaption(state, events, "It catches! Braaap on the stand.", "gold", "stand-start", 8);
    } else if (eng.seizeSavedPending && eng.chtC > SEIZE_RESTART_CHT_C) {
      standCaption(state, events, "Cylinder's still scorching — let it cool.", "orange", "stand-hot", 4);
    } else if (input.killSwitch || profile.effects.killSwitchOn) {
      standCaption(state, events, "Kick, kick… not even a pop. Check the kill switch.", "orange", "stand-kill", 5);
    } else if (eng.fuelBowlPct < 8) {
      standCaption(state, events, "Kicking dry — the bowl's empty.", "orange", "stand-dry", 5);
    } else if (state.kicks >= 3) {
      standCaption(
        state,
        events,
        eng.chtC < 40 ? "Won't catch cold… try the choke." : "Kick, kick… nothing. Hmm.",
        "white",
        "stand-fail",
        5,
      );
    }
  }

  const wasRunning = eng.running;
  stepEngine(
    eng,
    profile,
    tuning,
    {
      throttle: clamp(input.throttle, 0, 1),
      choke: input.choke,
      clutch: true, // rear wheel in the air: no load through the clutch
      killSwitch: input.killSwitch,
      kickstart: false,
    },
    { speedMps: 0, ambientC: state.opts.ambientC },
    dt,
    rng,
    events,
  );
  if (wasRunning && !eng.running && eng.stallReason === "idle" && input.choke && eng.chtC > 45) {
    standCaption(state, events, "Choke on a warm engine — it flooded out.", "orange", "stand-flood", 6);
  }
  return events;
}

/** Observable-only telemetry for the workbench (same shape as a ride snapshot). */
export function buildStandSnapshot(state: StandTestState): RideTelemetrySnapshot {
  const eng = state.engine;
  const p = state.profile;
  const input = state.input;
  return {
    active: true,
    routeId: "telegraph-coffee",
    routeName: "Garage Stand Test",
    timeOfDay: "golden",
    bikeMake: state.bike.make,
    bikeColorHex: state.bike.colorHex,
    bikeAccentHex: state.bike.accentHex,
    exhaustVisual: p.exhaustVisual,
    cylinderVisual: p.cylinderVisual,
    airFilterVisual: p.airFilterVisual,
    distanceM: 0,
    routeLengthM: 0,
    speedMph: 0,
    gradePct: 0,
    landmark: null,
    atStoplight: false,
    stoplightRedSec: 0,
    nextStoplightM: null,
    nextStoplightState: null,
    upcomingPotholesM: [],
    nextPotholeM: null,
    throttle: input.throttle,
    brake: false,
    tuck: false,
    choke: input.choke,
    clutchPulled: true,
    pedaling: false,
    stamina: 100,
    engineRunning: eng.running,
    rpm: eng.rpm,
    maxRpm: p.maxRpm,
    hasTach: state.opts.hasTach,
    hasChtGauge: state.opts.hasChtGauge,
    hasStethoscope: state.opts.hasStethoscope,
    listenMode: false,
    chtC: eng.chtC,
    powerbandActive: false,
    fuelBowlPct: eng.fuelBowlPct,
    smoke: { density: eng.smokeDensity, tint: eng.smokeTint },
    misfirePattern: eng.misfirePattern,
    misfireRate: eng.misfireRate,
    leanTone: eng.leanTone,
    detonationPulse: eng.detonationPulse,
    clutchSlip: 0,
    pistonKnock: eng.pistonKnock,
    compressionFeel: eng.compressionFeel,
    stalled: eng.stalled,
    stallReason: eng.stallReason,
    seizeWarning: eng.seizeWarning,
    seizeActive: eng.seizeActive,
    seizeClutchWindowMs: eng.seizeActive ? Math.max(0, eng.seizeWindowMs) : 0,
    seizedHard: eng.seizedHard,
    seizeCooldownHot: eng.seizeSavedPending && eng.chtC > SEIZE_RESTART_CHT_C,
    currentGear: eng.currentGear,
    gearShiftPulse: eng.gearShiftPulse,
    pedalingHome: false,
    pedalHomeRemainingM: 0,
    coffeeTempPct: null,
    coffeeSpillPct: null,
    elapsedSec: state.elapsedSec,
    captions: state.captions.map((c) => ({ ...c })),
  };
}
