"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import type {
  MopedMake,
  RunnerGameState,
  RenderState,
  GameResult,
  GamePopup,
  ComboState,
} from "@/lib/game/types";
import { VIRTUAL_WIDTH, EAST_BAY_ZONES } from "@/lib/game/types";
import { getMopedStats } from "@/lib/game/moped-stats";
import {
  createGameState,
  stepGame,
  changeLane,
  startWheelie,
  buildGameResult,
} from "@/lib/game/game-logic";
import type { GameEffectCallback } from "@/lib/game/game-logic";
import type { ThreeRenderer } from "@/lib/game/three-renderer";
import {
  SoundEngine,
  loadMutedPreference,
} from "@/lib/game/sound-engine";
import { useCart } from "@/components/cart-context";
import { RaceHUD } from "./race-hud";

interface RunnerCanvasProps {
  mopedMake: MopedMake;
  onGameOver: (result: GameResult) => void;
  onRestart: () => void;
  onChangeMoped: () => void;
}

interface HudData {
  score: number;
  distance: number;
  health: number;
  maxHealth: number;
  speed: number;
  effects: RunnerGameState["effects"];
  combo: ComboState;
  popups: GamePopup[];
  zoneName: string;
  zoneAccent: string;
  speedBoostActive: boolean;
  elapsedTime: number;
  phase: RunnerGameState["phase"];
  countdownTimer: number;
}

