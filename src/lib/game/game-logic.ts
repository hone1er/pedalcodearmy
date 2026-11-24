import type {
  MopedMake,
  MopedStats,
  RunnerGameState,
  GameEntity,
  GameResult,
  CollectibleType,
  ObstacleType,
  CarVariant,
  ShopType,
  Lane,
  ActiveEffect,
  GamePopup,
} from "./types";
import {
  VIRTUAL_WIDTH,
  PIXELS_PER_METER,
  ZONE_LENGTH_METERS,
  EAST_BAY_ZONES,
  HIT_FREEZE_MS,
  COUNTDOWN_SECONDS,
  SPEED_BOOST_MS,
  MAGNET_MS,
  MAGNET_RANGE_PX,
  PLAYER_X_POSITION,
  INPUT_BUFFER_MS,
} from "./types";
import { getMopedStats } from "./moped-stats";
import type { GameSoundEvent } from "./sound-engine";

export interface GameEffectCallback {
  onCollectSparkles(worldX: number, lane: number, color?: number): void;
  onHitSparks(worldX: number, lane: number): void;
  onWheeliePop?(lane: number): void;
  onSound?(event: GameSoundEvent): void;
}

const noopCallback: GameEffectCallback = {
  onCollectSparkles: () => {
    /* no-op */
  },
  onHitSparks: () => {
    /* no-op */
  },
};

// Speed ramp: px/s per second (smooth arcade curve up to thrilling cap)
const SPEED_RAMP = 2.6;
const MAX_BASE_SPEED = 470;

// Spawning intervals (in pixels of distance)
const BASE_OBSTACLE_INTERVAL = 350;
const BASE_COLLECTIBLE_INTERVAL = 260;
const BASE_SHOP_INTERVAL = 2100;
const MIN_LANE_GAP = 105;

// Part base point values
const PART_VALUES: Record<CollectibleType, number> = {
  "spark-plug": 15,
  jet: 20,
  pipe: 35,
  cylinder: 60,
};

const CAR_VARIANTS: CarVariant[] = ["sedan", "hatchback", "van"];

// Entity dimensions
type EntitySubType = ObstacleType | CollectibleType | ShopType;
const ENTITY_DIMS: Record<EntitySubType, { width: number; height: number }> = {
  car: { width: 66, height: 35 },
  pothole: { width: 32, height: 15 },
  "oil-slick": { width: 42, height: 12 },
  "traffic-cone": { width: 16, height: 26 },
  dog: { width: 26, height: 20 },
  "spark-plug": { width: 16, height: 18 },
  jet: { width: 16, height: 16 },
  pipe: { width: 26, height: 14 },
  cylinder: { width: 20, height: 22 },
  treatland: { width: 96, height: 42 },
  "1977-mopeds": { width: 96, height: 42 },
  "myrons-mopeds": { width: 96, height: 42 },
};

const SHOP_CYCLE: ShopType[] = ["treatland", "1977-mopeds", "myrons-mopeds"];

function comboToMultiplier(count: number): number {
  if (count >= 10) return 4;
  if (count >= 6) return 3;
  if (count >= 3) return 2;
  return 1;
}

function addPopup(
  state: RunnerGameState,
  text: string,
  tone: GamePopup["tone"],
  subtext?: string,
  durationMs = 1150,
): void {
  state.popups.push({
    id: state.nextPopupId++,
    text,
    subtext,
    tone,
    timer: durationMs,
    maxTimer: durationMs,
  });
  if (state.popups.length > 4) {
    state.popups.shift();
  }
}

function incrementCombo(
  state: RunnerGameState,
  stats: MopedStats,
): number {
  const prevMult = state.combo.multiplier;
  state.combo.count += 1;
  state.combo.multiplier = comboToMultiplier(state.combo.count);
  state.combo.timer = stats.comboWindowMs;
  state.combo.maxTimer = stats.comboWindowMs;
  if (state.combo.count > state.combo.maxCombo) {
    state.combo.maxCombo = state.combo.count;
  }
  if (state.combo.multiplier > prevMult) {
    addPopup(
      state,
      `COMBO x${state.combo.multiplier}!`,
      "cyan",
      `${state.combo.count} streak`,
      1000,
    );
  }
  return state.combo.multiplier;
}

