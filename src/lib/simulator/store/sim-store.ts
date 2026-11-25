"use client";

// Singleton client store for Ran When Parked.
//
//  • useSyncExternalStore with a cached snapshot reference (only replaced when
//    something actually changed → no render loops).
//  • 60 Hz fixed-timestep ride loop driven by requestAnimationFrame while
//    phase === "RIDE". React HUD notifications are throttled to ~15 Hz;
//    Canvas/Audio read `simStore.getLatestRideSnapshot()` at full rate.
//  • The same loop drives the garage Stand Test ("Fire it up!") while
//    phase === "GARAGE"; Audio/SVG read `simStore.getLatestStandSnapshot()`.
//  • Safe to import in Node (no window/rAF/localStorage required) so the whole
//    sim can be driven headlessly via `simStore.advanceRide(ms)` /
//    `simStore.advanceStand(ms)`.
//  • Bike verdicts ("untested" / "ran-clean" / "acting-up") come ONLY from
//    road-tested observations — never from the hidden fault list.

import { useMemo, useSyncExternalStore } from "react";
import { mulberry32 } from "../core/rng";
import type {
  BikeVerdict,
  CraigslistListing,
  FaultId,
  HotspotId,
  JournalEntry,
  OwnedBike,
  PartSlot,
  PlayerBadge,
  RideInput,
  RideSummary,
  RideTelemetrySnapshot,
  RouteId,
  RouteMedal,
  RunnerRunResult,
  RunnerRunSummary,
  SimAppSnapshot,
  SimEvent,
  SimPhase,
  SimSaveState,
  SimStoreActions,
  StandTestInput,
  ToolId,
  ToolReading,
  UpgradeId,
} from "../contract";
import { readTool } from "../diagnostics/tools";
import {
  CATALOG_JET_SIZES,
  CONSUMABLE_SLOTS,
  SERVICEABLE_SLOTS,
  getIdealJetForBike,
  getInstrumentById,
  getListingById,
  getPartById,
  isPartCompatible,
  nearestCatalogJet,
} from "../economy/catalog";
import {
  NEUTRAL_STAND_INPUT,
  type StandTestState,
  buildStandSnapshot,
  createStandTest,
  predictPlugColor,
  refreshStandBike,
  stepStandTest,
} from "../engine/engine-sim";
import {
  FAULT_DEFS,
  activeFaultIds,
  applyCarbClean,
  applyKillSwitchOff,
  applyPartInstallFixes,
  applyPremixOil,
  forceFault,
  getJetDeviation,
  injectRideFault,
  reconcileFaults,
} from "../faults/catalog";
import {
  NEUTRAL_INPUT,
  type RideState,
  TOW_COST,
  buildRideSnapshot,
  createRideState,
  finalizeRide,
  missionCompleteEvent,
  refreshRideBike,
  startPedalHome,
  stepRide,
} from "../ride/ride-sim";
import { getRouteById } from "../ride/routes";
import { clearSave, createStarterSave, loadSave, persistSave } from "../save/storage";

// ── CONSTANTS ──────────────────────────────────────────────────────────────

const STEP_SEC = 1 / 60;
const HUD_NOTIFY_MS = 66; // ~15 Hz
const MAX_STEPS_PER_FRAME = 8;
const FULL_SEND_MPH = 42;
/** Street Runner Rep only pays out for new personal-best distance bands. */
const RUNNER_REP_BAND_M = 250;
/** …or the very first run that makes it this far. */
const RUNNER_FIRST_REP_M = 150;
/** Long, hard Runner sessions can break things just like Tuning Rides. */
const RUNNER_FAULT_MIN_M = 600;
/** Air filter dirt per km if a sim result doesn't report it. */
const AIR_FILTER_DIRT_PER_KM = 1.4;
const AIR_FILTER_DUSTY = 25;

const WEAR_KEYS: (keyof OwnedBike["wear"])[] = [
  "plugFouling",
  "pistonScore",
  "clutchWear",
  "fuelFilterClog",
  "gasketWear",
  "airFilterDirt",
];
const JET_RANGE = {
  min: CATALOG_JET_SIZES[0] ?? 56,
  max: CATALOG_JET_SIZES[CATALOG_JET_SIZES.length - 1] ?? 84,
};

export const BADGES = {
  "first-fix": {
    title: "First Fix",
    description: "Diagnosed and fixed your first mechanical problem. You're a mechanic now.",
  },
  "parts-cannon": {
    title: "Parts Cannon",
    description: "Threw three parts at a problem without fixing it. Diagnose first, wrench second!",
  },
  "clutch-hero": {
    title: "Clutch Hero",
    description: "Pulled the clutch in time and saved a seizing top end.",
  },
  "leg-day": {
    title: "Leg Day",
    description: "Pedaled a broken-down moped home instead of paying for a tow.",
  },
  "full-send": {
    title: "Full Send",
    description: `Hit ${FULL_SEND_MPH}+ mph on a 50cc-era moped. Hold on to your teeth.`,
  },
} as const;
export type BadgeId = keyof typeof BADGES;

/** Hardware the Craigslist seller already bolted on. */
const LISTING_HARDWARE: Record<string, Partial<OwnedBike["parts"]>> = {
  "cl-derbi-variant": { exhaust: "pipe-tecno-boss" },
};
const LISTING_NICKNAMES: Record<string, string> = {
  "cl-honda-hobbit": "Grandpa's Red Hobbit",
  "cl-derbi-variant": "Blue Derbi 'FAST'",
  "cl-tomos-a35": "Barn-Find Tomos",
};

// ── HELPERS ────────────────────────────────────────────────────────────────

export function getActiveBike(save: SimSaveState): OwnedBike {
  return save.bikes.find((b) => b.id === save.activeBikeId) ?? save.bikes[0]!;
}

function clampWear(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v * 10) / 10));
}

/**
 * Add a ride/run wear delta to a bike. Tolerates missing keys on either side
 * (older saves, sims that don't report air filter dirt) so wear can never
 * become NaN → null → an invalid save.
 */
function applyWear(bike: OwnedBike, delta: Partial<OwnedBike["wear"]>, odometerDeltaM: number): void {
  for (const key of WEAR_KEYS) {
    let d = delta[key] ?? 0;
    if (delta[key] === undefined && key === "airFilterDirt") {
      d = (Math.max(0, odometerDeltaM) / 1000) * AIR_FILTER_DIRT_PER_KM;
    }
    const base = bike.wear[key] ?? 0;
    bike.wear[key] = clampWear(base + (Number.isFinite(d) ? d : 0));
  }
}

function isVariator(make: OwnedBike["make"]): boolean {
  return make === "honda-hobbit" || make === "derbi-variant";
}

