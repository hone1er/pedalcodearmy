"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import type { MopedMake, RunnerGameState, RenderState, GameResult } from "@/lib/game/types";
import { VIRTUAL_WIDTH } from "@/lib/game/types";
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
  elapsedTime: number;
  phase: RunnerGameState["phase"];
}

export function RaceCanvas({
  mopedMake,
  onGameOver,
  onRestart,
  onChangeMoped,
}: RunnerCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ThreeRenderer | null>(null);
  const gameStateRef = useRef<RunnerGameState | null>(null);
  const animFrameRef = useRef<number>(0);
  const gameOverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTimeRef = useRef<number>(0);
  const finishedRef = useRef(false);
  const isPausedRef = useRef(false);
  const touchStartRef = useRef<{ y: number; time: number } | null>(null);
  const stats = getMopedStats(mopedMake);
  const { isOpen: isCartOpen } = useCart();
  const isCartOpenRef = useRef(isCartOpen);
  isCartOpenRef.current = isCartOpen;

  const [isPaused, setIsPaused] = useState(false);
  const [hudState, setHudState] = useState<HudData>({
    score: 0,
    distance: 0,
    health: stats.maxHealth,
    maxHealth: stats.maxHealth,
    speed: 0,
    effects: [],
    elapsedTime: 0,
    phase: "countdown",
  });

  const setPaused = useCallback((nextPaused: boolean) => {
    isPausedRef.current = nextPaused;
    setIsPaused(nextPaused);
  }, []);

  const pauseGame = useCallback(() => {
    if (finishedRef.current || gameStateRef.current?.phase === "dead") return;
    if (!isPausedRef.current) {
      setPaused(true);
    }
  }, [setPaused]);

  const handleTogglePause = useCallback(() => {
    if (finishedRef.current || gameStateRef.current?.phase === "dead") return;
    setPaused(!isPausedRef.current);
  }, [setPaused]);

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
  const handleLaneChange = useCallback(
    (direction: -1 | 1) => {
      if (!gameStateRef.current || finishedRef.current || isPausedRef.current) return;
      gameStateRef.current = changeLane(gameStateRef.current, direction);
    },
    [],
  );

  const handleWheelie = useCallback(() => {
    if (!gameStateRef.current || finishedRef.current || isPausedRef.current) return;
    gameStateRef.current = startWheelie(gameStateRef.current, stats);
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

      if (target?.closest?.("button, a") && (e.key === " " || e.key === "Enter")) {
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

      if (e.code === "ArrowUp" || e.key === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        handleLaneChange(-1);
      } else if (e.code === "ArrowDown" || e.key === "ArrowDown" || e.code === "KeyS") {
        e.preventDefault();
        handleLaneChange(1);
      } else if (
        e.code === "Space" ||
        e.key === " " ||
        e.code === "ArrowRight" ||
        e.key === "ArrowRight"
      ) {
        e.preventDefault();
        handleWheelie();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleLaneChange, handleWheelie, handleTogglePause]);

  // Game loop with Three.js renderer (dynamic import for SSR safety)
  useEffect(() => {
    let cancelled = false;

    const startGame = async () => {
      const container = containerRef.current;
      if (!container) return;

      // Dynamic import to avoid SSR issues
      const { ThreeRenderer: ThreeRendererClass } = await import("@/lib/game/three-renderer");

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

      // Effect callback wired to renderer
      const effectCallback: GameEffectCallback = {
        onCollectSparkles: (x, y) => renderer.spawnCollectSparkles(x, y),
        onHitSparks: (x, y) => renderer.spawnHitSparks(x, y),
      };

      // Handle resize
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

        // Step game in fixed virtual width
        if (!finishedRef.current && !paused) {
          gameStateRef.current = stepGame(
            gameStateRef.current,
            stats,
            deltaTime,
            VIRTUAL_WIDTH,
            effectCallback,
          );

          // Check death
          if (gameStateRef.current.phase === "dead" && !finishedRef.current) {
            finishedRef.current = true;
            const result = buildGameResult(gameStateRef.current, mopedMake);
            gameOverTimeoutRef.current = setTimeout(() => {
              if (!cancelled) {
                onGameOver(result);
              }
            }, 800);
          }
        }

        // Build render state
        const state = gameStateRef.current;
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
          elapsedTime: state.elapsedTime,
          canvasWidth: displayW,
          canvasHeight: displayH,
          hitFlashTimer: state.hitFlashTimer,
          phase: state.phase,
          countdownTimer: state.countdownTimer,
          paused,
        };

        renderer.render(renderState, deltaTime);

        // Update HUD at ~15fps when active
        if (!paused) {
          hudUpdateCounter++;
          if (hudUpdateCounter % 4 === 0) {
            setHudState({
              score: state.score,
              distance: state.distance,
              health: state.player.health,
              maxHealth: state.player.maxHealth,
              speed: state.speed,
              effects: [...state.effects],
              elapsedTime: state.elapsedTime,
              phase: state.phase,
            });
          }
        }

        animFrameRef.current = requestAnimationFrame(gameLoop);
      };

      animFrameRef.current = requestAnimationFrame(gameLoop);

      // Cleanup function stored in effect's closure
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
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
    };
  }, [mopedMake, stats, onGameOver]);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isPausedRef.current) return;
    const touch = e.touches[0];
    if (touch) {
      touchStartRef.current = { y: touch.clientY, time: Date.now() };
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

      // Quick swipe threshold
      if (Math.abs(deltaY) > 30 && elapsed < 500) {
        if (deltaY < 0) {
          handleLaneChange(-1); // swipe up
        } else {
          handleLaneChange(1); // swipe down
        }
      } else if (Math.abs(deltaY) <= 30) {
        handleWheelie(); // tap
      }
    },
    [handleLaneChange, handleWheelie],
  );

  return (
    <div
      className="relative h-full w-full touch-none select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        ref={containerRef}
        className="h-full w-full"
      />
      <RaceHUD
        score={hudState.score}
        distance={hudState.distance}
        health={hudState.health}
        maxHealth={hudState.maxHealth}
        speed={hudState.speed}
        effects={hudState.effects}
        elapsedTime={hudState.elapsedTime}
        phase={hudState.phase}
        isPaused={isPaused}
        onTogglePause={handleTogglePause}
        onResume={() => setPaused(false)}
        onRestart={onRestart}
        onChangeMoped={onChangeMoped}
      />
    </div>
  );
}
