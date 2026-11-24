// Hidden fault model for Ran When Parked.
//
// Single source of truth per fault:
//  • rich-jet / lean-jet  → derived from tuning (mainJet + needle clip vs ideal).
//    Physics reads the tuning directly; the fault flag is only a label that
//    appears/clears as the jetting crosses the ±6 / ±4 bands.
//  • no-premix            → derived from tuning.hasPremixOil.
//  • no-spark             → explicit, or emergent while tuning.killSwitchOn.
//  • weak-spark           → explicit only.
//  • wear-type faults     → tied to a wear field threshold. Every fix resets
//    that wear field so the reconcile pass can't re-raise it.
//
// NOTHING in this module's player-facing strings mentions raw FaultIds.

import { type Rng, chance, pickWeighted } from "../core/rng";
import type { ActiveFault, FaultId, OwnedBike, PartSpec } from "../contract";
import { getIdealJetForBike } from "../economy/catalog";

export type WearKey = keyof OwnedBike["wear"];

export interface FaultDefinition {
  id: FaultId;
  /** Internal dev label (never shown to players while the fault is active). */
  devLabel: string;
  /** Wear field that drives/raises this fault, if any. */
  wearKey?: WearKey;
  /** Wear level at/above which the fault emerges. */
  wearThreshold?: number;
  /** Journal entry written when the player fixes it (diegetic, post-fix). */
  fixedTitle: string;
  fixedBody: string;
  /** Plain-English hint of what the fault feels like (used in tests/docs). */
  symptomSummary: string;
}

export const FAULT_DEFS: Record<FaultId, FaultDefinition> = {
  "rich-jet": {
    id: "rich-jet",
    devLabel: "Main jet too big",
    fixedTitle: "Jetting dialed in",
    fixedBody:
      "Dropped the main jet down to where it belongs. The blub-blub four-stroking and the blue fog should be gone — crisp two-stroke braap.",
    symptomSummary:
      "Four-strokes (blub-blub) under load, thick blue-grey smoke, wet black plug, sluggish.",
  },
  "lean-jet": {
    id: "lean-jet",
    devLabel: "Main jet too small",
    fixedTitle: "Fattened up the jetting",
    fixedBody:
      "Went up on the main jet. It should run cooler now — no more thin, screaming exhaust note or pinging on hills.",
    symptomSummary:
      "Thin bright exhaust note, runs hot, pings on hills, white plug — seize risk.",
  },
  "air-leak": {
    id: "air-leak",
    devLabel: "Intake air leak",
    wearKey: "gasketWear",
    wearThreshold: 70,
    fixedTitle: "Sealed up the intake",
    fixedBody:
      "Fresh intake gasket in. The idle should settle down instead of hanging high and hunting.",
    symptomSummary:
      "High, hunting idle; lean at low throttle; carb-spray test makes rpm jump.",
  },
  "fouled-plug": {
    id: "fouled-plug",
    devLabel: "Fouled spark plug",
    wearKey: "plugFouling",
    wearThreshold: 70,
    fixedTitle: "Fresh plug",
    fixedBody:
      "Tossed the oily old plug. No more random stutter and dying at stoplights.",
    symptomSummary:
      "Random stutter/misfire, hard starting, dies at idle, oily wet plug.",
  },
  "weak-spark": {
    id: "weak-spark",
    devLabel: "Weak ignition",
    fixedTitle: "Spark's back",
    fixedBody:
      "The spark should be fat and blue again. That high-rpm breakup ought to be gone.",
    symptomSummary:
      "Breaks up / misfires at high rpm, weak orange spark on the tester.",
  },
  "no-spark": {
    id: "no-spark",
    devLabel: "No spark",
    fixedTitle: "We have ignition",
    fixedBody: "There's spark at the plug again. It should kick to life now.",
    symptomSummary: "Won't start at all; plug comes out fuel-soaked; tester shows nothing.",
  },
  "clogged-fuel": {
    id: "clogged-fuel",
    devLabel: "Clogged fuel delivery",
    wearKey: "fuelFilterClog",
    wearThreshold: 70,
    fixedTitle: "Fuel's flowing",
    fixedBody:
      "Fuel flows freely again. It shouldn't sputter and die once the float bowl drains under load.",
    symptomSummary:
      "Runs fine briefly then sputters/dies under load; trickle at the fuel line.",
  },
  "low-compression": {
    id: "low-compression",
    devLabel: "Low compression (scored top end)",
    wearKey: "pistonScore",
    wearThreshold: 55,
    fixedTitle: "Fresh top end",
    fixedBody:
      "New cylinder and piston. The kickstart should push back hard again, and the knock is gone.",
    symptomSummary:
      "Kickstart feels mushy, low power, piston knock in Listen Mode, low psi reading.",
  },
  "clutch-slip": {
    id: "clutch-slip",
    devLabel: "Slipping clutch",
    wearKey: "clutchWear",
    wearThreshold: 75,
    fixedTitle: "Clutch hooks up",
    fixedBody:
      "Fresh clutch. Revs and road speed should rise together now instead of the engine flaring on hills.",
    symptomSummary:
      "Revs flare but speed doesn't follow, especially on hills; glazed shoes.",
  },
  "no-premix": {
    id: "no-premix",
    devLabel: "No 2-stroke oil in the fuel",
    fixedTitle: "Premix in the tank",
    fixedBody:
      "Mixed in 2-stroke oil at 50:1. The top end has lubrication again — that dry, tight feeling should be gone.",
    symptomSummary:
      "Almost no exhaust smoke, dry plug, runs hot and tight, then seizes.",
  },
};