/** Build a fresh OwnedBike from a Craigslist listing, with its hidden starter faults. */
export function createBikeFromListing(listing: CraigslistListing): OwnedBike {
  const bike: OwnedBike = {
    id: `bike-${listing.id}`,
    make: listing.make,
    nickname: LISTING_NICKNAMES[listing.id] ?? listing.title,
    colorHex: listing.colorHex,
    accentHex: listing.accentHex,
    odometerM: 4000 + listing.price * 37,
    parts: {
      "spark-plug": "plug-ngk-b6hs",
      "main-jet": "jet-60",
      carburetor: "carb-bing-12",
      exhaust: "pipe-stock-maxi",
      cylinder: "cyl-stock-50",
      "air-filter": "filter-stock-box",
      "fuel-filter": "fuel-filter-inline",
      ignition: "ign-points-stock",
      "intake-gasket": "gasket-intake-stock",
      clutch: "clutch-stock-2shoe",
      ...(isVariator(listing.make) ? { belt: "belt-stock-variator" } : {}),
      ...(LISTING_HARDWARE[listing.id] ?? {}),
    },
    tuning: { mainJet: 60, needleClip: 3, idleScrew: 1.5, hasPremixOil: true, killSwitchOn: false },
    faults: [],
    wear: {
      plugFouling: 18,
      pistonScore: 6,
      clutchWear: 22,
      fuelFilterClog: 20,
      gasketWear: 24,
      // A bike that sat in a dusty garage for years has a filthy filter.
      airFilterDirt: listing.make === "tomos-a35" ? 58 : 24,
    },
    lastPlugColor: "tan-ideal",
    verdict: "untested",
    wrongSwapsStreak: 0,
  };
  // Jetting: start at the ideal for the hardware, then apply the seller's "tune".
  const ideal = getIdealJetForBike(bike);
  let jet = nearestCatalogJet(ideal + (listing.starterJetOffset ?? 0));
  if (listing.starterFaults.includes("lean-jet") && listing.starterJetOffset === undefined) {
    jet = nearestCatalogJet(ideal - 8);
  }
  if (listing.starterFaults.includes("rich-jet") && listing.starterJetOffset === undefined) {
    jet = nearestCatalogJet(ideal + 12);
  }
  bike.tuning.mainJet = jet;
  bike.parts["main-jet"] = `jet-${jet}`;
  for (const id of listing.starterFaults) {
    if (id === "rich-jet" || id === "lean-jet") continue; // expressed via jetting above
    forceFault(bike, id, 0.8, 0);
  }
  reconcileFaults(bike, 0);
  bike.lastPlugColor = predictPlugColor(bike);
  return bike;
}

// ── STORE ──────────────────────────────────────────────────────────────────

interface UiState {
  phase: SimPhase;
  save: SimSaveState;
  lastRideSummary: RideSummary | null;
  lastRunnerSummary: RunnerRunSummary | null;
  selectedTool: ToolId;
  lastToolReading: ToolReading | null;
  plugViewerColor: SimAppSnapshot["plugViewerColor"];
  lastActionNotice: SimAppSnapshot["lastActionNotice"];
  runnerPlaying: boolean;
}

type Listener = () => void;
type EventListener = (ev: SimEvent) => void;

let serverSnapshotCache: SimAppSnapshot | null = null;

function buildSnapshot(
  ui: UiState,
  ride: RideTelemetrySnapshot | null,
  standTest: RideTelemetrySnapshot | null,
): SimAppSnapshot {
  const bike = getActiveBike(ui.save);
  const bikeVerdict: BikeVerdict = bike.verdict ?? "untested";
  return {
    phase: ui.phase,
    save: ui.save,
    ride,
    standTest,
    runnerPlaying: ui.runnerPlaying,
    lastRideSummary: ui.lastRideSummary,
    lastRunnerSummary: ui.lastRunnerSummary,
    selectedTool: ui.selectedTool,
    lastToolReading: ui.lastToolReading,
    plugViewerColor: ui.plugViewerColor,
    lastActionNotice: ui.lastActionNotice,
    garageFuelDrip: getJetDeviation(bike) >= 8,
    bikeVerdict,
    // Road-tested only — never the hidden fault list.
    bikeNeedsAttention: bikeVerdict === "acting-up",
    jetRange: JET_RANGE,
  };
}

class SimStoreImpl {
  private initialized = false;
  private ui: UiState;
  private snapshot: SimAppSnapshot;
  private listeners = new Set<Listener>();
  private eventListeners = new Set<EventListener>();

  private rideState: RideState | null = null;
  private rideInput: RideInput = { ...NEUTRAL_INPUT };
  private pendingPedal = false;
  private pendingKick = false;
  private pendingSwerve: "toggle" | 0 | 1 | null = null;
  private latestRide: RideTelemetrySnapshot | null = null;
  private hudRide: RideTelemetrySnapshot | null = null;

  private standState: StandTestState | null = null;
  private standInput: StandTestInput = { ...NEUTRAL_STAND_INPUT };
  private pendingStandKick = false;
  private latestStand: RideTelemetrySnapshot | null = null;
  private hudStand: RideTelemetrySnapshot | null = null;
  private standNonce = 0;

  private rafId: number | null = null;
  private lastFrameMs: number | null = null;
  private accumulator = 0;
  private simClockMs = 0;
  private lastNotifyMs = -Infinity;
  private journalSeq = 0;
  /** Varies the ride seed on retries so an aborted ride doesn't replay identically. */
  private rideNonce = 0;
  /** Bikes where the player manually flipped the kill switch OFF in the garage (not a real fault fix). */
  private playerFlippedKillSwitch = new Set<string>();

  constructor() {
    const save = createStarterSave();
    this.ui = {
      phase: "GARAGE",
      save,
      lastRideSummary: null,
      lastRunnerSummary: null,
      selectedTool: "visual",
      lastToolReading: null,
      plugViewerColor: null,
      lastActionNotice: null,
      runnerPlaying: false,
    };
    this.snapshot = buildSnapshot(this.ui, null, null);
  }

  // ── init / subscription ──

  private ensureInit(): void {
    if (this.initialized) return;
    this.initialized = true;
    const save = loadSave();
    for (const bike of save.bikes) reconcileFaults(bike, 0);
    this.ui = { ...this.ui, save };
    this.snapshot = buildSnapshot(this.ui, this.hudRide, this.hudStand);
  }

  getSnapshot = (): SimAppSnapshot => {
    this.ensureInit();
    return this.snapshot;
  };

  getServerSnapshot = (): SimAppSnapshot => {
    serverSnapshotCache ??= buildSnapshot(
      {
        phase: "GARAGE",
        save: createStarterSave(),
        lastRideSummary: null,
        lastRunnerSummary: null,
        selectedTool: "visual",
        lastToolReading: null,
        plugViewerColor: null,
        lastActionNotice: null,
        runnerPlaying: false,
      },
      null,
      null,
    );
    return serverSnapshotCache;
  };

  /** Latest 60 Hz ride telemetry for Canvas 2D & Web Audio (not throttled). */
  getLatestRideSnapshot = (): RideTelemetrySnapshot | null => this.latestRide;

