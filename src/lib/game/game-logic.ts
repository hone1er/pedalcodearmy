import type {
  MopedMake,
  MopedStats,
  RunnerGameState,
  GameEntity,
  GameResult,
  CollectibleType,
  ObstacleType,
  ShopType,
  Lane,
  ActiveEffect,
} from "./types";
import {
  PIXELS_PER_METER,
  INVINCIBILITY_MS,
  HIT_FREEZE_MS,
  COUNTDOWN_SECONDS,
  SPEED_BOOST_MS,
  MAGNET_MS,
  MAGNET_RANGE_PX,
  PLAYER_X_POSITION,
  CANVAS_ROAD_TOP_RATIO,
  CANVAS_ROAD_BOTTOM_RATIO,
} from "./types";
import { getMopedStats } from "./moped-stats";

export interface GameEffectCallback {
  onCollectSparkles(x: number, y: number): void;
  onHitSparks(x: number, y: number): void;
}

// Default no-op callback
// eslint-disable-next-line @typescript-eslint/no-empty-function
const noopCallback: GameEffectCallback = {
  onCollectSparkles: (_x: number, _y: number) => {
    /* no-op */
  },
  onHitSparks: (_x: number, _y: number) => {
    /* no-op */
  },
};

// Speed ramp: px/s per second
const SPEED_RAMP = 2;

// Spawning intervals (in pixels of distance)
const BASE_OBSTACLE_INTERVAL = 400;
const BASE_COLLECTIBLE_INTERVAL = 300;
const BASE_SHOP_INTERVAL = 2500;
const MIN_LANE_GAP = 100;

// Part point values
const PART_VALUES: Record<CollectibleType, number> = {
  "spark-plug": 10,
  jet: 15,
  pipe: 25,
  cylinder: 50,
};

// Entity dimensions
type EntitySubType = ObstacleType | CollectibleType | ShopType;
const ENTITY_DIMS: Record<EntitySubType, { width: number; height: number }> = {
  car: { width: 60, height: 35 },
  pothole: { width: 30, height: 15 },
  "oil-slick": { width: 40, height: 12 },
  "traffic-cone": { width: 15, height: 25 },
  dog: { width: 25, height: 20 },
  "spark-plug": { width: 12, height: 18 },
  jet: { width: 12, height: 12 },
  pipe: { width: 25, height: 10 },
  cylinder: { width: 18, height: 22 },
  treatland: { width: 120, height: 40 },
  "1977-mopeds": { width: 120, height: 40 },
  "myrons-mopeds": { width: 120, height: 40 },
};

const SHOP_CYCLE: ShopType[] = ["treatland", "1977-mopeds", "myrons-mopeds"];

export function createGameState(moped: MopedMake): RunnerGameState {
  const stats = getMopedStats(moped);
  return {
    phase: "countdown",
    distance: 0,
    score: 0,
    speed: stats.baseSpeed,
    baseSpeed: stats.baseSpeed,
    topSpeed: 0,
    elapsedTime: 0,
    entities: [],
    player: {
      lane: 1 as Lane,
      targetLane: 1 as Lane,
      laneProgress: 1,
      y: 0,
      isWheeling: false,
      wheelieTimer: 0,
      isInvincible: false,
      invincibleTimer: 0,
      health: stats.maxHealth,
      maxHealth: stats.maxHealth,
    },
    effects: [],
    partsCollected: { "spark-plug": 0, jet: 0, pipe: 0, cylinder: 0 },
    shopsVisited: [],
    nextEntityId: 1,
    countdownTimer: COUNTDOWN_SECONDS,
    hitFlashTimer: 0,
    speedBoostTimer: 0,
    magnetTimer: 0,
    lastObstacleSpawnDistance: 0,
    lastCollectibleSpawnDistance: 0,
    lastShopSpawnDistance: 0,
    nextShopIndex: 0,
  };
}

