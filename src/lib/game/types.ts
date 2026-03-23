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

// Runner stats per moped (replaces MopedPhysics)
export interface MopedStats {
  baseSpeed: number;
  speedMultiplier: number;
  laneChangeSpeed: number;
  maxHealth: number;
  wheelieHeight: number;
  wheelieDuration: number;
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

// Collectible types
export type CollectibleType = "spark-plug" | "jet" | "pipe" | "cylinder";

// Shop types
export type ShopType = "treatland" | "1977-mopeds" | "myrons-mopeds";

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
}

// Player state
export interface PlayerState {
  lane: Lane;
  targetLane: Lane;
  laneProgress: number;
  y: number;
  isWheeling: boolean;
  wheelieTimer: number;
  isInvincible: boolean;
  invincibleTimer: number;
  health: number;
  maxHealth: number;
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
  speed: number;
  baseSpeed: number;
  topSpeed: number;
  elapsedTime: number;
  entities: GameEntity[];
  player: PlayerState;
  effects: ActiveEffect[];
  partsCollected: Record<CollectibleType, number>;
  shopsVisited: ShopType[];
  nextEntityId: number;
  countdownTimer: number;
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
  description: string;
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
  elapsedTime: number;
  canvasWidth: number;
  canvasHeight: number;
  hitFlashTimer: number;
  phase: RunnerGameState["phase"];
  countdownTimer: number;
}

// Constants
export const TARGET_FPS = 60;
export const FRAME_TIME = 1 / TARGET_FPS;
export const CANVAS_ROAD_TOP_RATIO = 0.45;
export const CANVAS_ROAD_BOTTOM_RATIO = 0.85;
export const LANE_COUNT = 3;
export const PLAYER_X_POSITION = 0.15;
export const PIXELS_PER_METER = 10;
export const INVINCIBILITY_MS = 1500;
export const HIT_FREEZE_MS = 300;
export const COUNTDOWN_SECONDS = 3;
export const SPEED_BOOST_MS = 3000;
export const MAGNET_MS = 5000;
export const MAGNET_RANGE_PX = 120;
