import type {
  FaultId,
  HotspotId,
  PartSlot,
  PlugColor,
  RouteId,
  ShopVendorId,
  SimBikeMake,
  ToolId,
  UpgradeId,
} from "./ids";

// ── PARTS & TUNING ────────────────────────────────────────────────────────

export interface PartSpec {
  id: string;
  name: string;
  slot: PartSlot;
  vendor: ShopVendorId;
  price: number;
  repRequired: number;
  compatibleMakes: SimBikeMake[] | "all";
  description: string;
  /** Optional real-world vendor link for "Buy the real one →" */
  realVendorUrl?: string;
  realVendorLabel?: string;
  /** Mechanical modifiers */
  jetSize?: number; // e.g., 52..88
  airflowMult?: number;
  torqueMult?: number;
  powerbandRpm?: number; // Optimal peak RPM
  maxRpmBonus?: number;
  coolingBonus?: number;
  sparkBonus?: number;
  compressionBonus?: number;
  fuelFlowRate?: number;
  clutchGrip?: number;
  visualTag?: "stock" | "performance" | "race";
}

export interface InstrumentSpec {
  id: UpgradeId;
  name: string;
  price: number;
  repRequired: number;
  description: string;
}

export interface BikeTuning {
  /** Main jet size installed (e.g., 56..86). Ideal depends on carb/pipe/kit. */
  mainJet: number;
  /** Needle clip position 1 (leanest) to 5 (richest), default 3 */
  needleClip: 1 | 2 | 3 | 4 | 5;
  /** Idle air screw turns out (0.5 to 3.0), default 1.5 */
  idleScrew: number;
  /** Premix oil added to tank? */
  hasPremixOil: boolean;
  /** Kill switch engaged? */
  killSwitchOn: boolean;
}

export interface BikeInstalledParts {
  "spark-plug": string;
  "main-jet": string;
  carburetor: string;
  exhaust: string;
  cylinder: string;
  "air-filter": string;
  "fuel-filter": string;
  ignition: string;
  "intake-gasket": string;
  clutch: string;
  belt?: string;
}

/** Internal hidden fault instance (NEVER exposed directly in UI SimSnapshot) */
export interface ActiveFault {
  id: FaultId;
  severity: number; // 0.4..1.0
  injectedAtMs: number;
  /** Optional note for post-fix confirmation */
  fixed?: boolean;
}

export interface OwnedBike {
  id: string;
  make: SimBikeMake;
  nickname: string;
  colorHex: string;
  accentHex: string;
  odometerM: number;
  parts: BikeInstalledParts;
  tuning: BikeTuning;
  /** Internal hidden faults — hidden from UI; only symptoms/tools reveal clues */
  faults: ActiveFault[];
  /** Accumulated wear (0..100) */
  wear: {
    plugFouling: number;
    pistonScore: number;
    clutchWear: number;
    fuelFilterClog: number;
    gasketWear: number;
  };
  /** Cached latest plug condition from last run / plug chop */
  lastPlugColor: PlugColor;
  /** How many non-fixing swaps happened since current fault started ("Parts Cannon") */
  wrongSwapsStreak: number;
}

// ── DIAGNOSTICS & JOURNAL ─────────────────────────────────────────────────

export interface ToolSpec {
  id: ToolId;
  name: string;
  shortLabel: string;
  description: string;
  validHotspots: HotspotId[];
  requiresStethoscope?: boolean;
}

export interface ToolReading {
  tool: ToolId;
  hotspot: HotspotId;
  headline: string;
  detail: string;
  severity: "ok" | "clue" | "danger";
  /** Optional visual metadata for Plug Viewer / Compression Gauge / Spark Tester */
  plugColor?: PlugColor;
  compressionPsi?: number;
  sparkQuality?: "fat-blue" | "weak-orange" | "none";
  rpmDelta?: number; // Carb spray test RPM jump/dip
  dripRate?: "steady" | "trickle" | "none";
  /** Hint added to the player's Mechanic's Journal */
  journalNote: string;
}

