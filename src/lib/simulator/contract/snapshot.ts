import type {
  BikeVerdict,
  HotspotId,
  MisfirePattern,
  PartSlot,
  PlugColor,
  RouteId,
  SimBikeMake,
  SimPhase,
  SmokeTint,
  StallReason,
  ToolId,
  UpgradeId,
} from "./ids";
import type {
  ComicCaption,
  RideInput,
  RideSummary,
  RunnerRunResult,
  RunnerRunSummary,
  SimSaveState,
  StandTestInput,
  ToolReading,
} from "./types";

export interface RidePotholeTelemetry {
  positionM: number;
  lane: 0 | 1;
  hit: boolean;
  dodged: boolean;
}

/**
 * Observable-only ride telemetry snapshot.
 * GOLDEN CONTRACT RULE: Contains ZERO FaultIds — UI, Audio, and Renderer
 * must deduce/visualize everything strictly from real physical symptoms!
 */
export interface RideTelemetrySnapshot {
  active: boolean;
  routeId: RouteId;
  routeName: string;
  timeOfDay: "morning" | "golden" | "sunset" | "night";
  bikeMake: SimBikeMake;
  bikeColorHex: string;
  bikeAccentHex: string;
  /** Visible part tiers for Canvas 2D renderer */
  exhaustVisual: "stock" | "performance" | "race";
  cylinderVisual: "stock" | "performance" | "race";
  airFilterVisual?: "stock" | "performance" | "race";

  // Motion & route
  distanceM: number;
  routeLengthM: number;
  speedMph: number;
  gradePct: number;
  landmark: string | null;
  atStoplight: boolean;
  stoplightRedSec: number;
  /** World meter position of the next stoplight (or null if none nearby) */
  nextStoplightM?: number | null;
  nextStoplightState?: "pending" | "red" | "green" | null;
  /** World meter positions of upcoming potholes on the route */
  upcomingPotholesM?: number[];
  /** Detailed upcoming pothole state + lane for visual telegraphs and swerve alerts */
  upcomingPotholes?: RidePotholeTelemetry[];
  /** Distance in meters to the next pothole ahead (or null) */
  nextPotholeM?: number | null;
  /** Active lateral riding track (0 = curb/top, 1 = outer/lower) */
  lane?: 0 | 1;
  /** Smoothly interpolated lateral position (0..1) */
  lanePos?: number;
  /** Total potholes dodged on this ride */
  potholesDodged?: number;

  // Controls
  throttle: number;
  brake: boolean;
  tuck: boolean;
  choke: boolean;
  clutchPulled: boolean;
  pedaling: boolean;
  stamina: number; // 0..100 for LPA & pedaling home

  // Engine telemetry (gated instruments clearly marked)
  engineRunning: boolean;
  rpm: number; // Always available to audio synth; UI displays only if hasTach
  maxRpm: number;
  hasTach: boolean;
  hasChtGauge: boolean;
  hasStethoscope: boolean;
  listenMode: boolean;
  chtC: number; // Always available to renderer (heat shimmer); UI shows numeric only if hasChtGauge
  powerbandActive: boolean; // "On the pipe!"
  fuelBowlPct: number; // 0..100

  // Observable symptoms (derived from physics, NEVER raw fault IDs)
  smoke: {
    density: number; // 0..1
    tint: SmokeTint;
  };
  misfirePattern: MisfirePattern;
  misfireRate: number; // 0..1
  leanTone: number; // 0..1 (thin bright exhaust tone)
  detonationPulse: boolean; // True when ping fires
  clutchSlip: number; // 0..1
  pistonKnock: number; // 0..1 (audible in stethoscope Listen Mode)
  compressionFeel: "strong" | "weak";

  // Failure & survival states
  stalled: boolean;
  stallReason: StallReason;
  seizeWarning: boolean;
  seizeActive: boolean;
  /** Remaining ms in the clutch-save reaction window when seizing (0 if inactive) */
  seizeClutchWindowMs: number;
  seizedHard: boolean;
  seizeCooldownHot?: boolean;
  /** Active gear for 2-speed makes (e.g. Tomos A35) */
  currentGear?: 1 | 2;
  gearShiftPulse?: boolean;
  pedalingHome: boolean;
  pedalHomeRemainingM: number;