export function stepGame(
  state: RunnerGameState,
  stats: MopedStats,
  deltaTime: number,
  canvasWidth: number,
  effectCallback: GameEffectCallback = noopCallback,
): RunnerGameState {
  const next: RunnerGameState = {
    ...state,
    player: { ...state.player },
    entities: state.entities.map((e) => ({ ...e })),
    effects: state.effects.map((e) => ({ ...e })),
    partsCollected: { ...state.partsCollected },
    shopsVisited: [...state.shopsVisited],
  };

  // Handle countdown
  if (next.phase === "countdown") {
    next.countdownTimer -= deltaTime;
    if (next.countdownTimer <= 0) {
      next.phase = "running";
      next.countdownTimer = 0;
    }
    return next;
  }

  // Handle hit freeze
  if (next.phase === "hit") {
    next.hitFlashTimer -= deltaTime * 1000;
    if (next.hitFlashTimer <= 0) {
      next.hitFlashTimer = 0;
      if (next.player.health <= 0) {
        next.phase = "dead";
      } else {
        next.phase = "running";
      }
    }
    return next;
  }

  // Dead state - no updates
  if (next.phase === "dead") {
    return next;
  }

  // === RUNNING phase ===
  next.elapsedTime += deltaTime;

  // Increase speed gradually
  next.speed += deltaTime * SPEED_RAMP * stats.speedMultiplier;

  // Apply speed boost
  let effectiveSpeed = next.speed;
  if (next.speedBoostTimer > 0) {
    effectiveSpeed *= 1.3;
    next.speedBoostTimer -= deltaTime * 1000;
    if (next.speedBoostTimer < 0) next.speedBoostTimer = 0;
  }

  // Track top speed
  if (effectiveSpeed > next.topSpeed) {
    next.topSpeed = effectiveSpeed;
  }

  // Update distance and score
  next.distance += effectiveSpeed * deltaTime;
  next.score = computeScore(next.distance, next.partsCollected);

  // Update lane transition
  if (next.player.laneProgress < 1) {
    const laneSpeed = 1000 / stats.laneChangeSpeed; // progress per second
    next.player.laneProgress = Math.min(
      1,
      next.player.laneProgress + laneSpeed * deltaTime,
    );
    if (next.player.laneProgress >= 1) {
      next.player.lane = next.player.targetLane;
    }
  }

  // Update wheelie timer
  if (next.player.isWheeling) {
    next.player.wheelieTimer -= deltaTime * 1000;
    if (next.player.wheelieTimer <= 0) {
      next.player.isWheeling = false;
      next.player.wheelieTimer = 0;
    }
  }

  // Update invincibility
  if (next.player.isInvincible) {
    next.player.invincibleTimer -= deltaTime * 1000;
    if (next.player.invincibleTimer <= 0) {
      next.player.isInvincible = false;
      next.player.invincibleTimer = 0;
    }
  }

  // Update magnet timer
  if (next.magnetTimer > 0) {
    next.magnetTimer -= deltaTime * 1000;
    if (next.magnetTimer < 0) next.magnetTimer = 0;
  }

  // Update active effects
  next.effects = next.effects.filter((e) => {
    e.timer -= deltaTime * 1000;
    return e.timer > 0;
  });

  // Spawn entities
  spawnEntities(next, canvasWidth);

  // Move entities left
  const playerX = canvasWidth * PLAYER_X_POSITION;
  for (const entity of next.entities) {
    if (entity.active) {
      entity.x -= effectiveSpeed * deltaTime;
    }
  }

  // Magnet effect: pull collectibles toward player
  if (next.magnetTimer > 0) {
    const roadTop = 400 * CANVAS_ROAD_TOP_RATIO; // approximate
    const roadHeight = 400 * (CANVAS_ROAD_BOTTOM_RATIO - CANVAS_ROAD_TOP_RATIO);
    const playerY = getLaneY(next.player.lane, roadTop, roadHeight);

    for (const entity of next.entities) {
      if (entity.type === "collectible" && entity.active && !entity.collected) {
        const dx = playerX - entity.x;
        const entityY = getLaneY(entity.lane, roadTop, roadHeight);
        const dy = playerY - entityY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MAGNET_RANGE_PX && dist > 0) {
          // Pull toward player
          entity.x += (dx / dist) * effectiveSpeed * deltaTime * 1.5;
        }
      }
    }
  }

  // Collision detection
  checkCollisions(next, canvasWidth, stats, effectCallback);

  // Cull off-screen entities
  next.entities = next.entities.filter((e) => e.x + e.width > -50 && e.active);

  return next;
}