function resetCombo(state: RunnerGameState): void {
  state.combo.count = 0;
  state.combo.multiplier = 1;
  state.combo.timer = 0;
}

export function getCurrentPlayerLaneFloat(state: RunnerGameState): number {
  const t = state.player.laneProgress;
  const eased = 1 - (1 - t) * (1 - t);
  return state.player.lane + (state.player.targetLane - state.player.lane) * eased;
}

export function createGameState(moped: MopedMake): RunnerGameState {
  const stats = getMopedStats(moped);
  return {
    phase: "countdown",
    distance: 0,
    score: 0,
    bonusScore: 0,
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
      wheelieDuration: stats.wheelieDuration,
      isInvincible: false,
      invincibleTimer: 0,
      health: stats.maxHealth,
      maxHealth: stats.maxHealth,
      queuedLaneDir: 0,
      queuedWheelieMs: 0,
      leanAngle: 0,
    },
    effects: [],
    combo: {
      count: 0,
      multiplier: 1,
      timer: 0,
      maxTimer: stats.comboWindowMs,
      maxCombo: 0,
    },
    popups: [],
    nextPopupId: 1,
    zoneIndex: 0,
    wheelieClears: 0,
    closeCalls: 0,
    partsCollected: { "spark-plug": 0, jet: 0, pipe: 0, cylinder: 0 },
    shopsVisited: [],
    nextEntityId: 1,
    countdownTimer: COUNTDOWN_SECONDS,
    lastCountdownTick: COUNTDOWN_SECONDS + 1,
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
  _canvasWidth: number = VIRTUAL_WIDTH,
  effectCallback: GameEffectCallback = noopCallback,
): RunnerGameState {
  const next: RunnerGameState = {
    ...state,
    player: { ...state.player },
    entities: state.entities.map((e) => ({ ...e })),
    effects: state.effects.map((e) => ({ ...e })),
    combo: { ...state.combo },
    popups: state.popups.map((p) => ({ ...p })),
    partsCollected: { ...state.partsCollected },
    shopsVisited: [...state.shopsVisited],
  };

  // Decay popups in all active phases
  next.popups = next.popups.filter((p) => {
    p.timer -= deltaTime * 1000;
    return p.timer > 0;
  });

  // Handle countdown (with audio ticks on 3, 2, 1, GO!)
  if (next.phase === "countdown") {
    const prevStep = Math.ceil(next.countdownTimer);
    if (prevStep < next.lastCountdownTick && prevStep >= 1) {
      next.lastCountdownTick = prevStep;
      effectCallback.onSound?.({ type: "countdown", step: prevStep });
    }
    next.countdownTimer -= deltaTime;
    if (next.countdownTimer <= 0) {
      next.phase = "running";
      next.countdownTimer = 0;
      next.lastCountdownTick = 0;
      effectCallback.onSound?.({ type: "countdown", step: 0 });
      addPopup(next, "BRAAAP!", "gold", "OAKLAND HILLS", 900);

      // Consume any input buffered right before GO!
      consumeBufferedInputs(next, stats, effectCallback);
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
        effectCallback.onSound?.({ type: "game-over" });
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

  // Smooth speed progression up to thrilling cap
  next.speed = Math.min(
    MAX_BASE_SPEED * stats.speedMultiplier,
    next.speed + deltaTime * SPEED_RAMP * stats.speedMultiplier,
  );

  // Apply speed boost
  let effectiveSpeed = next.speed;
  if (next.speedBoostTimer > 0) {
    effectiveSpeed *= 1.32;
    next.speedBoostTimer = Math.max(0, next.speedBoostTimer - deltaTime * 1000);
  }

  // Track top speed
  if (effectiveSpeed > next.topSpeed) {
    next.topSpeed = effectiveSpeed;
  }

  // Update distance & check East Bay zone milestone
  next.distance += effectiveSpeed * deltaTime;
  const distMeters = Math.floor(next.distance / PIXELS_PER_METER);
  const nextZoneIdx =
    Math.floor(distMeters / ZONE_LENGTH_METERS) % EAST_BAY_ZONES.length;
  if (nextZoneIdx !== next.zoneIndex && distMeters >= ZONE_LENGTH_METERS) {
    next.zoneIndex = nextZoneIdx;
    const zone = EAST_BAY_ZONES[nextZoneIdx]!;
    next.bonusScore += 100;
    addPopup(next, zone.name, "cyan", `${zone.subtitle} • +100`, 1700);
    effectCallback.onSound?.({ type: "zone-up" });
  }

  // Combo decay timer
  if (next.combo.timer > 0) {
    next.combo.timer -= deltaTime * 1000;
    if (next.combo.timer <= 0) {
      resetCombo(next);
    }
  }

  // Decay wheelie buffer
  if (next.player.queuedWheelieMs > 0) {
    next.player.queuedWheelieMs = Math.max(
      0,
      next.player.queuedWheelieMs - deltaTime * 1000,
    );
  }

  // Update lane transition + visual lean
  if (next.player.laneProgress < 1) {
    const laneSpeed = 1000 / stats.laneChangeSpeed;
    next.player.laneProgress = Math.min(
      1,
      next.player.laneProgress + laneSpeed * deltaTime,
    );
    const dir = Math.sign(next.player.targetLane - next.player.lane);
    const peak = Math.sin(next.player.laneProgress * Math.PI);
    next.player.leanAngle = dir * peak;

    if (next.player.laneProgress >= 1) {
      next.player.lane = next.player.targetLane;
      next.player.leanAngle = 0;

      // Immediately execute buffered lane change if queued!
      if (next.player.queuedLaneDir !== 0) {
        const queuedDir = next.player.queuedLaneDir;
        next.player.queuedLaneDir = 0;
        applyLaneShift(next, queuedDir, effectCallback);
      }
    }
  } else {
    next.player.leanAngle *= Math.max(0, 1 - deltaTime * 14);
  }

  // Update wheelie timer
  if (next.player.isWheeling) {
    next.player.wheelieTimer -= deltaTime * 1000;
    if (next.player.wheelieTimer <= 0) {
      next.player.isWheeling = false;
      next.player.wheelieTimer = 0;
      // Execute buffered wheelie immediately on landing!
      if (next.player.queuedWheelieMs > 0) {
        next.player.queuedWheelieMs = 0;
        applyWheelie(next, stats, effectCallback);
      }
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
    next.magnetTimer = Math.max(0, next.magnetTimer - deltaTime * 1000);
  }

  // Update active effects
  next.effects = next.effects.filter((e) => {
    e.timer -= deltaTime * 1000;
    return e.timer > 0;
  });

  // Spawn entities in fixed virtual space
  spawnEntities(next, VIRTUAL_WIDTH);

  // Move entities left (cars cruise forward slightly so player overtakes dynamic traffic)
  const playerX = VIRTUAL_WIDTH * PLAYER_X_POSITION;
  for (const entity of next.entities) {
    if (!entity.active) continue;
    const relativeSpeed = Math.max(
      effectiveSpeed * 0.52,
      effectiveSpeed - (entity.speedOffset ?? 0),
    );
    entity.x -= relativeSpeed * deltaTime;
  }

  // Magnet effect: pull nearby collectibles toward player's lane without pulling backward
  if (next.magnetTimer > 0) {
    const targetLane =
      next.player.laneProgress < 1 ? next.player.targetLane : next.player.lane;

    for (const entity of next.entities) {
      if (entity.type !== "collectible" || !entity.active || entity.collected) {
        continue;
      }

      const entityCenterX = entity.x + entity.width / 2;
      const dx = entityCenterX - playerX;

      if (dx < -25) continue;

      if (dx <= MAGNET_RANGE_PX) {
        if (entity.lane !== targetLane) {
          const laneDiff = targetLane - entity.lane;
          if (dx <= MAGNET_RANGE_PX * 0.7 || Math.abs(laneDiff) <= 1) {
            entity.lane = targetLane;
          } else {
            entity.lane = (entity.lane + Math.sign(laneDiff)) as Lane;
          }
        }

        if (dx > 0) {
          const pullX = Math.min(dx, effectiveSpeed * deltaTime * 0.85);
          entity.x -= pullX;
        }
      }
    }
  }

  // Collision, wheelie-clear & close-call detection
  checkCollisions(next, VIRTUAL_WIDTH, stats, effectCallback);

  // Recompute authoritative score
  next.score = computeScore(next.distance, next.partsCollected, next.bonusScore);

  // Cull off-screen entities
  next.entities = next.entities.filter((e) => e.x + e.width > -70 && e.active);

  return next;
}

function applyLaneShift(
  state: RunnerGameState,
  direction: -1 | 1,
  effectCallback: GameEffectCallback,
): boolean {
  const newLane = (state.player.lane + direction) as Lane;
  if (newLane < 0 || newLane > 2) return false;
  state.player.targetLane = newLane;
  state.player.laneProgress = 0;
  effectCallback.onSound?.({ type: "lane-shift" });
  return true;
}

function applyWheelie(
  state: RunnerGameState,
  stats: MopedStats,
  effectCallback: GameEffectCallback,
): boolean {
  if (state.player.isWheeling) return false;
  state.player.isWheeling = true;
  state.player.wheelieTimer = stats.wheelieDuration;
  state.player.wheelieDuration = stats.wheelieDuration;
  effectCallback.onWheeliePop?.(getCurrentPlayerLaneFloat(state));
  effectCallback.onSound?.({ type: "wheelie" });
  return true;
}

function consumeBufferedInputs(
  state: RunnerGameState,
  stats: MopedStats,
  effectCallback: GameEffectCallback,
): void {
  if (state.player.queuedLaneDir !== 0) {
    const dir = state.player.queuedLaneDir;
    state.player.queuedLaneDir = 0;
    applyLaneShift(state, dir, effectCallback);
  }
  if (state.player.queuedWheelieMs > 0) {
    state.player.queuedWheelieMs = 0;
    applyWheelie(state, stats, effectCallback);
  }
}

function upsertTimedEffect(
  effects: ActiveEffect[],
  nextEffect: ActiveEffect,
): void {
  const existing = effects.find((e) => e.type === nextEffect.type);
  if (existing) {
    existing.timer = nextEffect.timer;
    existing.source = nextEffect.source;
  } else {
    effects.push(nextEffect);
  }
}

function checkCollisions(
  state: RunnerGameState,
  virtualWidth: number,
  stats: MopedStats,
  effectCallback: GameEffectCallback,
): void {
  const playerX = virtualWidth * PLAYER_X_POSITION;
  const playerWidth = 46; // slightly tighter, fairer arcade hitbox
  const playerLaneFloat = getCurrentPlayerLaneFloat(state);

  // Determine which lanes the player occupies (forgiving threshold near lane edges)
  const playerLanes: Lane[] = [];
  if (state.player.laneProgress >= 0.85) {
    playerLanes.push(state.player.targetLane);
  } else if (state.player.laneProgress <= 0.15) {
    playerLanes.push(state.player.lane);
  } else {
    playerLanes.push(state.player.lane);
    playerLanes.push(state.player.targetLane);
  }

  for (const entity of state.entities) {
    if (!entity.active || entity.collected) continue;

    const entityLeft = entity.x;
    const entityRight = entity.x + entity.width;
    const playerLeft = playerX - playerWidth / 2;
    const playerRight = playerX + playerWidth / 2;

    // Award CLOSE CALL when passing cleanly right next to a car in an adjacent lane!
    if (
      entity.type === "obstacle" &&
      entity.subType === "car" &&
      !entity.nearMissAwarded &&
      entityRight < playerLeft + 8 &&
      entityRight > playerLeft - 38
    ) {
      const laneDist = Math.abs(playerLaneFloat - entity.lane);
      if (laneDist >= 0.72 && laneDist <= 1.28) {
        entity.nearMissAwarded = true;
        state.closeCalls += 1;
        const mult = incrementCombo(state, stats);
        const pts = Math.round(25 * mult);
        state.bonusScore += pts;
        addPopup(state, `CLOSE CALL +${pts}`, "orange", mult > 1 ? `x${mult} COMBO` : undefined, 950);
        effectCallback.onSound?.({ type: "close-call", combo: state.combo.count });
      }
    }

    // Check X overlap
    if (entityRight < playerLeft || entityLeft > playerRight) continue;

    // Check lane overlap
    if (!playerLanes.includes(entity.lane)) continue;

    // Collision detected
    if (entity.type === "obstacle") {
      // Ground-level obstacles can be wheelied over for style bonus!
      if (entity.groundLevel && state.player.isWheeling) {
        if (!entity.wheelieCleared) {
          entity.wheelieCleared = true;
          state.wheelieClears += 1;
          const mult = incrementCombo(state, stats);
          const pts = Math.round(30 * mult * stats.wheelieBonusMultiplier);
          state.bonusScore += pts;
          addPopup(
            state,
            `WHEELIE CLEAR +${pts}`,
            "gold",
            mult > 1 ? `x${mult} COMBO` : undefined,
            1000,
          );
          effectCallback.onCollectSparkles(0, playerLaneFloat, 0xfbbf24);
          effectCallback.onSound?.({
            type: "wheelie-clear",
            combo: state.combo.count,
          });
        }
        continue;
      }

      // Invincible: skip damage
      if (state.player.isInvincible) continue;

      // Take hit
      state.player.health -= 1;
      state.player.isInvincible = true;
      state.player.invincibleTimer = stats.invincibilityMs;
      state.hitFlashTimer = HIT_FREEZE_MS;
      state.phase = "hit";
      entity.active = false;
      resetCombo(state);
      addPopup(
        state,
        state.player.health > 0 ? "OUCH!" : "WIPEOUT!",
        "red",
        state.player.health > 0 ? `${state.player.health} HP left` : undefined,
        900,
      );
      effectCallback.onHitSparks(0, playerLaneFloat);
      effectCallback.onSound?.({ type: "hit" });
      return; // Only process one hit per frame
    }

    if (entity.type === "collectible") {
      entity.collected = true;
      entity.active = false;
      const partType = entity.subType as CollectibleType;
      state.partsCollected[partType] += 1;
      const mult = incrementCombo(state, stats);
      const baseVal = PART_VALUES[partType];
      // Base part value is accounted for in computeScore; extra multiplier value goes into bonusScore
      const extraFromCombo = baseVal * (mult - 1);
      if (extraFromCombo > 0) {
        state.bonusScore += extraFromCombo;
      }
      const totalAwarded = baseVal * mult;
      const rare = partType === "cylinder" || partType === "pipe";
      if (rare || mult >= 2) {
        const label =
          partType === "cylinder"
            ? "70CC KIT"
            : partType === "pipe"
              ? "RACE PIPE"
              : partType === "jet"
                ? "BRASS JET"
                : "SPARK PLUG";
        addPopup(
          state,
          `${label} +${totalAwarded}`,
          rare ? "gold" : "cyan",
          mult > 1 ? `x${mult}` : undefined,
          800,
        );
      }
      effectCallback.onCollectSparkles(
        0,
        entity.lane,
        rare ? 0xffd700 : 0x67e8f9,
      );
      effectCallback.onSound?.({
        type: "collect",
        combo: state.combo.count,
        rare,
      });
    }

    if (entity.type === "shop") {
      entity.collected = true;
      entity.active = false;
      const shopType = entity.subType as ShopType;
      if (!state.shopsVisited.includes(shopType)) {
        state.shopsVisited.push(shopType);
      }
      const mult = incrementCombo(state, stats);
      const shopPts = 100 * mult;
      state.bonusScore += shopPts;
      effectCallback.onCollectSparkles(0, entity.lane, 0x4ade80);
      effectCallback.onSound?.({ type: "shop" });

      const effect = getShopEffect(shopType);
      if (effect.type === "repair") {
        const healed = state.player.health < state.player.maxHealth;
        state.player.health = Math.min(
          state.player.health + 1,
          state.player.maxHealth,
        );
        addPopup(
          state,
          healed ? "1977 REPAIR +1 HP!" : "1977 TUNE-UP!",
          "green",
          `+${shopPts} PTS`,
          1350,
        );
      } else if (effect.type === "speed-boost") {
        state.speedBoostTimer = SPEED_BOOST_MS;
        upsertTimedEffect(state.effects, effect);
        addPopup(state, "TREATLAND TURBO!", "gold", `SPEED BOOST • +${shopPts}`, 1350);
      } else if (effect.type === "magnet") {
        state.magnetTimer = MAGNET_MS;
        upsertTimedEffect(state.effects, effect);
        addPopup(state, "MYRON'S MAGNET!", "cyan", `PART PULL • +${shopPts}`, 1350);
      }
    }
  }
}

/**
 * Ensures we never create an unavoidable 3-lane wall of tall (non-wheelie-able) obstacles
 * or block all 3 lanes simultaneously at the spawn band.
 */
function wouldBlockAllLanes(
  entities: GameEntity[],
  candidateLane: Lane,
  spawnX: number,
  windowPx = 190,
): boolean {
  const blockedLanes = new Set<Lane>([candidateLane]);
  for (const e of entities) {
    if (!e.active || e.type !== "obstacle") continue;
    if (Math.abs(e.x - spawnX) < windowPx) {
      blockedLanes.add(e.lane);
    }
  }
  return blockedLanes.size >= 3;
}

function spawnEntities(state: RunnerGameState, virtualWidth: number): void {
  const spawnX = virtualWidth + 60;

  // 1. Obstacle spawning (with fairness guarantee)
  const obstacleInterval = Math.max(
    185,
    BASE_OBSTACLE_INTERVAL * (1 / (1 + state.distance * 0.00011)),
  );
  const distSinceObstacle = state.distance - state.lastObstacleSpawnDistance;
  if (distSinceObstacle > obstacleInterval) {
    const lane = randomLane();
    const type = pickObstacleType(state.distance);
    const dims = ENTITY_DIMS[type];
    const groundLevel = type !== "car";

    if (
      !hasEntityNearby(state.entities, lane, spawnX, MIN_LANE_GAP) &&
      !wouldBlockAllLanes(state.entities, lane, spawnX)
    ) {
      const carVariant =
        type === "car"
          ? CAR_VARIANTS[state.nextEntityId % CAR_VARIANTS.length]
          : undefined;
      const speedOffset =
        type === "car"
          ? 38 + (state.nextEntityId % 3) * 14
          : 0;

      state.entities.push({
        id: state.nextEntityId++,
        type: "obstacle",
        subType: type,
        x: spawnX,
        lane,
        width: carVariant === "van" ? dims.width + 10 : dims.width,
        height: dims.height,
        groundLevel,
        collected: false,
        active: true,
        speedOffset,
        carVariant,
      });
      state.lastObstacleSpawnDistance = state.distance;

      // Risk-reward bonus part right over ground obstacles sometimes!
      if (groundLevel && Math.random() < 0.35) {
        const rewardType: CollectibleType =
          Math.random() < 0.35 ? "cylinder" : "pipe";
        const rDims = ENTITY_DIMS[rewardType];
        state.entities.push({
          id: state.nextEntityId++,
          type: "collectible",
          subType: rewardType,
          x: spawnX + 4,
          lane,
          width: rDims.width,
          height: rDims.height,
          groundLevel: true,
          collected: false,
          active: true,
        });
      }

      // After 18 seconds, sometimes spawn a second obstacle in another lane (never blocking all 3!)
      const dualChance = Math.min(0.45, 0.22 + state.elapsedTime * 0.004);
      if (state.elapsedTime > 18 && Math.random() < dualChance) {
        const lane2 = randomLaneExcluding(lane);
        const type2 = pickObstacleType(state.distance);
        const dims2 = ENTITY_DIMS[type2];
        const spawnX2 = spawnX + 20 + Math.random() * 45;
        if (
          !hasEntityNearby(state.entities, lane2, spawnX2, MIN_LANE_GAP) &&
          !wouldBlockAllLanes(state.entities, lane2, spawnX2)
        ) {
          const carVariant2 =
            type2 === "car"
              ? CAR_VARIANTS[(state.nextEntityId + 1) % CAR_VARIANTS.length]
              : undefined;
          state.entities.push({
            id: state.nextEntityId++,
            type: "obstacle",
            subType: type2,
            x: spawnX2,
            lane: lane2,
            width: carVariant2 === "van" ? dims2.width + 10 : dims2.width,
            height: dims2.height,
            groundLevel: type2 !== "car",
            collected: false,
            active: true,
            speedOffset: type2 === "car" ? 42 : 0,
            carVariant: carVariant2,
          });
        }
      }
    }
  }

  // 2. Collectible spawning (single rare parts OR rhythmic 3-part lines!)
  const collectibleInterval = BASE_COLLECTIBLE_INTERVAL + Math.random() * 90;
  const distSinceCollectible =
    state.distance - state.lastCollectibleSpawnDistance;
  if (distSinceCollectible > collectibleInterval) {
    const lane = randomLane();
    const spawnLine = Math.random() < 0.42;

    if (spawnLine) {
      const partType: CollectibleType =
        Math.random() < 0.6 ? "spark-plug" : "jet";
      const dims = ENTITY_DIMS[partType];
      if (!hasEntityNearby(state.entities, lane, spawnX + 45, MIN_LANE_GAP * 1.4)) {
        for (let i = 0; i < 3; i++) {
          state.entities.push({
            id: state.nextEntityId++,
            type: "collectible",
            subType: partType,
            x: spawnX + i * 48,
            lane,
            width: dims.width,
            height: dims.height,
            groundLevel: true,
            collected: false,
            active: true,
          });
        }
        state.lastCollectibleSpawnDistance = state.distance + 80;
      }
    } else {
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
  }

  // 3. Shop pit-stop arch spawning
  const distSinceShop = state.distance - state.lastShopSpawnDistance;
  if (distSinceShop > BASE_SHOP_INTERVAL) {
    const lane = randomLane();
    const shopType = SHOP_CYCLE[state.nextShopIndex % SHOP_CYCLE.length]!;
    const dims = ENTITY_DIMS[shopType as EntitySubType];

    if (!hasEntityNearby(state.entities, lane, spawnX, MIN_LANE_GAP * 1.8)) {
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
      state.nextShopIndex += 1;
    }
  }
}

function pickObstacleType(distance: number): ObstacleType {
  const rand = Math.random();
  const carWeight = Math.min(0.2 + distance * 0.00003, 0.42);
  if (rand < carWeight) return "car";
  if (rand < carWeight + 0.22) return "pothole";
  if (rand < carWeight + 0.42) return "traffic-cone";
  if (rand < carWeight + 0.56) return "oil-slick";
  return "dog";
}

function pickCollectibleType(): CollectibleType {
  const rand = Math.random();
  if (rand < 0.38) return "spark-plug";
  if (rand < 0.68) return "jet";
  if (rand < 0.88) return "pipe";
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

/**
 * Responsive lane change with instant mid-shift reversal AND input buffering!
 */
export function changeLane(
  state: RunnerGameState,
  direction: -1 | 1,
  effectCallback: GameEffectCallback = noopCallback,
): RunnerGameState {
  if (state.phase === "dead" || state.phase === "hit") return state;

  const next: RunnerGameState = {
    ...state,
    player: { ...state.player },
  };

  // Buffer inputs during the last 0.4s of countdown so launch feels instant
  if (next.phase === "countdown") {
    if (next.countdownTimer <= 0.4) {
      next.player.queuedLaneDir = direction;
    }
    return next;
  }

  // Mid-transition handling: instant reversal OR buffer next hop
  if (next.player.laneProgress < 1) {
    const currentDir = Math.sign(next.player.targetLane - next.player.lane);
    if (direction === -currentDir) {
      // Instant direction cancel back to origin lane!
      const prevLane = next.player.lane;
      const reversedProgress = 1 - next.player.laneProgress;
      if (reversedProgress >= 1) {
        next.player.lane = prevLane;
        next.player.targetLane = prevLane;
        next.player.laneProgress = 1;
      } else {
        next.player.lane = next.player.targetLane;
        next.player.targetLane = prevLane;
        next.player.laneProgress = reversedProgress;
      }
      next.player.queuedLaneDir = 0;
      effectCallback.onSound?.({ type: "lane-shift" });
      return next;
    }
    // Same direction: buffer a chained shift as soon as current lane completes
    const projectedNext = next.player.targetLane + direction;
    if (projectedNext >= 0 && projectedNext <= 2) {
      next.player.queuedLaneDir = direction;
    }
    return next;
  }

  applyLaneShift(next, direction, effectCallback);
  return next;
}

/**
 * Responsive wheelie with 180ms landing input buffer!
 */
export function startWheelie(
  state: RunnerGameState,
  stats: MopedStats,
  effectCallback: GameEffectCallback = noopCallback,
): RunnerGameState {
  if (state.phase === "dead" || state.phase === "hit") return state;

  const next: RunnerGameState = {
    ...state,
    player: { ...state.player },
  };

  if (next.phase === "countdown") {
    if (next.countdownTimer <= 0.4) {
      next.player.queuedWheelieMs = INPUT_BUFFER_MS;
    }
    return next;
  }

  if (next.player.isWheeling) {
    // Buffer next wheelie if player taps right before landing
    if (next.player.wheelieTimer <= INPUT_BUFFER_MS) {
      next.player.queuedWheelieMs = INPUT_BUFFER_MS;
    }
    return next;
  }

  applyWheelie(next, stats, effectCallback);
  return next;
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
  bonusScore = 0,
): number {
  const distancePoints = Math.floor(distance / PIXELS_PER_METER);
  const partPoints =
    partsCollected["spark-plug"] * PART_VALUES["spark-plug"] +
    partsCollected.jet * PART_VALUES.jet +
    partsCollected.pipe * PART_VALUES.pipe +
    partsCollected.cylinder * PART_VALUES.cylinder;
  return distancePoints + partPoints + bonusScore;
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

  const zone = EAST_BAY_ZONES[state.zoneIndex] ?? EAST_BAY_ZONES[0]!;

  return {
    mopedMake,
    score: state.score,
    distance: Math.floor(state.distance / PIXELS_PER_METER),
    partsCollected: { ...state.partsCollected },
    totalParts,
    shopsVisited: [...state.shopsVisited],
    elapsedTime: state.elapsedTime,
    topSpeed: state.topSpeed,
    maxCombo: state.combo.maxCombo,
    wheelieClears: state.wheelieClears,
    closeCalls: state.closeCalls,
    zoneReached: zone.name,
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
