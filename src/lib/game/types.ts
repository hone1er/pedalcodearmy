// Game phase state machine
export type GamePhase =
  | "MENU"
  | "MOPED_SELECT"
  | "PLAYING"
  | "GAME_OVER"
  | "LEADERBOARD";

// Moped makes available in the game
export type MopedMake =
  | "puch-maxi"
  | "honda-hobbit"
  | "derbi-variant"
  | "tomos-a35";

export type MopedFrameStyle = "step-through" | "top-bar" | "sport" | "classic";

// Runner stats per moped
export interface MopedStats {
  baseSpeed: number;
  speedMultiplier: number;
  laneChangeSpeed: number;
  maxHealth: number;
  wheelieHeight: number;
  wheelieDuration: number;
  invincibilityMs: number;
  comboWindowMs: number;
  wheelieBonusMultiplier: number;
  frameStyle: MopedFrameStyle;
}

// Lane system
export type Lane = 0 | 1 | 2;

// Obstacle types
export type ObstacleType =
  | "car"
  | "pothole"
  | "oil-slick"
  | "traffic-cone"
  | "dog";

export type CarVariant = "sedan" | "hatchback" | "van";

// Collectible types
export type CollectibleType = "spark-plug" | "jet" | "pipe" | "cylinder";

// Shop types
export type ShopType = "treatland" | "1977-mopeds" | "myrons-mopeds";

// East Bay progression zones
export type ZoneId =
  | "oakland-hills"
  | "lake-merritt"
  | "telegraph-ave"
  | "bay-bridge"
  | "west-oakland";

export interface ZoneInfo {
  id: ZoneId;
  name: string;
  subtitle: string;
  skyTop: number;
  skyBottom: number;
  sunColor: number;
  hillColor: number;
  fogTint: number;
  accentHex: string;
}

export const EAST_BAY_ZONES: ZoneInfo[] = [
  {
    id: "oakland-hills",
    name: "OAKLAND HILLS",
    subtitle: "Golden hour warm-up",
    skyTop: 0x3b82c4,
    skyBottom: 0xf59e56,
    sunColor: 0xffe066,
    hillColor: 0x3d2b5e,
    fogTint: 0x1a1a2e,
    accentHex: "#FFD700",
  },
  {
    id: "lake-merritt",
    name: "LAKE MERRITT",
    subtitle: "Sunset boulevard",
    skyTop: 0x5b3a82,
    skyBottom: 0xf97316,
    sunColor: 0xff9f43,
    hillColor: 0x2f1e4c,
    fogTint: 0x1e1530,
    accentHex: "#FB923C",
  },
  {
    id: "telegraph-ave",
    name: "TELEGRAPH AVE",
    subtitle: "Neon twilight cruise",
    skyTop: 0x241645,
    skyBottom: 0xc026d3,
    sunColor: 0xf472b6,
    hillColor: 0x1b1235,
    fogTint: 0x140d26,
    accentHex: "#F472B6",
  },
  {
    id: "bay-bridge",
    name: "BAY BRIDGE",
    subtitle: "Midnight two-stroke run",
    skyTop: 0x0b1120,
    skyBottom: 0x1d4ed8,
    sunColor: 0x93c5fd,
    hillColor: 0x0f172a,
    fogTint: 0x090d1a,
    accentHex: "#60A5FA",
  },
  {
    id: "west-oakland",
    name: "WEST OAKLAND",
    subtitle: "Early morning smoke",
    skyTop: 0x1e3a5f,
    skyBottom: 0xfbbf24,
    sunColor: 0xfde047,
    hillColor: 0x272038,
    fogTint: 0x161628,
    accentHex: "#FACC15",
  },
];

// Floating HUD feedback callouts
export interface GamePopup {
  id: number;
  text: string;
  subtext?: string;
  tone: "gold" | "green" | "cyan" | "orange" | "red";
  timer: number; // ms remaining
  maxTimer: number;
}

// Combo multiplier state
export interface ComboState {
  count: number;
  multiplier: number; // 1..4
  timer: number; // ms remaining
  maxTimer: number;
  maxCombo: number;
}