function checkCollisions(
  state: RunnerGameState,
  canvasWidth: number,
  _stats: MopedStats,
  effectCallback: GameEffectCallback,
): void {
  const playerX = canvasWidth * PLAYER_X_POSITION;
  const playerWidth = 50;

  // Determine which lanes the player occupies
  const playerLanes: Lane[] = [];
  if (state.player.laneProgress >= 1) {
    playerLanes.push(state.player.lane);
  } else {
    playerLanes.push(state.player.lane);
    playerLanes.push(state.player.targetLane);
  }

  for (const entity of state.entities) {
    if (!entity.active || entity.collected) continue;

    // Check X overlap
    const entityLeft = entity.x;
    const entityRight = entity.x + entity.width;
    const playerLeft = playerX - playerWidth / 2;
    const playerRight = playerX + playerWidth / 2;

    if (entityRight < playerLeft || entityLeft > playerRight) continue;

    // Check lane overlap
    if (!playerLanes.includes(entity.lane)) continue;

    // Collision detected
    if (entity.type === "obstacle") {
      // Ground-level obstacles can be wheelied over
      if (entity.groundLevel && state.player.isWheeling) continue;

      // Invincible: skip damage
      if (state.player.isInvincible) continue;

      // Take hit
      state.player.health--;
      state.player.isInvincible = true;
      state.player.invincibleTimer = INVINCIBILITY_MS;
      state.hitFlashTimer = HIT_FREEZE_MS;
      state.phase = "hit";
      entity.active = false;
      effectCallback.onHitSparks(
        playerX,
        getLaneY(state.player.lane, 180, 160),
      );
      return; // Only process one hit per frame
    }

    if (entity.type === "collectible") {
      entity.collected = true;
      entity.active = false;
      const partType = entity.subType as CollectibleType;
      state.partsCollected[partType]++;
      state.score += PART_VALUES[partType];
      effectCallback.onCollectSparkles(
        entity.x + entity.width / 2,
        getLaneY(entity.lane, 180, 160),
      );
    }

    if (entity.type === "shop") {
      entity.collected = true;
      entity.active = false;
      const shopType = entity.subType as ShopType;
      if (!state.shopsVisited.includes(shopType)) {
        state.shopsVisited.push(shopType);
      }
      state.score += 100;
      effectCallback.onCollectSparkles(
        entity.x + entity.width / 2,
        getLaneY(entity.lane, 180, 160),
      );

      // Apply shop effect
      const effect = getShopEffect(shopType);
      if (effect.type === "repair") {
        state.player.health = Math.min(
          state.player.health + 1,
          state.player.maxHealth,
        );
      } else if (effect.type === "speed-boost") {
        state.speedBoostTimer = SPEED_BOOST_MS;
        state.effects.push(effect);
      } else if (effect.type === "magnet") {
        state.magnetTimer = MAGNET_MS;
        state.effects.push(effect);
      }
    }
  }
}

function spawnEntities(state: RunnerGameState, canvasWidth: number): void {
  const spawnX = canvasWidth + 50;

  // Obstacle spawning
  const obstacleInterval =
    BASE_OBSTACLE_INTERVAL * (1 / (1 + state.distance * 0.0001));
  const distSinceObstacle = state.distance - state.lastObstacleSpawnDistance;
  if (distSinceObstacle > obstacleInterval) {
    const lane = randomLane();
    const type = pickObstacleType(state.distance);
    const dims = ENTITY_DIMS[type];
    const groundLevel = type !== "car";

    if (!hasEntityNearby(state.entities, lane, spawnX, MIN_LANE_GAP)) {
      state.entities.push({
        id: state.nextEntityId++,
        type: "obstacle",
        subType: type,
        x: spawnX,
        lane,
        width: dims.width,
        height: dims.height,
        groundLevel,
        collected: false,
        active: true,
      });
      state.lastObstacleSpawnDistance = state.distance;

      // After 30 seconds, sometimes spawn a second obstacle in another lane
      if (state.elapsedTime > 30 && Math.random() < 0.3) {
        const lane2 = randomLaneExcluding(lane);
        const type2 = pickObstacleType(state.distance);
        const dims2 = ENTITY_DIMS[type2];
        if (!hasEntityNearby(state.entities, lane2, spawnX, MIN_LANE_GAP)) {
          state.entities.push({
            id: state.nextEntityId++,
            type: "obstacle",
            subType: type2,
            x: spawnX + Math.random() * 40,
            lane: lane2,
            width: dims2.width,
            height: dims2.height,
            groundLevel: type2 !== "car",
            collected: false,
            active: true,
          });
        }
      }
    }
  }

  // Collectible spawning
  const collectibleInterval = BASE_COLLECTIBLE_INTERVAL + Math.random() * 100;
  const distSinceCollectible =
    state.distance - state.lastCollectibleSpawnDistance;
  if (distSinceCollectible > collectibleInterval) {
    const lane = randomLane();
    const type = pickCollectibleType();
    const dims = ENTITY_DIMS[type];

    if (!hasEntityNearby(state.entities, lane, spawnX, MIN_LANE_GAP)) {
      state.entities.push({
        id: state.nextEntityId++,
        type: "collectible",
        subType: type,
        x: spawnX,
        lane,
        width: dims.width,
        height: dims.height,
        groundLevel: true,
        collected: false,
        active: true,
      });
      state.lastCollectibleSpawnDistance = state.distance;
    }
  }

  // Shop spawning
  const distSinceShop = state.distance - state.lastShopSpawnDistance;
  if (distSinceShop > BASE_SHOP_INTERVAL) {
    const lane = randomLane();
    const shopType = SHOP_CYCLE[state.nextShopIndex % SHOP_CYCLE.length]!;
    const dims = ENTITY_DIMS[shopType as EntitySubType];

    if (!hasEntityNearby(state.entities, lane, spawnX, MIN_LANE_GAP * 2)) {
      state.entities.push({
        id: state.nextEntityId++,
        type: "shop",
        subType: shopType,
        x: spawnX,
        lane,
        width: dims.width,
        height: dims.height,
        groundLevel: false,
        collected: false,
        active: true,
      });
      state.lastShopSpawnDistance = state.distance;
      state.nextShopIndex++;
    }
  }
}

