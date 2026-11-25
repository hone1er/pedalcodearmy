// Zod-validated localStorage persistence for Ran When Parked.
// Any missing / corrupt / incompatible save falls back to the starter save.
//
// Schema v2 (V2 polish): route medals, Runner best distance, air filter dirt,
// and the road-tested bike verdict. v1 saves are migrated in place on load.

import { z } from "zod";
import { FIXTURE_SAVE } from "../contract/fixtures";
import type { SimSaveState } from "../contract";

/** Kept at "-v1" on purpose: the key never changes so existing saves migrate. */
export const SAVE_STORAGE_KEY = "pca-rwp-save-v1";
export const CURRENT_SAVE_VERSION = 2 as const;

const makeSchema = z.enum(["puch-maxi", "honda-hobbit", "derbi-variant", "tomos-a35"]);
const faultIdSchema = z.enum([
  "rich-jet",
  "lean-jet",
  "air-leak",
  "fouled-plug",
  "weak-spark",
  "no-spark",
  "clogged-fuel",
  "low-compression",
  "clutch-slip",
  "no-premix",
]);
const plugColorSchema = z.enum([
  "tan-ideal",
  "black-wet",
  "black-sooty",
  "white-lean",
  "white-blistered",
  "oily-fouled",
  "dry-clean",
]);
const routeIdSchema = z.enum([
  "telegraph-coffee",
  "lake-merritt-cruise",
  "grizzly-peak-climb",
  "midnight-tunnel",
]);
const upgradeIdSchema = z.enum(["gauge-tach", "gauge-cht", "tool-stethoscope"]);
const routeMedalSchema = z.enum(["finished", "speed", "cool-head", "hot-coffee"]);
const verdictSchema = z.enum(["untested", "ran-clean", "acting-up"]);
const wearValue = z.number().finite().min(0).max(100);

const bikeSchema = z.object({
  id: z.string().min(1),
  make: makeSchema,
  nickname: z.string(),
  colorHex: z.string(),
  accentHex: z.string(),
  odometerM: z.number().finite().min(0),
  parts: z.object({
    "spark-plug": z.string(),
    "main-jet": z.string(),
    carburetor: z.string(),
    exhaust: z.string(),
    cylinder: z.string(),
    "air-filter": z.string(),
    "fuel-filter": z.string(),
    ignition: z.string(),
    "intake-gasket": z.string(),
    clutch: z.string(),
    belt: z.string().optional(),
  }),
  tuning: z.object({
    mainJet: z.number().finite().min(40).max(100),
    needleClip: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    idleScrew: z.number().finite().min(0).max(4),
    hasPremixOil: z.boolean(),
    killSwitchOn: z.boolean(),
  }),
  faults: z.array(
    z.object({
      id: faultIdSchema,
      severity: z.number().finite(),
      injectedAtMs: z.number().finite(),
      fixed: z.boolean().optional(),
    }),
  ),
  wear: z.object({
    plugFouling: wearValue,
    pistonScore: wearValue,
    clutchWear: wearValue,
    fuelFilterClog: wearValue,
    gasketWear: wearValue,
    airFilterDirt: wearValue.optional(),
  }),
  lastPlugColor: plugColorSchema,
  verdict: verdictSchema.optional(),
  wrongSwapsStreak: z.number().int().min(0),
});

export const SaveSchema: z.ZodType<SimSaveState> = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  seed: z.number().finite(),
  cash: z.number().finite(),
  rep: z.number().finite(),
  activeBikeId: z.string(),
  bikes: z.array(bikeSchema).min(1),
  inventory: z.array(z.string()),
  upgrades: z.array(upgradeIdSchema),
  completedRoutes: z.array(routeIdSchema),
  routeMedals: z.record(routeIdSchema, z.array(routeMedalSchema)).optional(),
  runnerBestDistanceM: z.number().finite().min(0).optional(),
  journal: z.array(
    z.object({
      id: z.string(),
      timestamp: z.number().finite(),
      bikeId: z.string(),
      title: z.string(),
      body: z.string(),
      category: z.enum(["observation", "tool", "fix", "badge"]),
    }),
  ),
  badges: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      earnedAt: z.number().finite(),
    }),
  ),
  stats: z.object({
    totalRides: z.number().finite().min(0),
    totalBreakdowns: z.number().finite().min(0),
    totalFixes: z.number().finite().min(0),
    seizesSaved: z.number().finite().min(0),
    milesPedaledHome: z.number().finite().min(0),
  }),
});

/**
 * Fresh starter save: the Craigslist yellow Puch Maxi running a 72 main jet
 * on a stock Bing (ideal ~60), $120, a 60 + 64 jet and a spare plug in the
 * toolbox, and the intro journal entry.
 */
export function createStarterSave(seed?: number): SimSaveState {
  const save = migrateSave(structuredClone(FIXTURE_SAVE));
  if (seed !== undefined) save.seed = seed >>> 0;
  return save;
}

/**
 * Bring any valid save up to the current schema (v2). Mutates and returns it.
 * Idempotent: safe to run on an already-v2 save.
 */
export function migrateSave(save: SimSaveState): SimSaveState {
  save.version = CURRENT_SAVE_VERSION;
  save.routeMedals ??= {};
  for (const [routeId, medals] of Object.entries(save.routeMedals)) {
    if (!medals) continue;
    save.routeMedals[routeId as keyof typeof save.routeMedals] = [...new Set(medals)];
  }
  save.runnerBestDistanceM ??= 0;
  for (const bike of save.bikes) {
    bike.wear.airFilterDirt ??= 0;
    bike.verdict ??= "untested";
  }
  return save;
}

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Validate an unknown value as a save; returns null if invalid. */
export function parseSave(raw: unknown): SimSaveState | null {
  const result = SaveSchema.safeParse(raw);
  if (!result.success) return null;
  const save = migrateSave(result.data);
  if (!save.bikes.some((b) => b.id === save.activeBikeId)) {
    const first = save.bikes[0];
    if (!first) return null;
    save.activeBikeId = first.id;
  }
  return save;
}

/** Load the save from localStorage, falling back to a fresh starter save. */
export function loadSave(): SimSaveState {
  const storage = getStorage();
  if (!storage) return createStarterSave();
  try {
    const text = storage.getItem(SAVE_STORAGE_KEY);
    if (!text) return createStarterSave(newSeed());
    const parsed = parseSave(JSON.parse(text));
    return parsed ?? createStarterSave(newSeed());
  } catch {
    return createStarterSave(newSeed());
  }
}

export function persistSave(save: SimSaveState): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(SAVE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function newSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) ^ Date.now()) >>> 0;
}