  /** Latest 60 Hz stand-test telemetry for PulseSynth & the workbench SVG (not throttled). */
  getLatestStandSnapshot = (): RideTelemetrySnapshot | null => this.latestStand;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  subscribeEvents = (cb: EventListener): (() => void) => {
    this.eventListeners.add(cb);
    return () => {
      this.eventListeners.delete(cb);
    };
  };

  private emitEvent(ev: SimEvent): void {
    for (const cb of this.eventListeners) {
      try {
        cb(ev);
      } catch {
        // Listener errors must never break the sim loop.
      }
    }
  }

  /** Replace the cached snapshot & notify React. */
  private commit(opts: { persist?: boolean } = {}): void {
    this.hudRide = this.latestRide;
    this.hudStand = this.latestStand;
    this.snapshot = buildSnapshot(this.ui, this.hudRide, this.hudStand);
    this.lastNotifyMs = this.simClockMs;
    if (opts.persist) persistSave(this.ui.save);
    for (const l of this.listeners) l();
  }

  private patchUi(patch: Partial<UiState>, opts: { persist?: boolean } = {}): void {
    this.ui = { ...this.ui, ...patch };
    this.commit(opts);
  }

  private notice(text: string, tone: "gold" | "green" | "red" | "cyan"): void {
    this.ui = { ...this.ui, lastActionNotice: { text, tone } };
  }

  private journal(bikeId: string, title: string, body: string, category: JournalEntry["category"]): void {
    const entry: JournalEntry = {
      id: `j-${Date.now().toString(36)}-${(this.journalSeq++).toString(36)}`,
      timestamp: Date.now(),
      bikeId,
      title,
      body,
      category,
    };
    const journal = [...this.ui.save.journal, entry].slice(-120);
    this.ui = { ...this.ui, save: { ...this.ui.save, journal } };
  }

  private awardBadge(id: BadgeId): boolean {
    if (this.ui.save.badges.some((b) => b.id === id)) return false;
    const def = BADGES[id];
    const badge: PlayerBadge = { id, title: def.title, description: def.description, earnedAt: Date.now() };
    this.ui = { ...this.ui, save: { ...this.ui.save, badges: [...this.ui.save.badges, badge] } };
    this.journal(this.ui.save.activeBikeId, `Badge: ${def.title}`, def.description, "badge");
    this.emitEvent({ type: "badge-earned", badgeId: id, title: def.title, description: def.description });
    return true;
  }

  private replaceBike(bike: OwnedBike): void {
    const bikes = this.ui.save.bikes.map((b) => (b.id === bike.id ? bike : b));
    this.ui = { ...this.ui, save: { ...this.ui.save, bikes } };
    if (this.rideState?.bike.id === bike.id && !this.rideState.finished) {
      refreshRideBike(this.rideState, structuredClone(bike));
    }
    // Wrenching while it idles on the stand: the running engine feels it at once.
    if (this.standState?.bike.id === bike.id) {
      refreshStandBike(this.standState, structuredClone(bike));
    }
  }

  /** Record faults that disappeared due to a player action. */
  private recordFixes(bike: OwnedBike, fixed: FaultId[]): void {
    if (fixed.length === 0) return;
    for (const id of fixed) {
      const def = FAULT_DEFS[id];
      this.journal(bike.id, def.fixedTitle, def.fixedBody, "fix");
    }
    const stats = { ...this.ui.save.stats, totalFixes: this.ui.save.stats.totalFixes + fixed.length };
    this.ui = { ...this.ui, save: { ...this.ui.save, stats } };
    this.awardBadge("first-fix");
  }

  /**
   * Shared path for every garage change: clone → mutate → reconcile → diff
   * faults → journal/badges → persist.
   */
  private garageChange(
    mutate: (bike: OwnedBike) => FaultId[] | void,
    opts: { countsAsSwap?: boolean; skipFixRecord?: boolean } = {},
  ): { bike: OwnedBike; fixed: FaultId[] } {
    this.ensureInit();
    const bike = structuredClone(getActiveBike(this.ui.save));
    const before = activeFaultIds(bike);
    mutate(bike);
    // Any wrenching means the old road-test verdict no longer applies.
    bike.verdict = "untested";
    reconcileFaults(bike, Date.now());
    const after = activeFaultIds(bike);
    const fixed = before.filter((id) => !after.includes(id));
    if (opts.countsAsSwap && before.length > 0) {
      bike.wrongSwapsStreak = fixed.length > 0 ? 0 : bike.wrongSwapsStreak + 1;
    }
    if (after.length === 0) bike.wrongSwapsStreak = 0;
    this.replaceBike(bike);
    if (!opts.skipFixRecord) this.recordFixes(bike, fixed);
    if (bike.wrongSwapsStreak >= 3) this.awardBadge("parts-cannon");
    return { bike, fixed };
  }

  private rideBlocksWrenching(): boolean {
    const r = this.rideState;
    return !!r && !r.finished && r.engine.running;
  }

  // ── RIDE LOOP ──

  /** The sim keeps running at the roadside too (kick it, pedal home, cool down). */
  private rideShouldRun(): boolean {
    const onRoad = this.ui.phase === "RIDE" || this.ui.phase === "ROADSIDE";
    return onRoad && !!this.rideState && !this.rideState.finished;
  }

  private standShouldRun(): boolean {
    return !!this.standState && this.ui.phase === "GARAGE";
  }

  private shouldRun(): boolean {
    return this.rideShouldRun() || this.standShouldRun();
  }

  /** Start or stop the rAF loop to match what currently needs simulating. */
  private syncLoop(): void {
    if (this.shouldRun()) this.ensureLoop();
    else this.stopLoop();
  }

  private ensureLoop(): void {
    if (this.rafId !== null || !this.shouldRun()) return;
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return;
    this.lastFrameMs = null;
    this.rafId = window.requestAnimationFrame(this.frame);
  }

  private stopLoop(): void {
    if (this.rafId !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(this.rafId);
    }
    this.rafId = null;
    this.lastFrameMs = null;
    this.accumulator = 0;
  }

  private frame = (now: number): void => {
    this.rafId = null;
    if (!this.shouldRun()) return;
    const dtMs = this.lastFrameMs === null ? 1000 / 60 : Math.min(100, Math.max(0, now - this.lastFrameMs));
    this.lastFrameMs = now;
    if (this.rideShouldRun()) this.advanceRide(dtMs);
    else this.advanceStand(dtMs);
    if (this.shouldRun()) this.rafId = window.requestAnimationFrame(this.frame);
  };

  /**
   * Advance the ride simulation by `dtMs` of wall time using fixed 60 Hz
   * steps. Public so headless tests can drive the sim without rAF.
   */
  advanceRide = (dtMs: number): void => {
    if (!this.rideState || this.rideState.finished) return;
    this.accumulator += dtMs / 1000;
    let steps = 0;
    let urgent = false;
    while (this.accumulator >= STEP_SEC && steps < MAX_STEPS_PER_FRAME) {
      this.accumulator -= STEP_SEC;
      steps++;
      this.simClockMs += STEP_SEC * 1000;
      if (this.stepOnce()) urgent = true;
      if (!this.rideState || this.rideState.finished) break;
    }
    if (steps >= MAX_STEPS_PER_FRAME) this.accumulator = 0; // drop backlog (tab was hidden)
    if (!this.rideState || this.rideState.finished) return;
    if (urgent || this.simClockMs - this.lastNotifyMs >= HUD_NOTIFY_MS) this.commit();
  };

