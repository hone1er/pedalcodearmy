// 1D ride dynamics for Ran When Parked.
//
// Rider + moped along a route's grade profile: engine drive force, aero drag
// (tuck reduces it), rolling resistance, gravity, brakes, LPA pedal assist,
// Pedal Home mode, stoplights (idle test), potholes (coffee spill), comic
// captions, and a telemetry snapshot builder that contains ZERO fault IDs.

import { type Rng, mulberry32, nextRange } from "../core/rng";
import type {
  ComicCaption,
  OwnedBike,
  PlugColor,
  RideInput,
  RideSummary,
  RideTelemetrySnapshot,
  RouteMedal,
  RouteSpec,
  SimEvent,
} from "../contract";
import {
  type BikeProfile,
  type EngineState,
  SEIZE_RESTART_CHT_C,
  attemptKickstart,
  buildBikeProfile,
  createEngineState,
  rideEndPlugColor,
  stepEngine,
} from "../engine/engine-sim";
import { ROUTE_PAR_SEC, type RoutePothole, generatePotholes, segmentAt } from "./routes";

export const MPS_TO_MPH = 2.236936;
export const TOW_COST = 35;
const G = 9.81;
const AIR_DENSITY = 1.2;
const TUCK_DRAG_MULT = 0.76;
const BRAKE_FORCE_N = 750;
const STOPLIGHT_DECEL = 3.2;
const COFFEE_BONUS_CASH = 15;
/** Below this speed (or with the brake held) a pothole only jostles the cup. */
const POTHOLE_CAREFUL_MPH = 14;

/**
 * Optional V2 engine/profile fields added by the core engine lane. Read through
 * these anchored shapes so this file compiles before and after they land.
 */
interface GearReadout {
  rpm: number;
  currentGear?: number;
  gearShiftPulse?: boolean;
}
interface AirFilterReadout {
  maxRpm: number;
  airFilterVisual?: string;
}

function readGear(eng: GearReadout): { currentGear?: 1 | 2; gearShiftPulse?: boolean } {
  const g = eng.currentGear;
  return {
    ...(g === 1 || g === 2 ? { currentGear: g } : {}),
    ...(typeof eng.gearShiftPulse === "boolean" ? { gearShiftPulse: eng.gearShiftPulse } : {}),
  };
}

function readAirFilterVisual(p: AirFilterReadout): "stock" | "performance" | "race" | undefined {
  const v = p.airFilterVisual;
  return v === "stock" || v === "performance" || v === "race" ? v : undefined;
}

export interface Stoplight {
  positionM: number;
  state: "pending" | "red" | "green";
  redSec: number;
  greenHoldSec: number;
}

export interface RideOptions {
  hasTach: boolean;
  hasChtGauge: boolean;
  hasStethoscope: boolean;
  seed: number;
}

export interface RideState {
  route: RouteSpec;
  bike: OwnedBike;
  profile: BikeProfile;
  engine: EngineState;
  rng: Rng;
  opts: RideOptions;

  input: RideInput;
  distanceM: number;
  speedMps: number;
  elapsedSec: number;
  gradePct: number;
  landmark: string | null;

  stamina: number;
  pedalTimerSec: number;
  pedalingHome: boolean;
  pedalHomeRemainingM: number;
  listenMode: boolean;

  stoplights: Stoplight[];
  atStoplight: boolean;
  stoplightRedSec: number;

  coffeeTempPct: number | null;
  coffeeSpillPct: number | null;
  lastPotholeSec: number;
  /** Real, pre-generated pothole world positions (deterministic per seed). */
  potholes: RoutePothole[];

  captions: ComicCaption[];
  captionSeq: number;
  captionCooldowns: Record<string, number>;
  symptomTimers: Record<string, number>;

  autoKicksLeft: number;
  autoKickTimer: number;
  everStarted: boolean;