export function RaceCanvas({
  mopedMake,
  onGameOver,
  onRestart,
  onChangeMoped,
}: RunnerCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ThreeRenderer | null>(null);
  const soundRef = useRef<SoundEngine | null>(null);
  const effectCallbackRef = useRef<GameEffectCallback | null>(null);
  const gameStateRef = useRef<RunnerGameState | null>(null);
  const animFrameRef = useRef<number>(0);
  const gameOverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTimeRef = useRef<number>(0);
  const finishedRef = useRef(false);
  const isPausedRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(
    null,
  );
  const stats = getMopedStats(mopedMake);
  const { isOpen: isCartOpen } = useCart();
  const isCartOpenRef = useRef(isCartOpen);
  isCartOpenRef.current = isCartOpen;

  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(() => loadMutedPreference());
  const [hudState, setHudState] = useState<HudData>({
    score: 0,
    distance: 0,
    health: stats.maxHealth,
    maxHealth: stats.maxHealth,
    speed: stats.baseSpeed,
    effects: [],
    combo: {
      count: 0,
      multiplier: 1,
      timer: 0,
      maxTimer: stats.comboWindowMs,
      maxCombo: 0,
    },
    popups: [],
    zoneName: EAST_BAY_ZONES[0]!.name,
    zoneAccent: EAST_BAY_ZONES[0]!.accentHex,
    speedBoostActive: false,
    elapsedTime: 0,
    phase: "countdown",
    countdownTimer: 3,
  });

  const setPaused = useCallback((nextPaused: boolean) => {
    isPausedRef.current = nextPaused;
    setIsPaused(nextPaused);
    if (nextPaused) {
      soundRef.current?.updateEngine(0, false, false, false);
    }
  }, []);

  const pauseGame = useCallback(() => {
    if (finishedRef.current || gameStateRef.current?.phase === "dead") return;
    if (!isPausedRef.current) {
      setPaused(true);
    }
  }, [setPaused]);

  const handleTogglePause = useCallback(() => {
    if (finishedRef.current || gameStateRef.current?.phase === "dead") return;
    soundRef.current?.unlock();
    setPaused(!isPausedRef.current);
  }, [setPaused]);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const nextMuted = !prev;
      soundRef.current?.setMuted(nextMuted);
      if (!nextMuted) {
        soundRef.current?.unlock();
      }
      return nextMuted;
    });
  }, []);

  // Auto-pause when cart drawer opens, tab becomes hidden, or window loses focus
  useEffect(() => {
    if (isCartOpen) {
      pauseGame();
    }
  }, [isCartOpen, pauseGame]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        pauseGame();
      }
    };
    const handleWindowBlur = () => {
      pauseGame();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [pauseGame]);

  // Input handlers
  const handleLaneChange = useCallback((direction: -1 | 1) => {
    soundRef.current?.unlock();
    if (!gameStateRef.current || finishedRef.current || isPausedRef.current) {
      return;
    }
    gameStateRef.current = changeLane(
      gameStateRef.current,
      direction,
      effectCallbackRef.current ?? undefined,
    );
  }, []);

  const handleWheelie = useCallback(() => {
    soundRef.current?.unlock();
    if (!gameStateRef.current || finishedRef.current || isPausedRef.current) {
      return;
    }
    gameStateRef.current = startWheelie(
      gameStateRef.current,
      stats,
      effectCallbackRef.current ?? undefined,
    );
  }, [stats]);

  // Keyboard listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;

      const target = e.target as HTMLElement | null;
      if (
        target?.closest?.(
          'input, textarea, select, [contenteditable], [role="dialog"]:not([data-game-pause])',
        )
      ) {
        return;
      }

      if (
        target?.closest?.("button, a") &&
        (e.key === " " || e.key === "Enter")
      ) {
        return;
      }

      if (
        e.code === "KeyP" ||
        e.key === "p" ||
        e.key === "P" ||
        e.code === "Escape" ||
        e.key === "Escape"
      ) {
        if (e.repeat) return;
        e.preventDefault();
        handleTogglePause();
        return;
      }

      if (e.code === "KeyM" || e.key === "m" || e.key === "M") {
        if (e.repeat) return;
        e.preventDefault();
        handleToggleMute();
        return;
      }

      if (e.code === "ArrowUp" || e.key === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        if (!e.repeat) handleLaneChange(-1);
      } else if (
        e.code === "ArrowDown" ||
        e.key === "ArrowDown" ||
        e.code === "KeyS"
      ) {
        e.preventDefault();
        if (!e.repeat) handleLaneChange(1);
      } else if (
        e.code === "Space" ||
        e.key === " " ||
        e.code === "ArrowRight" ||
        e.key === "ArrowRight" ||
        e.code === "KeyD"
      ) {
        e.preventDefault();
        if (!e.repeat) handleWheelie();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleLaneChange, handleWheelie, handleTogglePause, handleToggleMute]);

  // Game loop with Three.js renderer & Web Audio sound engine
  useEffect(() => {
    let cancelled = false;

    const sound = new SoundEngine(loadMutedPreference());
    sound.unlock();
    soundRef.current = sound;

    const startGame = async () => {
      const container = containerRef.current;
      if (!container) return;

      const { ThreeRenderer: ThreeRendererClass } = await import(
        "@/lib/game/three-renderer"
      );

      if (cancelled) return;

      const renderer = new ThreeRendererClass(container);
      await renderer.init();

      if (cancelled) {
        renderer.destroy();
        return;
      }

      rendererRef.current = renderer;
      finishedRef.current = false;
      const shouldStartPaused =
        isCartOpenRef.current || document.visibilityState === "hidden";
      isPausedRef.current = shouldStartPaused;
      setIsPaused(shouldStartPaused);
      gameStateRef.current = createGameState(mopedMake);
      lastTimeRef.current = performance.now();
      let hudUpdateCounter = 0;

      const effectCallback: GameEffectCallback = {
        onCollectSparkles: (worldX, lane, color) =>
          renderer.spawnCollectSparkles(worldX, lane, color),
        onHitSparks: (worldX, lane) => renderer.spawnHitSparks(worldX, lane),
        onWheeliePop: (lane) => renderer.spawnWheeliePop(lane),
        onSound: (event) => sound.play(event),
      };
      effectCallbackRef.current = effectCallback;

      const handleResize = () => {
        const rect = container.getBoundingClientRect();
        renderer.resize(rect.width, rect.height);
      };
      window.addEventListener("resize", handleResize);

      const gameLoop = (timestamp: number) => {
        if (cancelled) return;
        if (!gameStateRef.current) return;

        const paused = isPausedRef.current;
        const deltaTime = paused
          ? 0
          : Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
        lastTimeRef.current = timestamp;

        const rect = container.getBoundingClientRect();
        const displayW = rect.width;
        const displayH = rect.height;

        if (!finishedRef.current && !paused) {
          gameStateRef.current = stepGame(
            gameStateRef.current,
            stats,
            deltaTime,
            VIRTUAL_WIDTH,
            effectCallback,
          );

          if (gameStateRef.current.phase === "dead" && !finishedRef.current) {
            finishedRef.current = true;
            sound.updateEngine(0, false, false, false);
            const result = buildGameResult(gameStateRef.current, mopedMake);
            gameOverTimeoutRef.current = setTimeout(() => {
              if (!cancelled) {
                onGameOver(result);
              }
            }, 850);
          }
        }

        const state = gameStateRef.current;
        const speedBoostActive = state.speedBoostTimer > 0;
        const magnetActive = state.magnetTimer > 0;

        // Modulate two-stroke engine sound
        sound.updateEngine(
          state.speed,
          !paused && state.phase === "running",
          state.player.isWheeling,
          speedBoostActive,
        );

        const renderState: RenderState = {
          moped: mopedMake,
          player: state.player,
          entities: state.entities,
          speed: state.speed,
          distance: state.distance,
          score: state.score,
          health: state.player.health,
          maxHealth: state.player.maxHealth,
          effects: state.effects,
          combo: state.combo,
          zoneIndex: state.zoneIndex,
          speedBoostActive,
          magnetActive,
          elapsedTime: state.elapsedTime,
          canvasWidth: displayW,
          canvasHeight: displayH,
          hitFlashTimer: state.hitFlashTimer,
          phase: state.phase,
          countdownTimer: state.countdownTimer,
          paused,
        };

        renderer.render(renderState, deltaTime);

        // Update HUD at ~20fps for crisp countdown, combo bar, speedometer & popups
        if (!paused) {
          hudUpdateCounter++;
          if (hudUpdateCounter % 3 === 0) {
            const zone = EAST_BAY_ZONES[state.zoneIndex] ?? EAST_BAY_ZONES[0]!;
            setHudState({
              score: state.score,
              distance: state.distance,
              health: state.player.health,
              maxHealth: state.player.maxHealth,
              speed: speedBoostActive ? state.speed * 1.32 : state.speed,
              effects: [...state.effects],
              combo: { ...state.combo },
              popups: state.popups.map((p) => ({ ...p })),
              zoneName: zone.name,
              zoneAccent: zone.accentHex,
              speedBoostActive,
              elapsedTime: state.elapsedTime,
              phase: state.phase,
              countdownTimer: state.countdownTimer,
            });
          }
        }

        animFrameRef.current = requestAnimationFrame(gameLoop);
      };

      animFrameRef.current = requestAnimationFrame(gameLoop);

      return () => {
        window.removeEventListener("resize", handleResize);
      };
    };

    let cleanupResize: (() => void) | undefined;
    void startGame().then((cleanup) => {
      cleanupResize = cleanup;
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrameRef.current);
      if (gameOverTimeoutRef.current !== null) {
        clearTimeout(gameOverTimeoutRef.current);
        gameOverTimeoutRef.current = null;
      }
      cleanupResize?.();
      effectCallbackRef.current = null;
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
      sound.destroy();
      if (soundRef.current === sound) {
        soundRef.current = null;
      }
    };
  }, [mopedMake, stats, onGameOver]);

  // Swipe + tap touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    soundRef.current?.unlock();
    if (isPausedRef.current) return;
    const touch = e.touches[0];
    if (touch) {
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (isPausedRef.current) {
        touchStartRef.current = null;
        return;
      }
      const touch = e.changedTouches[0];
      if (!touch || !touchStartRef.current) return;

      const deltaY = touch.clientY - touchStartRef.current.y;
      const elapsed = Date.now() - touchStartRef.current.time;
      touchStartRef.current = null;

      if (Math.abs(deltaY) > 26 && elapsed < 500) {
        handleLaneChange(deltaY < 0 ? -1 : 1);
      } else if (Math.abs(deltaY) <= 26) {
        handleWheelie();
      }
    },
    [handleLaneChange, handleWheelie],
  );

  return (
    <div
      className="relative h-full w-full touch-none select-none overflow-hidden rounded-none border-4 border-[#FFD700] bg-black shadow-[0_0_32px_rgba(255,215,0,0.18)]"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div ref={containerRef} className="h-full w-full" />
      <RaceHUD
        score={hudState.score}
        distance={hudState.distance}
        health={hudState.health}
        maxHealth={hudState.maxHealth}
        speed={hudState.speed}
        effects={hudState.effects}
        combo={hudState.combo}
        popups={hudState.popups}
        zoneName={hudState.zoneName}
        zoneAccent={hudState.zoneAccent}
        speedBoostActive={hudState.speedBoostActive}
        elapsedTime={hudState.elapsedTime}
        phase={hudState.phase}
        countdownTimer={hudState.countdownTimer}
        isPaused={isPaused}
        isMuted={isMuted}
        onTogglePause={handleTogglePause}
        onToggleMute={handleToggleMute}
        onResume={() => setPaused(false)}
        onRestart={onRestart}
        onChangeMoped={onChangeMoped}
        onLaneUp={() => handleLaneChange(-1)}
        onLaneDown={() => handleLaneChange(1)}
        onWheelie={handleWheelie}
      />
    </div>
  );
}