  /**
   * Advance the garage stand test by `dtMs` using fixed 60 Hz steps. Public so
   * headless tests can drive it without rAF (feed ≤ 8 steps per call).
   */
  advanceStand = (dtMs: number): void => {
    if (!this.standState) return;
    this.accumulator += dtMs / 1000;
    let steps = 0;
    let urgent = false;
    while (this.accumulator >= STEP_SEC && steps < MAX_STEPS_PER_FRAME) {
      this.accumulator -= STEP_SEC;
      steps++;
      this.simClockMs += STEP_SEC * 1000;
      if (this.stepStandOnce()) urgent = true;
      if (!this.standState) break;
    }
    if (steps >= MAX_STEPS_PER_FRAME) this.accumulator = 0;
    if (!this.standState) return;
    if (urgent || this.simClockMs - this.lastNotifyMs >= HUD_NOTIFY_MS) this.commit();
  };

  private stepStandOnce(): boolean {
    const stand = this.standState;
    if (!stand) return false;
    const input: StandTestInput = { ...this.standInput, kickstartPulse: this.pendingStandKick };
    this.pendingStandKick = false;
    const events = stepStandTest(stand, input, STEP_SEC);
    this.latestStand = buildStandSnapshot(stand);
    let urgent = false;
    // Stand events are sound/visual cues only — no badges, stats, or plug reads
    // (the clutch is always out of the loop on the stand, and there's no load).
    for (const ev of events) {
      this.emitEvent(ev);
      if (ev.type !== "caption") urgent = true;
    }
    return urgent;
  }

  /** Tear down the stand test without committing (callers commit). */
  private haltStand(): void {
    this.standState = null;
    this.latestStand = null;
    this.standInput = { ...NEUTRAL_STAND_INPUT };
    this.pendingStandKick = false;
  }

  /** One fixed 60 Hz step. Returns true if the HUD should update immediately. */
  private stepOnce(): boolean {
    const ride = this.rideState;
    if (!ride) return false;
    const swerveCmd = this.pendingSwerve;
    this.pendingSwerve = null;
    const input: RideInput = {
      ...this.rideInput,
      pedalPulse: this.pendingPedal,
      kickstartPulse: this.pendingKick,
      ...(swerveCmd === "toggle"
        ? { swerveToggle: true }
        : swerveCmd === 0 || swerveCmd === 1
          ? { lane: swerveCmd }
          : {}),
    };
    this.pendingPedal = false;
    this.pendingKick = false;
    const events = stepRide(ride, input, STEP_SEC);
    this.latestRide = buildRideSnapshot(ride);
    let urgent = false;
    for (const ev of events) {
      this.emitEvent(ev);
      if (
        ev.type !== "caption" &&
        ev.type !== "pothole-bump" &&
        ev.type !== "pothole-dodge"
      ) {
        urgent = true;
      }
      if (ev.type === "seize-saved") {
        const stats = { ...this.ui.save.stats, seizesSaved: this.ui.save.stats.seizesSaved + 1 };
        this.ui = { ...this.ui, save: { ...this.ui.save, stats } };
        this.awardBadge("clutch-hero");
      }
      if (ev.type === "stalled" && ev.reason === "plug-chop" && ride.engine.plugChopColor) {
        // Plug chop is readable right away at the roadside (and in the garage).
        const saved = this.ui.save.bikes.find((b) => b.id === ride.bike.id);
        if (saved) this.replaceBike({ ...saved, lastPlugColor: ride.engine.plugChopColor });
      }
    }
    // Breakdown ⇄ riding: drive the ROADSIDE phase from the engine state.
    const broken =
      !ride.finished && !ride.pedalingHome && !ride.engine.running && (ride.engine.stalled || ride.engine.seizedHard);
    if (broken && this.ui.phase === "RIDE") {
      this.ui = { ...this.ui, phase: "ROADSIDE" };
      urgent = true;
    } else if (!broken && this.ui.phase === "ROADSIDE") {
      this.ui = { ...this.ui, phase: "RIDE" };
      urgent = true;
    }
    if (ride.topSpeedMph >= FULL_SEND_MPH && this.awardBadge("full-send")) urgent = true;
    if (ride.finished && ride.outcome) {
      this.completeRide(ride.outcome);
      return true;
    }
    return urgent;
  }

  /** Close out the active ride: rewards, wear, faults, journal, persist. */
  private completeRide(outcome: RideSummary["outcome"], opts: { showSummary?: boolean } = {}): void {
    const ride = this.rideState;
    if (!ride) return;
    ride.finished = true;
    ride.outcome = outcome;
    this.stopLoop();
    const result = finalizeRide(ride, outcome);
    const summary = result.summary;
    this.latestRide = buildRideSnapshot(ride);

    const save = this.ui.save;
    const current = save.bikes.find((b) => b.id === ride.bike.id);
    if (current) {
      const bike = structuredClone(current);
      bike.odometerM += result.odometerDeltaM;
      applyWear(bike, result.wearDelta, result.odometerDeltaM);
      if (result.plugColor) bike.lastPlugColor = result.plugColor;
      // Road-tested verdict: only what the rider actually saw, heard and felt.
      if (outcome !== "aborted") {
        const eng = ride.engine;
        const actingUp =
          outcome !== "finished" ||
          !ride.everStarted ||
          ride.notes.length > 0 ||
          eng.detonations > 0 ||
          eng.seizesSaved > 0 ||
          eng.seizeCrashes > 0;
        bike.verdict = actingUp ? "acting-up" : "ran-clean";
      }
      reconcileFaults(bike, Date.now());
      if (outcome === "finished") {
        const rng = mulberry32((save.seed + save.stats.totalRides * 7919 + 17) >>> 0);
        injectRideFault(
          bike,
          rng,
          { totalRides: save.stats.totalRides + 1, pushedHard: result.pushedHard, hotSeconds: result.hotSeconds },
          Date.now(),
        );
      }
      this.replaceBike(bike);
    }

    const counted = outcome !== "aborted" || summary.distanceM > 50;
    const breakdown = outcome === "towed" || outcome === "seize-crash" || outcome === "pedaled-home";
    const stats = {
      ...this.ui.save.stats,
      totalRides: this.ui.save.stats.totalRides + (counted ? 1 : 0),
      totalBreakdowns: this.ui.save.stats.totalBreakdowns + (breakdown ? 1 : 0),
      milesPedaledHome:
        Math.round((this.ui.save.stats.milesPedaledHome + ride.distancePedaledM / 1609.34) * 100) / 100,
    };
    const completedRoutes =
      outcome === "finished" && !this.ui.save.completedRoutes.includes(summary.routeId)
        ? [...this.ui.save.completedRoutes, summary.routeId]
        : this.ui.save.completedRoutes;

    // Route medals: merge what this ride earned, remember which ones are new.
    const prevMedals: RouteMedal[] = this.ui.save.routeMedals?.[summary.routeId] ?? [];
    const earnedMedals = [...new Set(summary.medalsEarned ?? [])];
    const newMedals = earnedMedals.filter((m) => !prevMedals.includes(m));
    const routeMedals =
      newMedals.length > 0
        ? { ...(this.ui.save.routeMedals ?? {}), [summary.routeId]: [...prevMedals, ...newMedals] }
        : (this.ui.save.routeMedals ?? {});
    const finalSummary: RideSummary = { ...summary, newMedals };

    this.ui = {
      ...this.ui,
      save: {
        ...this.ui.save,
        cash: Math.max(0, this.ui.save.cash + summary.cashEarned - summary.towCost),
        rep: this.ui.save.rep + summary.repEarned,
        completedRoutes,
        routeMedals,
        stats,
      },
    };

    if (outcome === "pedaled-home") this.awardBadge("leg-day");
    if (outcome === "finished") this.emitEvent(missionCompleteEvent(result));

    if (outcome !== "aborted") {
      const outcomeText: Record<RideSummary["outcome"], string> = {
        finished: "Made it",
        "pedaled-home": "Pedaled it home",
        towed: "Got towed",
        "seize-crash": "Seized & towed",
        aborted: "Turned back",
      };
      const body = [`Top speed ${summary.topSpeedMph} mph.`, ...summary.notes].join(" ");
      this.journal(ride.bike.id, `${ride.route.name}: ${outcomeText[outcome]}`, body, "observation");
    }

    this.ui = {
      ...this.ui,
      lastRideSummary: opts.showSummary === false ? null : finalSummary,
    };
    this.commit({ persist: true });
  }