// Game entity (anything on the road)
export interface GameEntity {
  id: number;
  type: "obstacle" | "collectible" | "shop";
  subType: ObstacleType | CollectibleType | ShopType;
  x: number;
  lane: Lane;
  width: number;
  height: number;
  groundLevel: boolean;
  collected: boolean;
  active: boolean;
  /** Traffic speed offset (positive = moves forward slower than player so player overtakes smoothly) */
  speedOffset?: number;
  /** Visual variant for cars */
  carVariant?: CarVariant;
  /** Prevents double-awarding wheelie clear or near-miss bonuses */
  wheelieCleared?: boolean;
  nearMissAwarded?: boolean;
}

// Player state
export interface PlayerState {
  lane: Lane;
  targetLane: Lane;
  laneProgress: number;
  y: number;
  isWheeling: boolean;
  wheelieTimer: number;
  wheelieDuration: number;
  isInvincible: boolean;
  invincibleTimer: number;
  health: number;
  maxHealth: number;
  /** Buffered next lane direction (-1, 0, 1) so rapid taps never drop */
  queuedLaneDir: -1 | 0 | 1;
  /** Buffered wheelie window in ms */
  queuedWheelieMs: number;
  /** Visual lean angle (-1..1) driven by lane shifts */
  leanAngle: number;
}

// Active effects from shops
export interface ActiveEffect {
  type: "speed-boost" | "magnet" | "repair";
  timer: number;
  source: ShopType;
}

// Main game state
export interface RunnerGameState {
  phase: "countdown" | "running" | "hit" | "dead";
  distance: number;
  score: number;
  bonusScore: number;
  speed: number;
  baseSpeed: number;
  topSpeed: number;
  elapsedTime: number;
  entities: GameEntity[];
  player: PlayerState;
  effects: ActiveEffect[];
  combo: ComboState;
  popups: GamePopup[];
  nextPopupId: number;
  zoneIndex: number;
  wheelieClears: number;
  closeCalls: number;
  partsCollected: Record<CollectibleType, number>;
  shopsVisited: ShopType[];
  nextEntityId: number;
  countdownTimer: number;
  lastCountdownTick: number;
  hitFlashTimer: number;
  speedBoostTimer: number;
  magnetTimer: number;
  lastObstacleSpawnDistance: number;
  lastCollectibleSpawnDistance: number;
  lastShopSpawnDistance: number;
  nextShopIndex: number;
}

// Game over result
export interface GameResult {
  mopedMake: MopedMake;
  score: number;
  distance: number;
  partsCollected: Record<CollectibleType, number>;
  totalParts: number;
  shopsVisited: ShopType[];
  elapsedTime: number;
  topSpeed: number;
  maxCombo: number;
  wheelieClears: number;
  closeCalls: number;
  zoneReached: string;
}

// Leaderboard entry
export interface LeaderboardEntry {
  id: number;
  playerName: string;
  mopedMake: string;
  score: number;
  distance: number;
  partsCollected: number;
  createdAt: string;
}

// Moped display info
export interface MopedInfo {
  id: MopedMake;
  name: string;
  tagline: string;
  description: string;
  perkName: string;
  perkDescription: string;
  colorScheme: {
    frame: string;
    accent: string;
  };
}

// Canvas render state
export interface RenderState {
  moped: MopedMake;
  player: PlayerState;
  entities: GameEntity[];
  speed: number;
  distance: number;
  score: number;
  health: number;
  maxHealth: number;
  effects: ActiveEffect[];
  combo: ComboState;
  zoneIndex: number;
  speedBoostActive: boolean;
  magnetActive: boolean;
  elapsedTime: number;
  canvasWidth: number;
  canvasHeight: number;
  hitFlashTimer: number;
  phase: RunnerGameState["phase"];
  countdownTimer: number;
  paused?: boolean;
}

// Constants
export const VIRTUAL_WIDTH = 900;
export const TARGET_FPS = 60;
export const FRAME_TIME = 1 / TARGET_FPS;
export const CANVAS_ROAD_TOP_RATIO = 0.45;
export const CANVAS_ROAD_BOTTOM_RATIO = 0.85;
export const LANE_COUNT = 3;
export const PLAYER_X_POSITION = 0.16;
export const PIXELS_PER_METER = 10;
export const ZONE_LENGTH_METERS = 250;
export const INVINCIBILITY_MS = 1500;
export const HIT_FREEZE_MS = 280;
export const COUNTDOWN_SECONDS = 3;
export const SPEED_BOOST_MS = 3800;
export const MAGNET_MS = 6000;
export const MAGNET_RANGE_PX = 165;
export const INPUT_BUFFER_MS = 180;