function pickObstacleType(distance: number): ObstacleType {
  const rand = Math.random();
  // More cars at higher distances
  const carWeight = Math.min(0.15 + distance * 0.00003, 0.4);
  if (rand < carWeight) return "car";
  if (rand < carWeight + 0.25) return "pothole";
  if (rand < carWeight + 0.45) return "traffic-cone";
  if (rand < carWeight + 0.6) return "oil-slick";
  return "dog";
}

function pickCollectibleType(): CollectibleType {
  const rand = Math.random();
  if (rand < 0.4) return "spark-plug";
  if (rand < 0.7) return "jet";
  if (rand < 0.9) return "pipe";
  return "cylinder";
}

function randomLane(): Lane {
  return Math.floor(Math.random() * 3) as Lane;
}

function randomLaneExcluding(exclude: Lane): Lane {
  const lanes: Lane[] = ([0, 1, 2] as Lane[]).filter((l) => l !== exclude);
  return lanes[Math.floor(Math.random() * lanes.length)] ?? (0 as Lane);
}

function hasEntityNearby(
  entities: GameEntity[],
  lane: Lane,
  x: number,
  gap: number,
): boolean {
  return entities.some(
    (e) => e.active && e.lane === lane && Math.abs(e.x - x) < gap,
  );
}

export function changeLane(
  state: RunnerGameState,
  direction: -1 | 1,
): RunnerGameState {
  if (state.phase !== "running") return state;
  if (state.player.laneProgress < 1) return state;

  const newLane = (state.player.lane + direction) as Lane;
  if (newLane < 0 || newLane > 2) return state;

  return {
    ...state,
    player: {
      ...state.player,
      targetLane: newLane,
      laneProgress: 0,
    },
  };
}

export function startWheelie(
  state: RunnerGameState,
  stats: MopedStats,
): RunnerGameState {
  if (state.phase !== "running") return state;
  if (state.player.isWheeling) return state;

  return {
    ...state,
    player: {
      ...state.player,
      isWheeling: true,
      wheelieTimer: stats.wheelieDuration,
    },
  };
}

function getShopEffect(shopType: ShopType): ActiveEffect {
  switch (shopType) {
    case "treatland":
      return {
        type: "speed-boost",
        timer: SPEED_BOOST_MS,
        source: "treatland",
      };
    case "1977-mopeds":
      return { type: "repair", timer: 0, source: "1977-mopeds" };
    case "myrons-mopeds":
      return { type: "magnet", timer: MAGNET_MS, source: "myrons-mopeds" };
  }
}

export function computeScore(
  distance: number,
  partsCollected: Record<CollectibleType, number>,
): number {
  const distancePoints = Math.floor(distance / PIXELS_PER_METER);
  const partPoints =
    partsCollected["spark-plug"] * PART_VALUES["spark-plug"] +
    partsCollected.jet * PART_VALUES.jet +
    partsCollected.pipe * PART_VALUES.pipe +
    partsCollected.cylinder * PART_VALUES.cylinder;
  return distancePoints + partPoints;
}

export function buildGameResult(
  state: RunnerGameState,
  mopedMake: MopedMake,
): GameResult {
  const totalParts =
    state.partsCollected["spark-plug"] +
    state.partsCollected.jet +
    state.partsCollected.pipe +
    state.partsCollected.cylinder;

  return {
    mopedMake,
    score: state.score,
    distance: Math.floor(state.distance / PIXELS_PER_METER),
    partsCollected: { ...state.partsCollected },
    totalParts,
    shopsVisited: [...state.shopsVisited],
    elapsedTime: state.elapsedTime,
    topSpeed: state.topSpeed,
  };
}

export function getLaneY(
  lane: number,
  roadTop: number,
  roadHeight: number,
): number {
  const laneHeight = roadHeight / 3;
  return roadTop + laneHeight * lane + laneHeight / 2;
}