  // ── ACTIONS ──

  setPhase = (phase: SimPhase): void => {
    this.ensureInit();
    const ride = this.rideState;
    if (phase === "RIDE" && !ride) return;
    if (ride && !ride.finished && phase !== "RIDE" && phase !== "ROADSIDE") {
      // Leaving the ride entirely = turning back.
      this.completeRide("aborted", { showSummary: false });
      this.rideState = null;
      this.latestRide = null;
    }
    if (phase !== "RIDE" && phase !== "ROADSIDE" && ride?.finished) {
      this.rideState = null;
      this.latestRide = null;
    }
    // The stand test lives on the garage floor only.
    if (phase !== "GARAGE") this.haltStand();
    this.patchUi({ phase, runnerPlaying: phase === "RUNNER" ? this.ui.runnerPlaying : false });
    this.syncLoop();
  };

  selectBike = (bikeId: string): void => {
    this.ensureInit();
    if (!this.ui.save.bikes.some((b) => b.id === bikeId)) return;
    if (this.rideState && !this.rideState.finished) return;
    if (bikeId !== this.ui.save.activeBikeId) this.haltStand();
    this.patchUi(
      {
        save: { ...this.ui.save, activeBikeId: bikeId },
        lastToolReading: null,
        plugViewerColor: null,
      },
      { persist: true },
    );
    this.syncLoop();
  };

  selectTool = (tool: ToolId): void => {
    this.ensureInit();
    this.patchUi({ selectedTool: tool });
  };

  runToolOnHotspot = (hotspot: HotspotId): ToolReading | null => {
    this.ensureInit();
    const bike = getActiveBike(this.ui.save);
    const reading = readTool(this.ui.selectedTool, hotspot, bike);
    if (reading.journalNote) {
      const last = [...this.ui.save.journal].reverse().find((j) => j.bikeId === bike.id);
      if (last?.body !== reading.journalNote) {
        this.journal(bike.id, reading.headline, reading.journalNote, "tool");
      }
    }
    this.patchUi(
      {
        lastToolReading: reading,
        plugViewerColor: reading.tool === "plug-chop" ? (reading.plugColor ?? null) : this.ui.plugViewerColor,
      },
      { persist: true },
    );
    return reading;
  };

  closePlugViewer = (): void => {
    this.patchUi({ plugViewerColor: null });
  };

  clearNotice = (): void => {
    this.patchUi({ lastActionNotice: null });
  };

  installPart = (partId: string): boolean => {
    this.ensureInit();
    const part = getPartById(partId);
    const active = getActiveBike(this.ui.save);
    if (!part) {
      this.notice("That part doesn't exist.", "red");
      this.commit();
      return false;
    }
    if (this.rideBlocksWrenching()) {
      this.notice("Kill the engine before you start wrenching.", "red");
      this.commit();
      return false;
    }
    const invIdx = this.ui.save.inventory.indexOf(partId);
    if (invIdx === -1) {
      this.notice(`No ${part.name} in the toolbox — grab one at the parts counter.`, "red");
      this.commit();
      return false;
    }
    if (!isPartCompatible(part, active.make)) {
      this.notice(`${part.name} doesn't fit this ${active.make.replace(/-/g, " ")}.`, "red");
      this.commit();
      return false;
    }
    const slot = part.slot;
    const consumable = CONSUMABLE_SLOTS.includes(slot);
    const sameId = active.parts[slot] === partId;
    if (sameId && !SERVICEABLE_SLOTS.includes(slot)) {
      this.notice(`${part.name} is already installed.`, "cyan");
      this.commit();
      return false;
    }

    const oldId = active.parts[slot];
    const oldCylinderWorn = slot === "cylinder" && active.wear.pistonScore >= 30;
    this.garageChange(
      (bike) => {
        if (slot === "belt") bike.parts.belt = partId;
        else bike.parts[slot] = partId;
        if (slot === "main-jet" && part.jetSize) bike.tuning.mainJet = part.jetSize;
        return applyPartInstallFixes(bike, part);
      },
      { countsAsSwap: true },
    );

    const inventory = [...this.ui.save.inventory];
    inventory.splice(invIdx, 1);
    // Old part goes back in the toolbox unless it's worn-out junk or a like-for-like replacement.
    if (oldId && !sameId && !consumable && !oldCylinderWorn && getPartById(oldId)) inventory.push(oldId);
    this.ui = { ...this.ui, save: { ...this.ui.save, inventory } };

    // Neutral on purpose: the wrench never tells you whether you fixed it.
    this.notice(
      `Installed ${part.name}. Fire it up on the stand or take a test ride to feel the difference.`,
      "gold",
    );
    this.commit({ persist: true });
    return true;
  };

  setMainJet = (size: number): void => {
    this.ensureInit();
    const jet = nearestCatalogJet(size);
    const bike = getActiveBike(this.ui.save);
    if (bike.tuning.mainJet === jet && bike.parts["main-jet"] === `jet-${jet}`) return;
    const id = `jet-${jet}`;
    if (!this.ui.save.inventory.includes(id)) {
      this.notice(`No #${jet} main jet in the toolbox — they're $6 at the parts counter.`, "red");
      this.commit();
      return;
    }
    this.installPart(id);
  };