export const ALL_FAULT_IDS: FaultId[] = Object.keys(FAULT_DEFS) as FaultId[];

/** Jet bands: >= RICH/LEAN_RAISE sizes off raises the fault, <= CLEAR clears it. */
export const JET_FAULT_RAISE = 6;
export const JET_FAULT_CLEAR = 4;
/** Each needle clip step is worth ~2 jet sizes of mid-throttle richness. */
export const NEEDLE_CLIP_JET_EQUIV = 2;

/** Positive = rich, negative = lean (in jet sizes). */
export function getJetDeviation(bike: OwnedBike): number {
  return (
    bike.tuning.mainJet -
    getIdealJetForBike(bike) +
    (bike.tuning.needleClip - 3) * NEEDLE_CLIP_JET_EQUIV
  );
}

export function hasFault(bike: OwnedBike, id: FaultId): boolean {
  return bike.faults.some((f) => f.id === id && !f.fixed);
}

export function getFault(bike: OwnedBike, id: FaultId): ActiveFault | undefined {
  return bike.faults.find((f) => f.id === id && !f.fixed);
}

export function activeFaultIds(bike: OwnedBike): FaultId[] {
  return bike.faults.filter((f) => !f.fixed).map((f) => f.id);
}

export function hasUnresolvedFaults(bike: OwnedBike): boolean {
  return bike.faults.some((f) => !f.fixed);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function addFault(
  bike: OwnedBike,
  id: FaultId,
  severity: number,
  nowMs: number,
): boolean {
  const existing = getFault(bike, id);
  if (existing) {
    existing.severity = clamp(severity, 0.4, 1);
    return false;
  }
  bike.faults = bike.faults.filter((f) => f.id !== id);
  bike.faults.push({ id, severity: clamp(severity, 0.4, 1), injectedAtMs: nowMs });
  return true;
}

function removeFault(bike: OwnedBike, id: FaultId): boolean {
  const before = bike.faults.length;
  bike.faults = bike.faults.filter((f) => f.id !== id);
  return bike.faults.length !== before;
}

function wearSeverity(wear: number, threshold: number): number {
  return 0.4 + ((wear - threshold) / Math.max(1, 100 - threshold)) * 0.6;
}

export interface ReconcileResult {
  added: FaultId[];
  removed: FaultId[];
}

/**
 * Bring the fault list in line with the bike's real state (tuning + wear).
 * Mutates `bike`. Call after every garage action and at ride end.
 */
export function reconcileFaults(bike: OwnedBike, nowMs = 0): ReconcileResult {
  const added: FaultId[] = [];
  const removed: FaultId[] = [];
  const add = (id: FaultId, sev: number) => {
    if (addFault(bike, id, sev, nowMs)) added.push(id);
  };
  const remove = (id: FaultId) => {
    if (removeFault(bike, id)) removed.push(id);
  };

  // Clean out stale "fixed" markers.
  bike.faults = bike.faults.filter((f) => !f.fixed);

  // ── Jetting (tuning is the source of truth) ──
  const dev = getJetDeviation(bike);
  if (dev >= JET_FAULT_RAISE) {
    remove("lean-jet");
    add("rich-jet", 0.4 + (dev - JET_FAULT_CLEAR) / 12);
  } else if (dev <= -JET_FAULT_RAISE) {
    remove("rich-jet");
    add("lean-jet", 0.4 + (-dev - JET_FAULT_CLEAR) / 12);
  } else {
    if (dev < JET_FAULT_RAISE && dev > -JET_FAULT_RAISE) {
      // Within ±4 clears; the 4–6 band keeps whatever label was already there
      // but never keeps the wrong direction.
      if (Math.abs(dev) <= JET_FAULT_CLEAR || dev < 0) remove("rich-jet");
      if (Math.abs(dev) <= JET_FAULT_CLEAR || dev > 0) remove("lean-jet");
    }
  }

  // ── Premix ──
  if (!bike.tuning.hasPremixOil) add("no-premix", 1);
  else remove("no-premix");

  // ── Kill switch ──
  if (bike.tuning.killSwitchOn) add("no-spark", 1);

  // ── Wear-driven faults ──
  for (const def of Object.values(FAULT_DEFS)) {
    if (!def.wearKey || def.wearThreshold === undefined) continue;
    const wear = bike.wear[def.wearKey];
    if (wear >= def.wearThreshold) {
      add(def.id, wearSeverity(wear, def.wearThreshold));
    } else if (hasFault(bike, def.id)) {
      // Fault exists but wear says healthy → wear is the source of truth.
      remove(def.id);
    }
  }

  return { added, removed };
}

/**
 * Force a fault onto a bike, keeping the underlying state consistent so a
 * reconcile pass won't erase it. Mutates `bike`.
 */
export function forceFault(
  bike: OwnedBike,
  id: FaultId,
  severity = 0.8,
  nowMs = 0,
): void {
  const def = FAULT_DEFS[id];
  const ideal = getIdealJetForBike(bike);
  switch (id) {
    case "rich-jet":
      if (getJetDeviation(bike) < JET_FAULT_RAISE) {
        bike.tuning.mainJet = ideal + 12;
        bike.tuning.needleClip = 3;
      }
      break;
    case "lean-jet":
      if (getJetDeviation(bike) > -JET_FAULT_RAISE) {
        bike.tuning.mainJet = ideal - 8;
        bike.tuning.needleClip = 3;
      }
      break;
    case "no-premix":
      bike.tuning.hasPremixOil = false;
      break;
    default:
      break;
  }
  if (def.wearKey && def.wearThreshold !== undefined) {
    const target = def.wearThreshold + (100 - def.wearThreshold) * clamp((severity - 0.4) / 0.6, 0, 1);
    bike.wear[def.wearKey] = Math.max(bike.wear[def.wearKey], Math.round(target));
  }
  addFault(bike, id, severity, nowMs);
}

// ── FIX RESOLUTION ─────────────────────────────────────────────────────────

/**
 * Apply the mechanical consequences of installing a part. Mutates `bike`
 * (resets the matching wear fields) and returns the faults it cleared.
 * Call `reconcileFaults` afterwards.
 */
export function applyPartInstallFixes(bike: OwnedBike, part: PartSpec): FaultId[] {
  const cleared: FaultId[] = [];
  const clear = (id: FaultId) => {
    if (removeFault(bike, id)) cleared.push(id);
  };
  switch (part.slot) {
    case "spark-plug":
      bike.wear.plugFouling = 0;
      bike.lastPlugColor = "dry-clean";
      clear("fouled-plug");
      clear("weak-spark");
      clear("no-spark");
      break;
    case "ignition":
      clear("weak-spark");
      clear("no-spark");
      break;
    case "intake-gasket":
      bike.wear.gasketWear = 0;
      clear("air-leak");
      break;
    case "fuel-filter":
      bike.wear.fuelFilterClog = 0;
      clear("clogged-fuel");
      break;
    case "cylinder":
      bike.wear.pistonScore = 0;
      clear("low-compression");
      break;
    case "clutch":
    case "belt":
      bike.wear.clutchWear = 0;
      clear("clutch-slip");
      break;
    case "main-jet":
    case "carburetor":
    case "exhaust":
    case "air-filter":
      // Jetting faults are resolved by reconcile from tuning.
      break;
    default:
      break;
  }
  return cleared;
}

/** Toggling the kill switch OFF works crusty contacts clean → restores spark. */
export function applyKillSwitchOff(bike: OwnedBike): FaultId[] {
  const cleared: FaultId[] = [];
  if (removeFault(bike, "no-spark")) cleared.push("no-spark");
  if (removeFault(bike, "weak-spark")) cleared.push("weak-spark");
  return cleared;
}

export function applyPremixOil(bike: OwnedBike): FaultId[] {
  bike.tuning.hasPremixOil = true;
  return removeFault(bike, "no-premix") ? ["no-premix"] : [];
}

export function applyCarbClean(bike: OwnedBike): FaultId[] {
  bike.wear.fuelFilterClog = 0;
  return removeFault(bike, "clogged-fuel") ? ["clogged-fuel"] : [];
}

// ── EMERGENT RIDE FAULTS ("ride it until something breaks") ────────────────

export interface RideFaultContext {
  /** Total completed rides on this save incl. this one (new faults wait until ride #3+). */
  totalRides: number;
  /** Rode hot / WOT for a long stretch. */
  pushedHard: boolean;
  /** Seconds spent above ~200°C CHT. */
  hotSeconds?: number;
}

/** Faults that can be injected after a ride (jetting/premix are player-made). */
const INJECTABLE: FaultId[] = [
  "fouled-plug",
  "air-leak",
  "clogged-fuel",
  "weak-spark",
  "clutch-slip",
  "low-compression",
];

/**
 * After a ride, maybe introduce a new authentic fault. Only fires when the
 * bike is otherwise healthy (one mystery at a time) and after the first couple
 * of rides. Weighted by existing wear and how hard the bike was pushed.
 * Mutates `bike`; returns the injected fault (internal) or null.
 */
export function injectRideFault(
  bike: OwnedBike,
  rng: Rng,
  ctx: RideFaultContext = { totalRides: 2, pushedHard: false },
  nowMs = 0,
): FaultId | null {
  if (hasUnresolvedFaults(bike)) return null;
  // The first couple of rides are sacred (Milestone 1 victory lap stays clean).
  if (ctx.totalRides < 3) return null;
  const p = 0.28 + (ctx.pushedHard ? 0.22 : 0) + Math.min(0.2, (ctx.hotSeconds ?? 0) / 150);
  if (!chance(rng, p)) return null;

  const w = bike.wear;
  const weights: { item: FaultId; weight: number }[] = INJECTABLE.map((id) => {
    let weight = 1;
    switch (id) {
      case "fouled-plug":
        weight = 1 + w.plugFouling / 25;
        break;
      case "air-leak":
        weight = 0.8 + w.gasketWear / 30;
        break;
      case "clogged-fuel":
        weight = 0.8 + w.fuelFilterClog / 30;
        break;
      case "weak-spark":
        weight = 0.9;
        break;
      case "clutch-slip":
        weight = 0.6 + w.clutchWear / 30 + (ctx.pushedHard ? 0.6 : 0);
        break;
      case "low-compression":
        weight = 0.25 + w.pistonScore / 20 + (ctx.pushedHard ? 0.5 : 0);
        break;
      default:
        break;
    }
    return { item: id, weight };
  });
  const id = pickWeighted(rng, weights);
  if (!id) return null;
  const severity = 0.55 + rng() * 0.35;
  forceFault(bike, id, severity, nowMs);
  return id;
}

// ── PHYSICAL EFFECTS CONSUMED BY THE ENGINE MODEL ──────────────────────────

export interface FaultEffects {
  /** 0..1 extra unmetered air (worse at high vacuum / idle). */
  airLeak: number;
  /** 0..1 plug fouling (random misfire, hard start). */
  plugFoul: number;
  /** 0..1 spark energy (1 = fat blue, 0 = none). */
  sparkStrength: number;
  /** Multiplier on fuel supply to the float bowl. */
  fuelFlowMult: number;
  /** 0.5..1 compression multiplier (power, kick feel). */
  compression: number;
  /** Multiplier on clutch torque capacity (1 = healthy). */
  clutchGrip: number;
  /** Oil in the fuel? */
  premix: boolean;
  /** Kill switch left on in the garage. */
  killSwitchOn: boolean;
}

export function getFaultEffects(bike: OwnedBike): FaultEffects {
  const sev = (id: FaultId) => getFault(bike, id)?.severity ?? 0;
  const w = bike.wear;

  const airLeak = hasFault(bike, "air-leak")
    ? clamp(0.45 + sev("air-leak") * 0.55, 0, 1)
    : clamp((w.gasketWear - 40) / 150, 0, 0.15);

  const plugFoul = hasFault(bike, "fouled-plug")
    ? clamp(0.55 + sev("fouled-plug") * 0.45, 0, 1)
    : clamp(w.plugFouling / 250, 0, 0.25);

  let sparkStrength = 1;
  if (hasFault(bike, "weak-spark")) sparkStrength = clamp(0.62 - sev("weak-spark") * 0.3, 0.25, 0.6);
  if (hasFault(bike, "no-spark") || bike.tuning.killSwitchOn) sparkStrength = 0;

  const fuelFlowMult = hasFault(bike, "clogged-fuel")
    ? clamp(0.32 - sev("clogged-fuel") * 0.22, 0.06, 0.3)
    : clamp(1 - w.fuelFilterClog / 220, 0.6, 1);

  const compression = hasFault(bike, "low-compression")
    ? clamp(0.68 - sev("low-compression") * 0.14, 0.5, 0.66)
    : clamp(1 - w.pistonScore / 300, 0.8, 1);

  const clutchGrip = hasFault(bike, "clutch-slip")
    ? clamp(0.62 - sev("clutch-slip") * 0.25, 0.3, 0.6)
    : clamp(1 - w.clutchWear / 400, 0.78, 1);

  return {
    airLeak,
    plugFoul,
    sparkStrength,
    fuelFlowMult,
    compression,
    clutchGrip,
    premix: bike.tuning.hasPremixOil,
    killSwitchOn: bike.tuning.killSwitchOn,
  };
}