  // Mission spice
  coffeeTempPct: number | null; // For Telegraph Coffee Run
  coffeeSpillPct: number | null;
  elapsedSec: number;
  captions: ComicCaption[];
}

/**
 * Full store snapshot consumed by React components via useSyncExternalStore.
 */
export interface SimAppSnapshot {
  phase: SimPhase;
  save: SimSaveState;
  ride: RideTelemetrySnapshot | null;
  /** Live telemetry when running the engine on the garage center stand */
  standTest: RideTelemetrySnapshot | null;
  /** True while an active Street Runner session is underway */
  runnerPlaying: boolean;
  lastRideSummary: RideSummary | null;
  lastRunnerSummary: RunnerRunSummary | null;
  selectedTool: ToolId;
  lastToolReading: ToolReading | null;
  plugViewerColor: PlugColor | null;
  lastActionNotice: { text: string; tone: "gold" | "green" | "red" | "cyan" } | null;
  /** Whether the active bike visibly drips fuel in the garage (symptom, not fault ID) */
  garageFuelDrip: boolean;
  /** Road-tested bike verdict derived strictly from observed ride/run symptoms */
  bikeVerdict: BikeVerdict;
  /** Derived from bikeVerdict === "acting-up" (never a hidden fault answer key) */
  bikeNeedsAttention: boolean;
  /** Ideal jet hint range for UI slider bounds */
  jetRange: { min: number; max: number };
}

/**
 * Action contract exposed by `src/lib/simulator/store/sim-store.ts`.
 * Property arrow signatures allow safe destructuring from `useSimStore()`.
 */
export interface SimStoreActions {
  setPhase: (this: void, phase: SimPhase) => void;
  selectBike: (this: void, bikeId: string) => void;
  selectTool: (this: void, tool: ToolId) => void;
  runToolOnHotspot: (this: void, hotspot: HotspotId) => ToolReading | null;
  closePlugViewer: (this: void) => void;
  clearNotice: (this: void) => void;

  // Garage wrenching & tuning
  installPart: (this: void, partId: string) => boolean;
  setMainJet: (this: void, size: number) => void;
  setNeedleClip: (this: void, clip: 1 | 2 | 3 | 4 | 5) => void;
  setIdleScrew: (this: void, turns: number) => void;
  toggleKillSwitch: (this: void) => void;
  addPremixOil: (this: void) => void;
  cleanAirFilter: (this: void) => void;
  cleanCarburetor: (this: void) => void;
  clearFaultlessTestCheck: (this: void) => void;

  // Garage stand test ("Fire it up" on the workbench)
  startStandTest: (this: void) => void;
  stopStandTest: (this: void) => void;
  setStandInput: (this: void, partial: Partial<StandTestInput>) => void;
  kickStandTest: (this: void) => void;

  // Economy
  buyPart: (this: void, partId: string) => boolean;
  buyUpgrade: (this: void, upgradeId: UpgradeId) => boolean;
  buyCraigslistBike: (this: void, listingId: string) => boolean;

  // Ride & Runner lifecycle
  startRide: (this: void, routeId: RouteId) => void;
  setRideInput: (this: void, partial: Partial<RideInput>) => void;
  swerveRide: (this: void, target?: 0 | 1) => void;
  toggleListenMode: (this: void) => void;
  triggerPedalPulse: (this: void) => void;
  triggerKickstart: (this: void) => void;
  startPedalingHome: (this: void) => void;
  callTowTruck: (this: void) => void;
  abortRideToGarage: (this: void) => void;
  dismissRideSummary: (this: void) => void;
  setRunnerPlaying: (this: void, playing: boolean) => void;
  completeRunnerRun: (this: void, result: RunnerRunResult) => void;
  dismissRunnerSummary: (this: void) => void;

  // Save management
  resetSave: (this: void) => void;
  getInstalledSlotPartId: (this: void, slot: PartSlot) => string | undefined;
}