  topSpeedMph: number;
  finished: boolean;
  outcome: RideSummary["outcome"] | null;
  distancePedaledM: number;
  notes: string[];
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export const NEUTRAL_INPUT: RideInput = {
  throttle: 0,
  brake: false,
  tuck: false,
  choke: false,
  pedalPulse: false,
  clutch: false,
  killSwitch: false,
  kickstartPulse: false,
};

export function createRideState(bike: OwnedBike, route: RouteSpec, opts: RideOptions): RideState {
  const rng = mulberry32(opts.seed);
  const profile = buildBikeProfile(bike);
  const stoplights: Stoplight[] = route.segments
    .filter((s) => s.hasStoplight)
    .map((s) => ({
      positionM: s.endM - 15,
      state: "pending",
      redSec: nextRange(rng, 4, 7),
      greenHoldSec: 0,
    }));
  const first = route.segments[0];
  return {
    route,
    bike,
    profile,
    engine: createEngineState(profile),
    rng,
    opts,
    input: { ...NEUTRAL_INPUT },
    distanceM: 0,
    speedMps: 0,
    elapsedSec: 0,
    gradePct: first?.gradePct ?? 0,
    landmark: first?.landmark ?? null,
    stamina: 100,
    pedalTimerSec: 0,
    pedalingHome: false,
    pedalHomeRemainingM: 0,
    listenMode: false,
    stoplights,
    atStoplight: false,
    stoplightRedSec: 0,
    coffeeTempPct: route.hasCoffeeCup ? 100 : null,
    coffeeSpillPct: route.hasCoffeeCup ? 0 : null,
    lastPotholeSec: -10,
    potholes: generatePotholes(route, opts.seed),
    captions: [],
    captionSeq: 1,
    captionCooldowns: {},
    symptomTimers: {},
    autoKicksLeft: 3,
    autoKickTimer: 0.6,
    everStarted: false,
    topSpeedMph: 0,
    finished: false,
    outcome: null,
    distancePedaledM: 0,
    notes: [],
  };
}

/** Rebuild the bike profile mid-ride (e.g. a roadside plug swap). */
export function refreshRideBike(state: RideState, bike: OwnedBike): void {
  state.bike = bike;
  state.profile = buildBikeProfile(bike);
}

export function addCaption(
  state: RideState,
  events: SimEvent[],
  text: string,
  tone: ComicCaption["tone"],
  key?: string,
  cooldownSec = 999,
  ttlMs = 3800,
): void {
  if (key) {
    const until = state.captionCooldowns[key] ?? -1;
    if (state.elapsedSec < until) return;
    state.captionCooldowns[key] = state.elapsedSec + cooldownSec;
  }
  state.captions.push({ id: state.captionSeq++, text, tone, ttlMs, maxTtlMs: ttlMs });
  if (state.captions.length > 6) state.captions.shift();
  events.push({ type: "caption", text, tone });
}

/** Record a diegetic observation for the ride summary / journal (once per key). */
function observe(state: RideState, note: string): void {
  if (!state.notes.includes(note)) state.notes.push(note);
}

function sustained(state: RideState, key: string, active: boolean, dt: number, needSec: number): boolean {
  const t = active ? (state.symptomTimers[key] ?? 0) + dt : 0;
  state.symptomTimers[key] = t;
  return t >= needSec;
}

/** Start Pedal Home mode (only when stalled or seized). */
export function startPedalHome(state: RideState, events: SimEvent[]): boolean {
  const e = state.engine;
  if (state.finished || state.pedalingHome) return false;
  if (e.running && !e.seizeActive) return false;
  state.pedalingHome = true;
  e.seizeActive = false;
  e.seizeWindowMs = 0;
  const remaining = state.route.lengthM - state.distanceM;
  const home = Math.min(state.distanceM, remaining);
  state.pedalHomeRemainingM = clamp(Math.round(home * 0.5), 120, 400);
  addCaption(state, events, "Pedal power! Tap [P] in rhythm to get it home.", "cyan");
  return true;
}

/**
 * Advance the ride by `dt` seconds. Consumes one-shot pulses in `input`.
 * Returns the SimEvents emitted this step.
 */
export function stepRide(state: RideState, input: RideInput, dt: number): SimEvent[] {
  const events: SimEvent[] = [];
  if (state.finished) return events;
  const { route, profile, rng } = state;
  const eng = state.engine;
  state.input = { ...input, pedalPulse: false, kickstartPulse: false };
  state.elapsedSec += dt;

  // ── Captions TTL ──
  for (const c of state.captions) c.ttlMs -= dt * 1000;
  state.captions = state.captions.filter((c) => c.ttlMs > 0);

  // ── Route position ──
  const seg = segmentAt(route, state.distanceM);
  state.gradePct = seg?.gradePct ?? 0;
  if (seg?.landmark && seg.landmark !== state.landmark) {
    state.landmark = seg.landmark;
  }

  // ── Auto kick at the start of the ride ──
  let kick = input.kickstartPulse;
  let autoKick = false;
  if (!state.everStarted && !state.pedalingHome && state.autoKicksLeft > 0 && !eng.running) {
    state.autoKickTimer -= dt;
    if (state.autoKickTimer <= 0) {
      kick = true;
      autoKick = true;
      state.autoKicksLeft -= 1;
      state.autoKickTimer = 0.8;
    }
  }
  // Auto-kicks never fire while pedaling home, but a manual kick can bring it back to life.
  if (state.pedalingHome && !input.kickstartPulse) kick = false;

  // ── Engine ──
  const wasRunning = eng.running;
  const tuning = state.bike.tuning;
  const engineInput = {
    throttle: state.pedalingHome ? 0 : clamp(input.throttle, 0, 1),
    choke: input.choke,
    clutch: input.clutch,
    killSwitch: input.killSwitch,
    kickstart: false,
  };
  if (kick && !eng.running && !eng.seizedHard) {
    // The opening kicks are a real rider's cold start: choke on if the engine is cold.
    const kickChoke = input.choke || (autoKick && eng.chtC < 40);
    const started = attemptKickstart(eng, profile, tuning, kickChoke, rng, events, input.killSwitch);
    if (started) {
      state.everStarted = true;
      if (state.pedalingHome) {
        state.pedalingHome = false;
        state.pedalHomeRemainingM = 0;
        addCaption(state, events, "It caught! Back on the motor.", "gold", "pedal-restart", 5);
      }
      if (!wasRunning && state.elapsedSec < 5) {
        addCaption(state, events, "KICK! It fires up!", "gold", "kick-ok-start");
      }
    } else if (eng.seizeSavedPending && eng.chtC > SEIZE_RESTART_CHT_C) {
      addCaption(
        state,
        events,
        "Cylinder is still too hot — let it cool down a few seconds!",
        "orange",
        "kick-too-hot",
        4,
      );
    } else if (input.killSwitch || profile.effects.killSwitchOn) {
      addCaption(state, events, "No spark — check your kill switch!", "orange", "kick-kill", 4);
    } else if (eng.fuelBowlPct < 8) {
      addCaption(state, events, "Kicking dry… fuel bowl's empty.", "orange", "kick-dry", 4);
    } else if (state.autoKicksLeft === 0 || state.everStarted) {
      addCaption(
        state,
        events,
        eng.chtC < 40 ? "It won't catch… try the choke [C] and kick [R]." : "Kick, kick… nothing. Hmm.",
        "white",
        "kick-fail",
        5,
      );
    }
  }
  stepEngine(eng, profile, tuning, engineInput, { speedMps: state.speedMps }, dt, rng, events);
  if (eng.running) state.everStarted = true;

  // ── Pedaling (LPA / Pedal Home) ──
  if (input.pedalPulse) {
    if (state.stamina > 3) {
      state.pedalTimerSec = 0.45;
      state.stamina = clamp(state.stamina - (state.pedalingHome ? 2.2 : 4), 0, 100);
    }
  }
  const pedaling = state.pedalTimerSec > 0;
  state.pedalTimerSec = Math.max(0, state.pedalTimerSec - dt);
  if (!pedaling) state.stamina = clamp(state.stamina + 6 * dt, 0, 100);
  // Human legs are power-limited (~250 W burst): strong at walking pace, weak at 25 mph.
  const legW = state.pedalingHome ? 300 : 240;
  const pedalForce = pedaling
    ? Math.min(state.pedalingHome ? 220 : 110, legW / Math.max(1.2, state.speedMps)) * (state.stamina < 10 ? 0.55 : 1)
    : 0;

  // ── Forces ──
  const v = state.speedMps;
  const m = profile.massKg;
  const cdA = profile.cdA * (input.tuck ? TUCK_DRAG_MULT : 1);
  const drag = 0.5 * AIR_DENSITY * cdA * v * v;
  const rolling = v > 0.05 ? profile.crr * m * G : 0;
  // Pedaling home you pick the gentle way back — grade doesn't fight you.
  const gravity = state.pedalingHome ? 0 : m * G * (state.gradePct / 100);
  const brake = input.brake && v > 0.01 ? BRAKE_FORCE_N : 0;
  const drive = state.pedalingHome ? 0 : eng.driveForceN;
  const net = drive + pedalForce - drag - rolling - gravity - brake;
  let newV = v + (net / m) * dt;
  // Seized piston locks the rear wheel — until you pull the clutch lever and pedal home.
  if (eng.wheelLocked && !state.pedalingHome) newV = Math.max(0, v - 6.5 * dt);
  // Rolling resistance/brake can't push you backwards; a stopped bike on a hill is held.
  newV = Math.max(0, newV);
  if (v <= 0.05 && net < 0) newV = 0;

  // ── Stoplights (auto-stop at red) ──
  state.atStoplight = false;
  state.stoplightRedSec = 0;
  if (!state.pedalingHome) {
    for (const light of state.stoplights) {
      const d = light.positionM - state.distanceM;
      if (light.state === "pending" && d < 70 && d > -1) {
        light.state = "red";
        addCaption(state, events, "Red light ahead.", "white", `red-${light.positionM}`);
      }
      if (light.state === "red") {
        const maxV = Math.sqrt(2 * STOPLIGHT_DECEL * Math.max(0, d - 1.5));
        if (newV > maxV) newV = maxV;
        if (d < 50 && d > -1) {
          state.stoplightRedSec = Math.max(0, light.redSec);
        }
        if (d < 8 && newV < 0.4) {
          newV = 0;
          state.atStoplight = true;
          light.redSec -= dt;
          state.stoplightRedSec = Math.max(0, light.redSec);
          if (light.redSec <= 0) {
            light.state = "green";
            light.greenHoldSec = 1.6;
            state.stoplightRedSec = 0;
            addCaption(state, events, "GREEN!", "gold", `green-${light.positionM}`);
          }
        }
      } else if (light.state === "green" && light.greenHoldSec > 0) {
        light.greenHoldSec = Math.max(0, light.greenHoldSec - dt);
        state.atStoplight = true;
        state.stoplightRedSec = 0;
      }
    }
  }

  // Pedal-home creep: you can always push forward a bit while pedaling
  state.speedMps = newV;
  const ds = newV * dt;
  const prevDistanceM = state.distanceM;
  state.distanceM = Math.min(route.lengthM, state.distanceM + ds);
  if (state.pedalingHome) {
    state.pedalHomeRemainingM = Math.max(0, state.pedalHomeRemainingM - ds);
    state.distancePedaledM += ds;
  }
  const mph = newV * MPS_TO_MPH;
  state.topSpeedMph = Math.max(state.topSpeedMph, mph);

  // ── Real potholes & coffee (skill-based: brake or slow down before them) ──
  if (state.distanceM > prevDistanceM) {
    for (const hole of state.potholes) {
      if (hole.hit) continue;
      if (hole.positionM > state.distanceM) break;
      if (hole.positionM <= prevDistanceM) continue;
      hole.hit = true;
      state.lastPotholeSec = state.elapsedSec;
      events.push({ type: "pothole-bump" });
      if (state.coffeeSpillPct !== null) {
        const careful = input.brake || mph < POTHOLE_CAREFUL_MPH;
        const spill = (1.5 + mph * 0.18) * (careful ? 0.25 : 1);
        state.coffeeSpillPct = clamp(state.coffeeSpillPct + spill, 0, 100);
        if (careful) {
          addCaption(state, events, "Braked for pothole — coffee saved!", "cyan", "spill-saved", 4);
        } else if (spill > 4) {
          addCaption(state, events, `Pothole! Coffee sloshes (-${Math.round(spill)}%)`, "white", "spill", 4);
        }
      }
    }
  }
  if (state.coffeeTempPct !== null) {
    state.coffeeTempPct = clamp(state.coffeeTempPct - 0.3 * dt, 0, 100);
    if (input.brake && v > 6 && state.coffeeSpillPct !== null) {
      state.coffeeSpillPct = clamp(state.coffeeSpillPct + 0.8 * dt, 0, 100);
    }
  }

  // ── Symptom captions (diegetic only) ──
  narrateSymptoms(state, events, dt, wasRunning);

  // ── Finish conditions ──
  if (state.pedalingHome && (state.pedalHomeRemainingM <= 0 || state.distanceM >= route.lengthM)) {
    state.finished = true;
    state.outcome = "pedaled-home";
    addCaption(state, events, "Made it home on leg power. Respect.", "gold");
  } else if (!state.pedalingHome && state.distanceM >= route.lengthM) {
    state.finished = true;
    state.outcome = "finished";
  }
  return events;
}

function narrateSymptoms(state: RideState, events: SimEvent[], dt: number, wasRunning: boolean): void {
  const eng = state.engine;
  const thr = state.input.throttle;

  for (const ev of [...events]) {
    switch (ev.type) {
      case "detonation":
        addCaption(state, events, "PING-PING-PING! That's detonation — back off!", "red", "det", 8);
        break;
      case "seize-warning":
        addCaption(state, events, "It's getting tight and hot… EASE OFF or pull the clutch!", "red", "seize-warn", 6);
        break;
      case "seize-saved":
        addCaption(state, events, "CLUTCH SAVE! Let it cool down before you kick it.", "cyan");
        break;
      case "seize-crash":
        addCaption(state, events, "SEIZED! The rear wheel locks and skids!", "red");
        break;
      case "stalled":
        if (ev.reason === "fuel") {
          addCaption(state, events, "Sputter… cough… it died. Sounded starved.", "orange", "stall-fuel", 5);
          observe(state, "Died under load — sounded fuel-starved.");
        } else if (ev.reason === "idle") {
          addCaption(state, events, "It stumbled and died at idle.", "orange", "stall-idle", 5);
          observe(state, "Stalled at idle.");
        }
        else if (ev.reason === "plug-chop")
          addCaption(state, events, "PLUG CHOP! Killed it clean at full throttle — go read that plug.", "cyan");
        else if (ev.reason === "kill-switch")
          addCaption(
            state,
            events,
            "Not enough throttle for a clean chop — hold it wide open!",
            "cyan",
            "chop-low-thr",
            4,
          );
        else if (ev.reason === "spark") addCaption(state, events, "It just cut out.", "orange", "stall-spark", 5);
        break;
      default:
        break;
    }
  }

  if (!eng.running) return;
  if (!wasRunning) return;

  if (sustained(state, "fourstroke", eng.misfirePattern === "alternate", dt, 1.2)) {
    addCaption(state, events, "BLUB-BLUB-BLUB… it's four-stroking and fogging the street blue.", "orange", "fourstroke", 25);
    observe(state, "Four-stroked (blub-blub) under load with thick blue-grey smoke.");
  }
  if (sustained(state, "highrpm", eng.misfirePattern === "high-rpm", dt, 0.8)) {
    addCaption(state, events, "It breaks up and stutters when you wring it out.", "orange", "highrpm", 25);
    observe(state, "Broke up and stuttered at high rpm.");
  }
  if (sustained(state, "random", eng.misfirePattern === "random" && eng.fuelBowlPct > 35, dt, 1.2)) {
    addCaption(state, events, "Stutter… stumble… it's missing at random.", "orange", "random", 25);
    observe(state, "Random stutter and misfires, even at steady throttle.");
  }
  if (sustained(state, "starve", eng.fuelBowlPct < 35, dt, 0.5)) {
    addCaption(state, events, "It's surging and sputtering under load…", "orange", "starve", 20);
    observe(state, "Surged and sputtered after a stretch of full throttle, like it was starving.");
  }
  if (sustained(state, "lean", eng.leanTone > 0.5 && thr > 0.5, dt, 2)) {
    addCaption(state, events, "That exhaust note sounds thin and angry.", "orange", "lean", 30);
    observe(state, "Thin, angry exhaust note at full throttle.");
  }
  if (sustained(state, "slip", eng.clutchSlip > 0.25, dt, 1)) {
    addCaption(state, events, "Revs scream but you're barely picking up speed…", "orange", "slip", 25);
    observe(state, "Revs flared without the speed following, especially uphill.");
  }
  if (sustained(state, "hiidle", thr < 0.05 && eng.rpm > state.profile.idleRpm + 700 && !state.input.choke, dt, 2.5)) {
    addCaption(state, events, "The idle is hanging high and hunting up and down.", "orange", "hiidle", 30);
    observe(state, "Idle hung high and hunted up and down.");
  }
  if (sustained(state, "pipe", eng.powerbandActive, dt, 0.25)) {
    addCaption(state, events, "ON THE PIPE! BRAAAAP!", "gold", "pipe", 15);
  }
  if (sustained(state, "dry", !state.profile.effects.premix && thr > 0.3, dt, 6)) {
    addCaption(state, events, "Weirdly little smoke… and it sounds dry and tinny.", "orange", "dry", 30);
    observe(state, "Almost no exhaust smoke; sounded dry and tinny.");
  }
}

// ── TELEMETRY ──────────────────────────────────────────────────────────────

/** Closest upcoming (or just-reached) stoplight within -12 m..+90 m of the rider. */
function nearestStoplight(state: RideState): Stoplight | null {
  let best: Stoplight | null = null;
  let bestAbs = Infinity;
  for (const light of state.stoplights) {
    const d = light.positionM - state.distanceM;
    if (d < -12 || d > 90) continue;
    // Prefer the light ahead; a light just passed only counts while it's still holding you.
    const score = d >= 0 ? d : 90 - d;
    if (score < bestAbs) {
      bestAbs = score;
      best = light;
    }
  }
  return best;
}

export function buildRideSnapshot(state: RideState): RideTelemetrySnapshot {
  const eng = state.engine;
  const p = state.profile;
  const input = state.input;
  const light = nearestStoplight(state);
  const upcomingPotholesM: number[] = [];
  let nextPotholeM: number | null = null;
  for (const hole of state.potholes) {
    const d = hole.positionM - state.distanceM;
    if (d < -15) continue;
    if (d > 75) break;
    upcomingPotholesM.push(hole.positionM);
    if (!hole.hit && d >= 0 && nextPotholeM === null) nextPotholeM = d;
  }
  const airFilterVisual = readAirFilterVisual(p);
  return {
    active: !state.finished,
    routeId: state.route.id,
    routeName: state.route.name,
    timeOfDay: state.route.timeOfDay,
    bikeMake: state.bike.make,
    bikeColorHex: state.bike.colorHex,
    bikeAccentHex: state.bike.accentHex,
    exhaustVisual: p.exhaustVisual,
    cylinderVisual: p.cylinderVisual,
    ...(airFilterVisual ? { airFilterVisual } : {}),
    distanceM: state.distanceM,
    routeLengthM: state.route.lengthM,
    speedMph: state.speedMps * MPS_TO_MPH,
    gradePct: state.gradePct,
    landmark: state.landmark,
    atStoplight: state.atStoplight,
    stoplightRedSec: state.stoplightRedSec,
    nextStoplightM: light ? light.positionM : null,
    nextStoplightState: light ? light.state : null,
    upcomingPotholesM,
    nextPotholeM,
    throttle: input.throttle,
    brake: input.brake,
    tuck: input.tuck,
    choke: input.choke,
    clutchPulled: input.clutch,
    pedaling: state.pedalTimerSec > 0,
    stamina: state.stamina,
    engineRunning: eng.running,
    rpm: eng.rpm,
    maxRpm: p.maxRpm,
    hasTach: state.opts.hasTach,
    hasChtGauge: state.opts.hasChtGauge,
    hasStethoscope: state.opts.hasStethoscope,
    listenMode: state.listenMode,
    chtC: eng.chtC,
    powerbandActive: eng.powerbandActive,
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
    ...readGear(eng),
    pedalingHome: state.pedalingHome,
    pedalHomeRemainingM: state.pedalHomeRemainingM,
    coffeeTempPct: state.coffeeTempPct,
    coffeeSpillPct: state.coffeeSpillPct,
    elapsedSec: state.elapsedSec,
    captions: state.captions.map((c) => ({ ...c })),
  };
}

// ── RIDE RESULT ────────────────────────────────────────────────────────────

export interface RideResult {
  summary: RideSummary;
  wearDelta: OwnedBike["wear"];
  /** Plug condition after this ride (null = never saw real load → unchanged). */
  plugColor: PlugColor | null;
  pushedHard: boolean;
  hotSeconds: number;
  odometerDeltaM: number;
}

export function finalizeRide(
  state: RideState,
  outcome: RideSummary["outcome"] = state.outcome ?? "aborted",
): RideResult {
  const eng = state.engine;
  const route = state.route;
  const km = state.distanceM / 1000;
  let cash = 0;
  let rep = 0;
  let towCost = 0;
  let bonusText: string | undefined;
  const notes = [...state.notes];

  if (outcome === "finished") {
    cash = route.rewardCash;
    rep = route.rewardRep;
    if (state.coffeeTempPct !== null && state.coffeeSpillPct !== null) {
      if (state.coffeeTempPct >= 45 && state.coffeeSpillPct <= 35) {
        cash += COFFEE_BONUS_CASH;
        bonusText = `Hot & unspilled coffee bonus +$${COFFEE_BONUS_CASH}`;
      } else if (state.coffeeSpillPct > 35) {
        notes.push("Half the coffee ended up on your jeans.");
      } else {
        notes.push("The coffee arrived lukewarm.");
      }
    }
  } else if (outcome === "pedaled-home") {
    cash = 15;
    rep = 5;
    notes.push("Pedaled it home — no tow bill, plus $15 for finishing the hustle on foot.");
  } else if (outcome === "towed" || outcome === "seize-crash") {
    towCost = TOW_COST;
    notes.push(`Tow truck bill: $${TOW_COST}.`);
  }
  if (bonusText) notes.push(bonusText);
  if (eng.detonations > 0) notes.push(`Heard ${eng.detonations} detonation ping${eng.detonations === 1 ? "" : "s"}.`);
  if (eng.seizesSaved > 0) notes.push("Saved a seize with the clutch!");
  if (eng.seizeCrashes > 0) notes.push("The engine seized and locked the rear wheel.");

  const plugColor = rideEndPlugColor(eng, state.profile);
  const wearDelta: OwnedBike["wear"] = {
    plugFouling: eng.plugFoulGain,
    pistonScore: eng.detonations * 0.5 + eng.seizesSaved * 20 + eng.seizeCrashes * 65 + eng.hotSec * 0.05,
    clutchWear: km * 1.5 + eng.slipSec * 1.2,
    fuelFilterClog: km * 2.5,
    gasketWear: km * 2,
    airFilterDirt: km * 1.4,
  };

  const medalsEarned: RouteMedal[] = [];
  if (outcome === "finished") {
    medalsEarned.push("finished");
    if (state.elapsedSec <= ROUTE_PAR_SEC[route.id]) medalsEarned.push("speed");
    if (eng.maxChtC < 190 && state.opts.hasChtGauge) medalsEarned.push("cool-head");
    const hotCoffee = route.hasCoffeeCup
      ? state.coffeeTempPct !== null &&
        state.coffeeSpillPct !== null &&
        state.coffeeTempPct >= 45 &&
        state.coffeeSpillPct <= 35
      : state.notes.length === 0 && eng.detonations === 0 && eng.seizesSaved === 0;
    if (hotCoffee) medalsEarned.push("hot-coffee");
  }

  const summary: RideSummary = {
    routeId: route.id,
    completed: outcome === "finished",
    outcome,
    distanceM: Math.round(state.distanceM),
    topSpeedMph: Math.round(state.topSpeedMph * 10) / 10,
    maxChtC: Math.round(eng.maxChtC),
    cashEarned: cash,
    repEarned: rep,
    towCost,
    plugChopCaptured: eng.plugChopColor !== null,
    notes,
    ...(outcome === "finished" ? { medalsEarned } : {}),
  };
  return {
    summary,
    wearDelta,
    plugColor,
    // Pushing hard = cooking the top end, not merely holding the throttle open.
    pushedHard: eng.hotSec > 15 || eng.detonations > 3 || eng.seizesSaved + eng.seizeCrashes > 0,
    hotSeconds: eng.hotSec,
    odometerDeltaM: state.distanceM,
  };
}

export function missionCompleteEvent(result: RideResult): SimEvent {
  const bonus = result.summary.notes.find((n) => n.startsWith("Hot & unspilled"));
  return {
    type: "mission-complete",
    cash: result.summary.cashEarned,
    rep: result.summary.repEarned,
    ...(bonus ? { bonusText: bonus } : {}),
  };
}