  setNeedleClip = (clip: 1 | 2 | 3 | 4 | 5): void => {
    if (this.rideBlocksWrenching()) return;
    this.garageChange((bike) => {
      bike.tuning.needleClip = clip;
    });
    this.notice(`Needle clip moved to position ${clip}.`, "gold");
    this.commit({ persist: true });
  };

  setIdleScrew = (turns: number): void => {
    if (this.rideBlocksWrenching()) return;
    const t = Math.max(0.5, Math.min(3, Math.round(turns * 4) / 4));
    this.garageChange((bike) => {
      bike.tuning.idleScrew = t;
    });
    this.notice(`Idle air screw set to ${t.toFixed(2)} turns out.`, "gold");
    this.commit({ persist: true });
  };

  toggleKillSwitch = (): void => {
    this.ensureInit();
    const active = getActiveBike(this.ui.save);
    const wasOn = active.tuning.killSwitchOn;
    const hadNoSparkBefore = activeFaultIds(active).includes("no-spark");
    if (!wasOn && !hadNoSparkBefore) {
      this.playerFlippedKillSwitch.add(active.id);
    }
    const selfInflicted = wasOn && this.playerFlippedKillSwitch.delete(active.id);
    this.garageChange(
      (bike) => {
        bike.tuning.killSwitchOn = !wasOn;
        return wasOn ? applyKillSwitchOff(bike) : [];
      },
      { skipFixRecord: selfInflicted },
    );
    // Neutral either way — whether the spark is truly back is for the kickstart to tell.
    this.notice(
      wasOn ? "Kill switch flipped to RUN." : "Kill switch flipped to OFF. It won't fire like this.",
      "cyan",
    );
    this.commit({ persist: true });
  };

  addPremixOil = (): void => {
    this.ensureInit();
    const had = getActiveBike(this.ui.save).tuning.hasPremixOil;
    this.garageChange((bike) => applyPremixOil(bike));
    this.notice(
      had ? "Topped off with fresh 50:1 premix." : "Mixed 2-stroke oil into the tank at 50:1. Phew.",
      had ? "gold" : "green",
    );
    this.commit({ persist: true });
  };

  cleanAirFilter = (): void => {
    this.ensureInit();
    if (this.rideBlocksWrenching()) return;
    const dirt = getActiveBike(this.ui.save).wear.airFilterDirt ?? 0;
    this.garageChange((bike) => {
      bike.wear.airFilterDirt = 0;
    });
    // Air filter dirt is plain maintenance (not a hidden fault) — honest feedback.
    if (dirt >= AIR_FILTER_DUSTY) {
      this.notice("Knocked a cloud of East Bay dust out of the air filter — breathes easier now.", "green");
    } else {
      this.notice("Tapped out the air filter — already pretty clean.", "gold");
    }
    this.commit({ persist: true });
  };

  cleanCarburetor = (): void => {
    if (this.rideBlocksWrenching()) return;
    this.garageChange((bike) => applyCarbClean(bike));
    // Neutral on purpose — the road (or the stand) is the judge.
    this.notice(
      "Pulled the carb, blew out the jets and fuel passages, and bolted it back on. Fire it up to see how it runs.",
      "gold",
    );
    this.commit({ persist: true });
  };

  clearFaultlessTestCheck = (): void => {
    this.patchUi({ lastToolReading: null, plugViewerColor: null, lastActionNotice: null });
  };

  buyPart = (partId: string): boolean => {
    this.ensureInit();
    const part = getPartById(partId);
    const save = this.ui.save;
    if (!part) return false;
    if (save.rep < part.repRequired) {
      this.notice(`Need ${part.repRequired} Rep to buy ${part.name}.`, "red");
      this.commit();
      return false;
    }
    if (save.cash < part.price) {
      this.notice(`Not enough cash for ${part.name} ($${part.price}).`, "red");
      this.commit();
      return false;
    }
    this.ui = {
      ...this.ui,
      save: { ...save, cash: save.cash - part.price, inventory: [...save.inventory, partId] },
    };
    this.notice(`Bought ${part.name} for $${part.price}. It's in your toolbox.`, "gold");
    this.commit({ persist: true });
    return true;
  };

  buyUpgrade = (upgradeId: UpgradeId): boolean => {
    this.ensureInit();
    const spec = getInstrumentById(upgradeId);
    const save = this.ui.save;
    if (!spec || save.upgrades.includes(upgradeId)) return false;
    if (save.rep < spec.repRequired) {
      this.notice(`Need ${spec.repRequired} Rep to buy the ${spec.name}.`, "red");
      this.commit();
      return false;
    }
    if (save.cash < spec.price) {
      this.notice(`Not enough cash for the ${spec.name} ($${spec.price}).`, "red");
      this.commit();
      return false;
    }
    this.ui = {
      ...this.ui,
      save: { ...save, cash: save.cash - spec.price, upgrades: [...save.upgrades, upgradeId] },
    };
    this.notice(`Bought the ${spec.name}!`, "green");
    this.commit({ persist: true });
    return true;
  };

  buyCraigslistBike = (listingId: string): boolean => {
    this.ensureInit();
    const listing = getListingById(listingId);
    const save = this.ui.save;
    if (!listing) return false;
    const bikeId = `bike-${listing.id}`;
    if (save.bikes.some((b) => b.id === bikeId)) {
      this.notice("You already bought that one.", "cyan");
      this.commit();
      return false;
    }
    if (save.rep < listing.repRequired) {
      this.notice(`The seller wants someone with ${listing.repRequired}+ Rep.`, "red");
      this.commit();
      return false;
    }
    if (save.cash < listing.price) {
      this.notice(`You need $${listing.price} cash for this one.`, "red");
      this.commit();
      return false;
    }
    const bike = createBikeFromListing(listing);
    this.haltStand();
    this.ui = {
      ...this.ui,
      save: {
        ...save,
        cash: save.cash - listing.price,
        bikes: [...save.bikes, bike],
        activeBikeId: bike.id,
      },
      lastToolReading: null,
      plugViewerColor: null,
    };
    this.journal(bike.id, `Bought: ${listing.title}`, `Seller said: "${listing.sellerBlurb}"`, "observation");
    this.notice(`Bought the ${bike.nickname} for $${listing.price}! Time to find out what's wrong with it.`, "green");
    this.commit({ persist: true });
    this.syncLoop();
    return true;
  };

