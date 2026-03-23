"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import type { MopedMake, RunnerGameState, RenderState, GameResult } from "@/lib/game/types";
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
import { RaceHUD } from "./race-hud";

interface RunnerCanvasProps {
  mopedMake: MopedMake;
  onGameOver: (result: GameResult) => void;
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

export function RaceCanvas({ mopedMake, onGameOver }: RunnerCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ThreeRenderer | null>(null);
  const gameStateRef = useRef<RunnerGameState | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const finishedRef = useRef(false);
  const touchStartRef = useRef<{ y: number; time: number } | null>(null);
  const stats = getMopedStats(mopedMake);

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

  // Input handlers
  const handleLaneChange = useCallback(
    (direction: -1 | 1) => {
      if (!gameStateRef.current || finishedRef.current) return;
      gameStateRef.current = changeLane(gameStateRef.current, direction);
    },
    [],
  );

  const handleWheelie = useCallback(() => {
    if (!gameStateRef.current || finishedRef.current) return;
    gameStateRef.current = startWheelie(gameStateRef.current, stats);
  }, [stats]);

  // Keyboard listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "ArrowUp" || e.key === "ArrowUp") {
        e.preventDefault();
        handleLaneChange(-1);
      } else if (e.code === "ArrowDown" || e.key === "ArrowDown") {
        e.preventDefault();
        handleLaneChange(1);
      } else if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        handleWheelie();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleLaneChange, handleWheelie]);

  // Game loop with PixiJS renderer (dynamic import for SSR safety)
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

        const deltaTime = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
        lastTimeRef.current = timestamp;

        const rect = container.getBoundingClientRect();
        const displayW = rect.width;
        const displayH = rect.height;

        // Step game
        if (!finishedRef.current) {
          gameStateRef.current = stepGame(
            gameStateRef.current,
            stats,
            deltaTime,
            displayW,
            effectCallback,
          );

          // Check death
          if (gameStateRef.current.phase === "dead" && !finishedRef.current) {
            finishedRef.current = true;
            const result = buildGameResult(gameStateRef.current, mopedMake);
            setTimeout(() => onGameOver(result), 800);
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
        };

        renderer.render(renderState, deltaTime);

        // Update HUD at ~15fps
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
      cleanupResize?.();
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
    };
  }, [mopedMake, stats, onGameOver]);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartRef.current = { y: touch.clientY, time: Date.now() };
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
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
      className="relative h-full w-full"
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
      />
    </div>
  );
}