export interface JournalEntry {
  id: string;
  timestamp: number;
  bikeId: string;
  title: string;
  body: string;
  category: "observation" | "tool" | "fix" | "badge";
}

// ── ROUTES & MISSIONS ─────────────────────────────────────────────────────

export interface RouteSegment {
  startM: number;
  endM: number;
  gradePct: number; // -8 (downhill) to +14 (steep Grizzly Peak climb)
  hasStoplight?: boolean;
  potholeDensity: number; // 0..1
  landmark?: string;
}

export interface RouteSpec {
  id: RouteId;
  name: string;
  subtitle: string;
  lengthM: number;
  rewardCash: number;
  rewardRep: number;
  repRequired: number;
  difficulty: "chill" | "tricky" | "spicy" | "send-it";
  hasCoffeeCup?: boolean;
  timeOfDay: "morning" | "golden" | "sunset" | "night";
  description: string;
  segments: RouteSegment[];
}

export interface CraigslistListing {
  id: string;
  make: SimBikeMake;
  title: string;
  sellerBlurb: string;
  price: number;
  repRequired: number;
  colorHex: string;
  accentHex: string;
  /** Hidden starter faults baked into the Craigslist find */
  starterFaults: FaultId[];
  starterJetOffset?: number;
}

// ── RIDE CONTROLS & EVENTS ────────────────────────────────────────────────

export interface RideInput {
  throttle: number; // 0..1
  brake: boolean;
  tuck: boolean;
  choke: boolean;
  pedalPulse: boolean; // True on frames player taps pedal (LPA / pedal home)
  clutch: boolean; // Pull clutch for seize save!
  killSwitch: boolean; // Hold at WOT to do a true plug chop
  kickstartPulse: boolean; // Tap to kickstart when stalled
}

export interface ComicCaption {
  id: number;
  text: string;
  tone: "gold" | "cyan" | "orange" | "red" | "white";
  ttlMs: number;
  maxTtlMs: number;
}

export type SimEvent =
  | { type: "caption"; text: string; tone: ComicCaption["tone"] }
  | { type: "detonation" }
  | { type: "seize-warning" }
  | { type: "seize-start" }
  | { type: "seize-saved" }
  | { type: "seize-crash" }
  | { type: "stalled"; reason: "fuel" | "spark" | "idle" | "plug-chop" }
  | { type: "kickstart"; started: boolean; compressionFeel: "strong" | "weak" }
  | { type: "pothole-bump" }
  | { type: "mission-complete"; cash: number; rep: number; bonusText?: string }
  | { type: "badge-earned"; badgeId: string; title: string; description: string };

export interface RideSummary {
  routeId: RouteId;
  completed: boolean;
  outcome: "finished" | "pedaled-home" | "towed" | "seize-crash" | "aborted";
  distanceM: number;
  topSpeedMph: number;
  maxChtC: number;
  cashEarned: number;
  repEarned: number;
  towCost: number;
  plugChopCaptured: boolean;
  notes: string[];
}

export interface PlayerBadge {
  id: string;
  title: string;
  description: string;
  earnedAt: number;
}

// ── PERSISTENT SAVE STATE ─────────────────────────────────────────────────

export interface SimSaveState {
  version: 1;
  seed: number;
  cash: number;
  rep: number;
  activeBikeId: string;
  bikes: OwnedBike[];
  inventory: string[]; // Owned part IDs in toolbox
  upgrades: UpgradeId[]; // Owned instruments/tools
  completedRoutes: RouteId[];
  journal: JournalEntry[];
  badges: PlayerBadge[];
  stats: {
    totalRides: number;
    totalBreakdowns: number;
    totalFixes: number;
    seizesSaved: number;
    milesPedaledHome: number;
  };
}