  startRide = (routeId: RouteId): void => {
    this.ensureInit();
    const route = getRouteById(routeId);
    if (!route) return;
    const save = this.ui.save;
    if (save.rep < route.repRequired) {
      this.notice(`${route.name} unlocks at ${route.repRequired} Rep.`, "red");
      this.commit();
      return;
    }
    if (this.rideState && !this.rideState.finished) this.completeRide("aborted", { showSummary: false });
    this.haltStand();
    const bike = structuredClone(getActiveBike(save));
    this.rideState = createRideState(bike, route, {
      hasTach: save.upgrades.includes("gauge-tach"),
      hasChtGauge: save.upgrades.includes("gauge-cht"),
      hasStethoscope: save.upgrades.includes("tool-stethoscope"),
      seed: (save.seed ^ Math.imul(save.stats.totalRides + 1, 2654435761) ^ Math.imul(++this.rideNonce, 40503)) >>> 0,
    });
    this.rideInput = { ...NEUTRAL_INPUT };
    this.pendingKick = false;
    this.pendingPedal = false;
    this.pendingSwerve = null;
    this.accumulator = 0;
    this.latestRide = buildRideSnapshot(this.rideState);
    this.patchUi({
      phase: "RIDE",
      lastRideSummary: null,
      lastToolReading: null,
      plugViewerColor: null,
      lastActionNotice: null,
    });
    this.ensureLoop();
  };

  setRideInput = (partial: Partial<RideInput>): void => {
    const { pedalPulse, kickstartPulse, swerveToggle, lane, ...held } = partial;
    const chokeChanged = held.choke !== undefined && held.choke !== this.rideInput.choke;
    this.rideInput = { ...this.rideInput, ...held };
    if (pedalPulse) this.triggerPedalPulse();
    if (kickstartPulse) this.pendingKick = true;
    if (lane === 0 || lane === 1) this.pendingSwerve = lane;
    else if (swerveToggle) this.pendingSwerve = "toggle";
    if (chokeChanged && this.rideState && !this.rideState.finished) {
      this.rideState.input.choke = this.rideInput.choke;
      this.latestRide = buildRideSnapshot(this.rideState);
      this.commit();
    }
  };

  swerveRide = (target?: 0 | 1): void => {
    this.pendingSwerve = target ?? "toggle";
  };

  toggleListenMode = (): void => {
    const ride = this.rideState;
    if (!ride?.opts.hasStethoscope) return;
    ride.listenMode = !ride.listenMode;
    this.latestRide = buildRideSnapshot(ride);
    this.commit();
  };

  /** Tap P: LPA pedal assist while riding — or, when broken down, start pedaling home. */
  triggerPedalPulse = (): void => {
    const ride = this.rideState;
    if (ride && !ride.finished && !ride.pedalingHome && !ride.engine.running) {
      if (ride.engine.stalled || ride.engine.seizedHard) this.startPedalingHome();
    }
    this.pendingPedal = true;
  };

  triggerKickstart = (): void => {
    this.pendingKick = true;
  };

  startPedalingHome = (): void => {
    const ride = this.rideState;
    if (!ride || ride.finished) return;
    const events: SimEvent[] = [];
    if (startPedalHome(ride, events)) {
      for (const ev of events) this.emitEvent(ev);
      this.latestRide = buildRideSnapshot(ride);
      if (this.ui.phase === "ROADSIDE") this.patchUi({ phase: "RIDE" });
      else this.commit();
      this.ensureLoop();
    }
  };

  callTowTruck = (): void => {
    const ride = this.rideState;
    if (!ride || ride.finished) return;
    if (this.ui.save.cash < TOW_COST) {
      this.notice(`The tow is $${TOW_COST} and you're short. Time to pedal.`, "red");
      this.commit();
      return;
    }
    this.completeRide(ride.engine.seizedHard ? "seize-crash" : "towed");
  };

  abortRideToGarage = (): void => {
    const ride = this.rideState;
    if (ride && !ride.finished) this.completeRide("aborted", { showSummary: false });
    this.rideState = null;
    this.latestRide = null;
    this.pendingSwerve = null;
    this.patchUi({ phase: "GARAGE" });
    this.syncLoop();
  };

  dismissRideSummary = (): void => {
    if (this.rideState?.finished) {
      this.rideState = null;
      this.latestRide = null;
    }
    const phase = this.ui.phase === "RIDE" || this.ui.phase === "ROADSIDE" ? "GARAGE" : this.ui.phase;
    this.patchUi({ lastRideSummary: null, phase });
    this.syncLoop();
  };

  // ── STAND TEST ──

  startStandTest = (): void => {
    this.ensureInit();
    if (this.standState) return;
    if (this.ui.phase !== "GARAGE") return;
    if (this.rideState && !this.rideState.finished) return;
    const save = this.ui.save;
    const bike = structuredClone(getActiveBike(save));
    this.standState = createStandTest(bike, {
      hasTach: save.upgrades.includes("gauge-tach"),
      hasChtGauge: save.upgrades.includes("gauge-cht"),
      hasStethoscope: save.upgrades.includes("tool-stethoscope"),
      seed: (save.seed ^ Math.imul(++this.standNonce, 2246822519) ^ 0x57a4d) >>> 0,
    });
    this.standInput = { ...NEUTRAL_STAND_INPUT };
    this.pendingStandKick = false;
    this.accumulator = 0;
    this.latestStand = buildStandSnapshot(this.standState);
    this.commit();
    this.syncLoop();
  };

  stopStandTest = (): void => {
    if (!this.standState) return;
    this.haltStand();
    this.commit();
    this.syncLoop();
  };

  setStandInput = (partial: Partial<StandTestInput>): void => {
    const { kickstartPulse, ...held } = partial;
    const prev = this.standInput;
    this.standInput = { ...prev, ...held };
    if (kickstartPulse) this.pendingStandKick = true;
    const toggled =
      (held.choke !== undefined && held.choke !== prev.choke) ||
      (held.killSwitch !== undefined && held.killSwitch !== prev.killSwitch);
    if (toggled && this.standState) {
      this.standState.input = { ...this.standInput, kickstartPulse: false };
      this.latestStand = buildStandSnapshot(this.standState);
      this.commit();
    }
  };

  kickStandTest = (): void => {
    if (!this.standState) this.startStandTest();
    if (!this.standState) return;
    this.pendingStandKick = true;
    this.syncLoop();
  };

  setRunnerPlaying = (playing: boolean): void => {
    this.ensureInit();
    const next = playing && this.ui.phase === "RUNNER";
    if (next === this.ui.runnerPlaying) return;
    this.patchUi({ runnerPlaying: next });
  };

  completeRunnerRun = (result: RunnerRunResult): void => {
    this.ensureInit();
    // The run is over no matter what happens below.
    this.ui = { ...this.ui, runnerPlaying: false };
    const { summary: rawSummary } = result;
    const save = this.ui.save;
    // B13: the bike may be gone (e.g. save reset mid-run) — never bill another bike.
    const current = save.bikes.find((b) => b.id === rawSummary.bikeId);
    if (!current) {
      this.commit();
      return;
    }

    const counted = rawSummary.distanceM > 30;
    const breakdown = rawSummary.endReason === "seized" || rawSummary.endReason === "stalled";
    const nextTotalRides = save.stats.totalRides + (counted ? 1 : 0);

    // G5: Runner Rep only for new personal-best distance bands (or the first real run).
    const prevBest = save.runnerBestDistanceM ?? 0;
    const dist = rawSummary.distanceM;
    const isNewBestDistance = dist > prevBest && dist > 0;
    const bandsCrossed = Math.max(0, Math.floor(dist / RUNNER_REP_BAND_M) - Math.floor(prevBest / RUNNER_REP_BAND_M));
    const firstMilestone = prevBest < RUNNER_FIRST_REP_M && dist >= RUNNER_FIRST_REP_M;
    const repEarned = bandsCrossed > 0 || firstMilestone ? Math.max(0, rawSummary.repEarned) : 0;
    const summary: RunnerRunSummary = { ...rawSummary, repEarned, isNewBestDistance };

    const bike = structuredClone(current);
    bike.odometerM += result.odometerDeltaM;
    applyWear(bike, result.wearDelta, result.odometerDeltaM);
    if (result.plugColor) bike.lastPlugColor = result.plugColor;
    // Road-tested verdict from the run (traffic wipeouts aren't the engine's fault).
    if (counted || breakdown) {
      const symptomNotes = summary.notes.filter((n) => !/ran clean/i.test(n));
      const ranClean =
        summary.cleanTuneBonus !== undefined && summary.distanceM >= 150
          ? summary.cleanTuneBonus
          : symptomNotes.length === 0;
      const actingUp = breakdown || result.seizesSaved > 0 || !ranClean;
      bike.verdict = actingUp ? "acting-up" : "ran-clean";
    }
    reconcileFaults(bike, Date.now());
    // Long, hard Runner sessions wear things out just like Tuning Rides.
    if (summary.distanceM > RUNNER_FAULT_MIN_M && result.pushedHard) {
      const rng = mulberry32((save.seed + nextTotalRides * 7919 + summary.distanceM * 31 + 53) >>> 0);
      injectRideFault(
        bike,
        rng,
        { totalRides: nextTotalRides, pushedHard: true, hotSeconds: result.hotSeconds },
        Date.now(),
      );
    }
    this.replaceBike(bike);

    const stats = {
      ...this.ui.save.stats,
      totalRides: nextTotalRides,
      totalBreakdowns: this.ui.save.stats.totalBreakdowns + (breakdown ? 1 : 0),
      seizesSaved: this.ui.save.stats.seizesSaved + result.seizesSaved,
    };

    this.ui = {
      ...this.ui,
      save: {
        ...this.ui.save,
        cash: Math.max(0, this.ui.save.cash + summary.cashEarned),
        rep: this.ui.save.rep + summary.repEarned,
        runnerBestDistanceM: Math.max(prevBest, dist),
        stats,
      },
      lastRunnerSummary: summary,
    };

    if (result.seizesSaved > 0) this.awardBadge("clutch-hero");
    // B2: Treatland turbo boosts don't count toward Full Send.
    if ((summary.engineTopSpeedMph ?? summary.topSpeedMph) >= FULL_SEND_MPH) this.awardBadge("full-send");

    if (summary.distanceM > 20 || breakdown) {
      const reasonLabel: Record<RunnerRunSummary["endReason"], string> = {
        crashed: "Wiped out in traffic",
        seized: "Seized top end",
        stalled: "Stalled out on the street",
        aborted: "Pulled off the street",
      };
      const body = [
        `Score ${summary.score.toLocaleString()} (${summary.distanceM}m, top ${summary.topSpeedMph} mph, x${summary.maxCombo} combo).`,
        ...summary.notes,
      ].join(" ");
      this.journal(summary.bikeId, `Street Runner: ${reasonLabel[summary.endReason]}`, body, "observation");
    }

    this.commit({ persist: true });
  };

  dismissRunnerSummary = (): void => {
    this.patchUi({ lastRunnerSummary: null });
  };

  resetSave = (): void => {
    this.stopLoop();
    clearSave();
    this.rideState = null;
    this.latestRide = null;
    this.pendingSwerve = null;
    this.haltStand();
    this.initialized = true;
    this.patchUi(
      {
        phase: "GARAGE",
        save: createStarterSave(),
        lastRideSummary: null,
        lastRunnerSummary: null,
        selectedTool: "visual",
        lastToolReading: null,
        plugViewerColor: null,
        lastActionNotice: { text: "Fresh start. Another Craigslist Maxi that 'ran when parked'.", tone: "cyan" },
        runnerPlaying: false,
      },
      { persist: true },
    );
  };

  getInstalledSlotPartId = (slot: PartSlot): string | undefined => {
    this.ensureInit();
    const bike = getActiveBike(this.ui.save);
    return slot === "belt" ? bike.parts.belt : bike.parts[slot];
  };

  /** Bound action table handed to React via useSimStore(). */
  readonly actions: SimStoreActions = {
    setPhase: this.setPhase,
    selectBike: this.selectBike,
    selectTool: this.selectTool,
    runToolOnHotspot: this.runToolOnHotspot,
    closePlugViewer: this.closePlugViewer,
    clearNotice: this.clearNotice,
    installPart: this.installPart,
    setMainJet: this.setMainJet,
    setNeedleClip: this.setNeedleClip,
    setIdleScrew: this.setIdleScrew,
    toggleKillSwitch: this.toggleKillSwitch,
    addPremixOil: this.addPremixOil,
    cleanAirFilter: this.cleanAirFilter,
    cleanCarburetor: this.cleanCarburetor,
    clearFaultlessTestCheck: this.clearFaultlessTestCheck,
    startStandTest: this.startStandTest,
    stopStandTest: this.stopStandTest,
    setStandInput: this.setStandInput,
    kickStandTest: this.kickStandTest,
    buyPart: this.buyPart,
    buyUpgrade: this.buyUpgrade,
    buyCraigslistBike: this.buyCraigslistBike,
    startRide: this.startRide,
    setRideInput: this.setRideInput,
    swerveRide: this.swerveRide,
    toggleListenMode: this.toggleListenMode,
    triggerPedalPulse: this.triggerPedalPulse,
    triggerKickstart: this.triggerKickstart,
    startPedalingHome: this.startPedalingHome,
    callTowTruck: this.callTowTruck,
    abortRideToGarage: this.abortRideToGarage,
    dismissRideSummary: this.dismissRideSummary,
    setRunnerPlaying: this.setRunnerPlaying,
    completeRunnerRun: this.completeRunnerRun,
    dismissRunnerSummary: this.dismissRunnerSummary,
    resetSave: this.resetSave,
    getInstalledSlotPartId: this.getInstalledSlotPartId,
  };
}

export const simStore = new SimStoreImpl();
export type SimStore = typeof simStore;

export function useSimStore(): SimAppSnapshot & SimStoreActions {
  const snapshot = useSyncExternalStore(simStore.subscribe, simStore.getSnapshot, simStore.getServerSnapshot);
  return useMemo(() => ({ ...snapshot, ...simStore.actions }), [snapshot]);
}
