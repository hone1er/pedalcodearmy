// Neo-brutalist Canvas 2D 3-Lane East Bay Street Runner renderer.
// Visually cohesive with Ran When Parked's graphic-novel Oakland aesthetic.

import type { SimBikeMake, SmokeTint } from "../contract";
import {
  RUNNER_ZONES,
  type RunnerCollectibleKind,
  type RunnerEntity,
  type RunnerShopKind,
  type RunnerState,
  type RunnerZone,
} from "./runner-sim";

interface SmokePuff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  age: number;
  maxAge: number;
  tint: SmokeTint;
}

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface RoadMetrics {
  horizonY: number;
  roadH: number;
  curbH: number;
  laneTop: number;
  laneAreaH: number;
  laneH: number;
  laneY: (laneFloat: number) => number;
  playerScreenX: number;
  pxPerMeter: number;
}

interface BlendedSkyPalette {
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  sunColor: string;
  farHill: string;
  midBuilding: string;
  nightMix: number;
  zone: RunnerZone;
  prevZone: RunnerZone;
  blendT: number;
}

const ZONE_STEP_M = 350;
const ZONE_BLEND_M = 40;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const num = Number.parseInt(full, 16);
  if (Number.isNaN(num)) return [0, 0, 0];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function lerpColor(hexA: string, hexB: string, t: number): string {
  if (t <= 0.001) return hexA;
  if (t >= 0.999) return hexB;
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

/** 2.5D lane depth scale: 0.92 top lane, 1.0 middle lane, 1.08 foreground bottom lane. */
function laneDepthScale(lanePos: number): number {
  return 0.92 + clamp(lanePos, 0, 2) * 0.08;
}

export class RunnerRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width = 960;
  private height = 430;
  private dpr = 1;

  private wheelAngle = 0;
  private smokePuffs: SmokePuff[] = [];
  private sparks: SparkParticle[] = [];
  private smokeTimer = 0;
  private deathSparkTimer = 0;
  private deathSmokeTimer = 0;

  private smoothGrade = 0;
  private prevTurboSec = 0;
  private turboZoomPulse = 0;

  private fontBangers = 'Impact, "Arial Black", sans-serif';
  private fontRusso = '"Arial Black", sans-serif';
  private fontsResolved = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not initialize 2D context for Street Runner");
    }
    this.ctx = ctx;
    this.resolveFonts();
    this.resize(canvas.clientWidth || 960, canvas.clientHeight || 430);
  }

  private resolveFonts(): void {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const rootStyle = getComputedStyle(document.documentElement);
    const canvasStyle = getComputedStyle(this.canvas);
    const bangers =
      canvasStyle.getPropertyValue("--font-bangers").trim() ||
      rootStyle.getPropertyValue("--font-bangers").trim();
    const russo =
      canvasStyle.getPropertyValue("--font-russo-one").trim() ||
      rootStyle.getPropertyValue("--font-russo-one").trim();

    if (bangers) {
      this.fontBangers = `${bangers}, Impact, "Arial Black", sans-serif`;
    }
    if (russo) {
      this.fontRusso = `${russo}, "Arial Black", sans-serif`;
    }
    this.fontsResolved = Boolean(bangers || russo);
  }

  private getRoadMetrics(): RoadMetrics {
    const w = this.width;
    const h = this.height;
    const horizonY = Math.round(h * 0.44);
    const roadH = h - horizonY;
    const curbH = 12;
    const laneTop = horizonY + curbH + 10;
    const laneAreaH = roadH - curbH - 22;
    const laneH = laneAreaH / 3;
    const laneY = (laneFloat: number) => laneTop + (laneFloat + 0.5) * laneH;
    const playerScreenX = Math.round(w * 0.2);
    const pxPerMeter = Math.max(11, Math.min(18, w / 58));
    return {
      horizonY,
      roadH,
      curbH,
      laneTop,
      laneAreaH,
      laneH,
      laneY,
      playerScreenX,
      pxPerMeter,
    };
  }

  resize(width: number, height: number): void {
    const w = Math.max(300, Math.floor(width));
    const h = Math.max(240, Math.floor(height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w === this.width && h === this.height && dpr === this.dpr) return;
    this.width = w;
    this.height = h;
    this.dpr = dpr;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
  }

  spawnBurst(x: number, y: number, color: string, count = 10): void {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const spd = 70 + Math.random() * 140;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 40,
        life: 0.45 + Math.random() * 0.25,
        color,
      });
    }
  }

  spawnBurstAtPlayer(state: RunnerState, color: string, count = 10): void {
    const { playerScreenX, laneY } = this.getRoadMetrics();
    const py = laneY(state.lanePos) - 8 - state.wheelieHeightFrac * 10;
    this.spawnBurst(playerScreenX, py, color, count);
  }

  private getBlendedPalette(state: RunnerState): BlendedSkyPalette {
    const idx = ((state.zoneIndex % RUNNER_ZONES.length) + RUNNER_ZONES.length) % RUNNER_ZONES.length;
    const zone = RUNNER_ZONES[idx] ?? RUNNER_ZONES[0]!;
    const prevIdx = (idx + RUNNER_ZONES.length - 1) % RUNNER_ZONES.length;
    const prevZone = RUNNER_ZONES[prevIdx] ?? zone;
    const localM = state.distanceM % ZONE_STEP_M;
    const rawT = state.distanceM >= ZONE_STEP_M ? clamp(localM / ZONE_BLEND_M, 0, 1) : 1;
    const t = rawT * rawT * (3 - 2 * rawT);

    return {
      skyTop: lerpColor(prevZone.skyTop, zone.skyTop, t),
      skyMid: lerpColor(prevZone.skyMid, zone.skyMid, t),
      skyBottom: lerpColor(prevZone.skyBottom, zone.skyBottom, t),
      sunColor: lerpColor(prevZone.sunColor, zone.sunColor, t),
      farHill: lerpColor(prevZone.farHill, zone.farHill, t),
      midBuilding: lerpColor(prevZone.midBuilding, zone.midBuilding, t),
      nightMix: (prevZone.isNight ? 1 : 0) * (1 - t) + (zone.isNight ? 1 : 0) * t,
      zone,
      prevZone,
      blendT: t,
    };
  }

  render(state: RunnerState, dt: number): void {
    if (!this.fontsResolved) {
      this.resolveFonts();
    }

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const metrics = this.getRoadMetrics();
    const { horizonY, roadH, curbH, laneTop, laneH, laneY, playerScreenX, pxPerMeter } = metrics;
    const palette = this.getBlendedPalette(state);
    const isNightView = palette.nightMix >= 0.45;

    // Smooth grade & turbo punch-zoom tracking
    this.smoothGrade += (state.gradePct - this.smoothGrade) * clamp(dt * 4.5, 0, 1);
    if (state.turboSec > 0 && this.prevTurboSec <= 0) {
      this.turboZoomPulse = 1;
    }
    this.prevTurboSec = state.turboSec;
    this.turboZoomPulse = Math.max(0, this.turboZoomPulse - dt * 2.1);

    // Wheel spin & particles
    const seizedLocked = state.dying && state.deathReason === "seized";
    if (!state.engine.wheelLocked && !seizedLocked) {
      this.wheelAngle += state.speedMps * dt * 2.4;
    }
    const playerY = laneY(state.lanePos);
    this.updateParticles(state, dt, playerScreenX, playerY);

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // Camera shake on hit/seize
    if (state.cameraShakeSec > 0) {
      const mag = Math.min(8, state.cameraShakeSec * 18);
      ctx.translate((Math.random() - 0.5) * mag * 2, (Math.random() - 0.5) * mag * 2);
    }

    // Subtle turbo punch-zoom (1.03x peak on trigger toward player)
    const turboZoom =
      state.turboSec > 0 ? 1 + 0.01 + this.turboZoomPulse * 0.02 : 1 + this.turboZoomPulse * 0.02;
    if (turboZoom > 1.0005) {
      ctx.translate(playerScreenX, playerY);
      ctx.scale(turboZoom, turboZoom);
      ctx.translate(-playerScreenX, -playerY);
    }

    // Subtle visual road/horizon pitch cue on Oakland Hills climbs & West Oakland descents
    const gradeTiltRad =
      Math.abs(this.smoothGrade) >= 1.2 ? -clamp(this.smoothGrade, -8, 10) * 0.0036 : 0;
    if (Math.abs(gradeTiltRad) > 0.0005) {
      ctx.translate(playerScreenX, playerY);
      ctx.rotate(gradeTiltRad);
      ctx.translate(-playerScreenX, -playerY);
    }

    // 1. Sky + Sun/Moon (smoothly crossfaded across zones)
    this.drawSky(ctx, w, horizonY, palette, state.distanceM);

    // 2. Signature East Bay Zone Skylines (with ~40m crossfade)
    this.drawSkyline(ctx, w, horizonY, palette, state.distanceM, state.elapsedSec);

    // 3. 3-Lane Asphalt Boulevard (+ grade cues)
    this.drawRoad(ctx, w, h, horizonY, curbH, laneTop, laneH, state, pxPerMeter);

    // 4. Depth-sorted draw list (by lanePos so foreground lanes overlap background lanes)
    type DrawItem = { sortY: number; draw: () => void };
    const drawList: DrawItem[] = [];

    for (const ent of state.entities) {
      const ex = playerScreenX + (ent.xM - state.distanceM) * pxPerMeter;
      if (ex < -180 || ex > w + 180) continue;
      const ey = laneY(ent.lanePos);
      drawList.push({
        sortY: ent.kind === "shop" ? horizonY + roadH + 20 : ey,
        draw: () => this.drawEntity(ctx, ent, ex, ey, laneTop, laneH, state.elapsedSec, isNightView),
      });
    }

    drawList.push({
      sortY: playerY + 1,
      draw: () => this.drawMopedAndRider(ctx, state, playerScreenX, playerY, isNightView),
    });

    drawList.sort((a, b) => a.sortY - b.sortY);
    for (const item of drawList) item.draw();

    // 5. Exhaust Smoke & Burst Sparks
    this.drawParticles(ctx);

    // 6. Red Closing-Traffic Right-Edge Lane Warnings
    this.drawClosingTrafficWarnings(ctx, state, metrics);

    // 7. Speed lines on Powerband / Treatland Turbo + Headwind streaks
    if ((state.engine.powerbandActive || state.turboSec > 0) && state.speedMps > 9) {
      this.drawSpeedLines(ctx, w, h, state.turboSec > 0 ? "#FFD700" : "#38BDF8", state.elapsedSec);
    }
    if (state.headwindActive) {
      this.drawHeadwindStreaks(ctx, w, h, state.elapsedSec);
    }

    // 8. Wipeout / Seize / Stall Comic Halftone Splash Banner
    if (state.dying && state.deathElapsedSec >= 0.35 && state.deathReason) {
      this.drawDeathSplashBanner(ctx, w, h, state.deathReason, state.deathElapsedSec);
    }

    // 9. Hit flash overlay
    if (state.hitFlashSec > 0) {
      ctx.fillStyle = `rgba(239, 68, 68, ${Math.min(0.45, state.hitFlashSec * 1.1)})`;
      ctx.fillRect(-40, -40, w + 80, h + 80);
    }

    ctx.restore();
  }

  private drawSky(
    ctx: CanvasRenderingContext2D,
    w: number,
    horizonY: number,
    palette: BlendedSkyPalette,
    distanceM: number,
  ): void {
    const grad = ctx.createLinearGradient(0, -40, 0, horizonY + 8);
    grad.addColorStop(0, palette.skyTop);
    grad.addColorStop(0.62, palette.skyMid);
    grad.addColorStop(1, palette.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(-50, -50, w + 100, horizonY + 60);

    // Sun / Moon
    const sunX = w * 0.78;
    const sunY = horizonY * 0.38;
    const sunR = palette.nightMix > 0.5 ? 20 : 28;
    ctx.save();
    ctx.fillStyle = palette.sunColor;
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // Night stars fade in/out smoothly across zone transitions
    if (palette.nightMix > 0.05) {
      ctx.save();
      ctx.fillStyle = "#FEF08A";
      ctx.globalAlpha = palette.nightMix;
      for (let i = 0; i < 24; i++) {
        const sx = (((i * 137 + 43 - distanceM * 0.4) % w) + w) % w;
        const sy = 12 + ((i * 59) % Math.max(20, horizonY - 50));
        ctx.fillRect(sx, sy, i % 3 === 0 ? 2.5 : 1.5, i % 3 === 0 ? 2.5 : 1.5);
      }
      ctx.restore();
    }
  }

  private drawSkyline(
    ctx: CanvasRenderingContext2D,
    w: number,
    horizonY: number,
    palette: BlendedSkyPalette,
    distanceM: number,
    elapsedSec: number,
  ): void {
    // Far East Bay Hills (always continuous with smoothly interpolated farHill color)
    const hillScroll = distanceM * 1.8;
    const extraSteep =
      palette.zone.id === "oakland-hills"
        ? palette.blendT
        : palette.prevZone.id === "oakland-hills"
          ? 1 - palette.blendT
          : 0;
    ctx.fillStyle = palette.farHill;
    ctx.beginPath();
    ctx.moveTo(-50, horizonY + 10);
    for (let x = -40; x <= w + 60; x += 20) {
      const worldX = x + hillScroll;
      const y =
        horizonY -
        (32 + extraSteep * 16) -
        Math.sin(worldX * 0.0055) * (18 + extraSteep * 14) -
        Math.cos(worldX * 0.012) * (9 + extraSteep * 5);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w + 60, horizonY + 10);
    ctx.closePath();
    ctx.fill();

    // Crossfade zone-specific iconic skyline silhouettes over the 40m transition
    if (palette.blendT < 0.999 && palette.prevZone.id !== palette.zone.id) {
      ctx.save();
      ctx.globalAlpha = 1 - palette.blendT;
      this.drawZoneLandmarkLayer(ctx, w, horizonY, palette.prevZone.id, palette, distanceM, elapsedSec);
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = palette.blendT;
    this.drawZoneLandmarkLayer(ctx, w, horizonY, palette.zone.id, palette, distanceM, elapsedSec);
    ctx.restore();
  }

  private drawZoneLandmarkLayer(
    ctx: CanvasRenderingContext2D,
    w: number,
    horizonY: number,
    zoneId: RunnerZone["id"],
    palette: BlendedSkyPalette,
    distanceM: number,
    elapsedSec: number,
  ): void {
    switch (zoneId) {
      case "oakland-hills": {
        this.drawOaklandHillsSkyline(ctx, w, horizonY, palette, distanceM, elapsedSec);
        break;
      }
      case "lake-merritt": {
        this.drawLakeMerrittSkyline(ctx, w, horizonY, palette, distanceM, elapsedSec);
        break;
      }
      case "telegraph-ave": {
        this.drawTelegraphAveSkyline(ctx, w, horizonY, palette, distanceM, elapsedSec);
        break;
      }
      case "bay-bridge": {
        this.drawBayBridgeSkyline(ctx, w, horizonY, palette, distanceM, elapsedSec);
        break;
      }
      case "west-oakland": {
        this.drawWestOaklandSkyline(ctx, w, horizonY, palette, distanceM);
        break;
      }
    }
  }

  private drawOaklandHillsSkyline(
    ctx: CanvasRenderingContext2D,
    w: number,
    horizonY: number,
    palette: BlendedSkyPalette,
    distanceM: number,
    elapsedSec: number,
  ): void {
    // Secondary wooded ridge
    const ridgeScroll = distanceM * 3.1;
    ctx.fillStyle = palette.midBuilding;
    ctx.beginPath();
    ctx.moveTo(-50, horizonY + 6);
    for (let x = -40; x <= w + 60; x += 24) {
      const wx = x + ridgeScroll;
      const y = horizonY - 22 - Math.sin(wx * 0.008) * 14 - Math.cos(wx * 0.017) * 7;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w + 60, horizonY + 6);
    ctx.closePath();
    ctx.fill();

    // Tall Redwood silhouettes + Grizzly Peak radio tower repeating every 560px
    const tile = 560;
    const midScroll = (distanceM * 4.8) % tile;
    for (let base = -midScroll; base < w + tile; base += tile) {
      // Redwood clusters
      const redwoods = [
        { x: 48, h: 68, rw: 20 },
        { x: 74, h: 86, rw: 24 },
        { x: 102, h: 60, rw: 18 },
        { x: 245, h: 78, rw: 22 },
        { x: 274, h: 94, rw: 26 },
        { x: 304, h: 66, rw: 19 },
        { x: 460, h: 74, rw: 22 },
        { x: 492, h: 58, rw: 18 },
      ];
      for (const tree of redwoods) {
        const tx = base + tree.x;
        const topY = horizonY - tree.h;
        ctx.fillStyle = "#14532D";
        ctx.strokeStyle = "#09090B";
        ctx.lineWidth = 1.8;
        // 3-tier redwood spire silhouette
        for (let tier = 0; tier < 3; tier++) {
          const tierTop = topY + tier * (tree.h * 0.22);
          const tierBot = topY + (tier + 1.45) * (tree.h * 0.28);
          const halfW = tree.rw * (0.42 + tier * 0.22);
          ctx.beginPath();
          ctx.moveTo(tx, tierTop);
          ctx.lineTo(tx - halfW, Math.min(horizonY, tierBot));
          ctx.lineTo(tx + halfW, Math.min(horizonY, tierBot));
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        // Trunk
        ctx.fillStyle = "#451A03";
        ctx.fillRect(tx - 3, horizonY - 14, 6, 14);
      }

      // Hillside radio tower (Grizzly / Vollmer Peak)
      const rx = base + 390;
      const baseY = horizonY - 26;
      const peakY = horizonY - 108;
      ctx.strokeStyle = "#09090B";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(rx - 12, baseY);
      ctx.lineTo(rx, peakY);
      ctx.lineTo(rx + 12, baseY);
      ctx.moveTo(rx - 8, baseY - 26);
      ctx.lineTo(rx + 8, baseY - 26);
      ctx.moveTo(rx - 5, baseY - 52);
      ctx.lineTo(rx + 5, baseY - 52);
      ctx.stroke();
      ctx.strokeStyle = "#E4E4E7";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Blinking aviation beacon
      const beaconPulse = 0.45 + 0.55 * Math.abs(Math.sin(elapsedSec * 3.5));
      ctx.fillStyle = `rgba(239, 68, 68, ${beaconPulse})`;
      ctx.beginPath();
      ctx.arc(rx, peakY - 3, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    this.drawPalmTrees(ctx, w, horizonY, distanceM);
  }

  private drawLakeMerrittSkyline(
    ctx: CanvasRenderingContext2D,
    w: number,
    horizonY: number,
    palette: BlendedSkyPalette,
    distanceM: number,
    elapsedSec: number,
  ): void {
    // Low downtown silhouette behind the lake
    const tile = 680;
    const midScroll = (distanceM * 3.8) % tile;
    for (let base = -midScroll; base < w + tile; base += tile) {
      const blocks = [
        { x: 60, bw: 48, bh: 68 },
        { x: 118, bw: 56, bh: 92 },
        { x: 310, bw: 44, bh: 74 },
        { x: 500, bw: 62, bh: 64 },
      ];
      ctx.fillStyle = palette.midBuilding;
      ctx.strokeStyle = "#09090B";
      ctx.lineWidth = 2;
      for (const b of blocks) {
        ctx.fillRect(base + b.x, horizonY - 24 - b.bh, b.bw, b.bh);
        ctx.strokeRect(base + b.x, horizonY - 24 - b.bh, b.bw, b.bh);
      }
    }

    // Shimmering lakeside water band at the horizon
    const waterH = 28;
    const waterTop = horizonY - waterH;
    const waterGrad = ctx.createLinearGradient(0, waterTop, 0, horizonY);
    waterGrad.addColorStop(0, "#1E3A8A");
    waterGrad.addColorStop(0.55, "#0369A1");
    waterGrad.addColorStop(1, "#0C4A6E");
    ctx.fillStyle = waterGrad;
    ctx.fillRect(-50, waterTop, w + 100, waterH + 2);
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-50, waterTop);
    ctx.lineTo(w + 50, waterTop);
    ctx.stroke();

    // Sun reflection shimmer on the water
    const sunX = w * 0.78;
    for (let i = 0; i < 6; i++) {
      const ry = waterTop + 5 + i * 4;
      const rw = 36 - i * 4 + Math.sin(elapsedSec * 5 + i) * 6;
      ctx.fillStyle = "rgba(253, 186, 116, 0.35)";
      ctx.fillRect(sunX - rw / 2, ry, rw, 2);
    }

    // Iconic Necklace of Lights: shoreline posts, draped catenary strings, warm bulbs & water reflections
    const postStep = 64;
    const lightScroll = (distanceM * 6.2) % postStep;
    const postTopY = waterTop - 22;
    const startX = -lightScroll - postStep;
    const endX = w + postStep * 2;

    for (let px = startX; px < endX; px += postStep) {
      // Lamppost
      ctx.strokeStyle = "#09090B";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px, waterTop + 2);
      ctx.lineTo(px, postTopY);
      ctx.stroke();

      // String wire swag to next post
      const nextPx = px + postStep;
      const midX = (px + nextPx) * 0.5;
      const sagY = postTopY + 11;
      ctx.strokeStyle = "#18181B";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(px, postTopY + 2);
      ctx.quadraticCurveTo(midX, sagY, nextPx, postTopY + 2);
      ctx.stroke();

      // 4 glowing necklace bulbs per span + water reflections
      for (let b = 0; b <= 3; b++) {
        const u = b / 3;
        const bx = px + (nextPx - px) * u;
        const by =
          (1 - u) * (1 - u) * (postTopY + 2) +
          2 * (1 - u) * u * sagY +
          u * u * (postTopY + 2);
        const twinkle = 0.78 + 0.22 * Math.sin(elapsedSec * 6 + bx * 0.08);

        // Glow halo
        ctx.fillStyle = `rgba(255, 215, 0, ${0.32 * twinkle})`;
        ctx.beginPath();
        ctx.arc(bx, by, 7, 0, Math.PI * 2);
        ctx.fill();

        // Bulb core
        ctx.fillStyle = "#FEF08A";
        ctx.beginPath();
        ctx.arc(bx, by, 2.8, 0, Math.PI * 2);
        ctx.fill();

        // Shimmering water reflection below bulb
        const shimmer = Math.sin(elapsedSec * 7 + bx * 0.1) * 2.5;
        ctx.fillStyle = `rgba(253, 224, 71, ${0.42 * twinkle})`;
        ctx.fillRect(bx - 2 + shimmer, waterTop + 4, 4, 3);
        ctx.fillRect(bx - 1.5 - shimmer * 0.7, waterTop + 11, 3, 2.5);
        ctx.fillRect(bx - 1 + shimmer * 0.5, waterTop + 18, 2.5, 2);
      }
    }

    this.drawPalmTrees(ctx, w, horizonY, distanceM);
  }

  private drawTelegraphAveSkyline(
    ctx: CanvasRenderingContext2D,
    w: number,
    horizonY: number,
    palette: BlendedSkyPalette,
    distanceM: number,
    elapsedSec: number,
  ): void {
    const tile = 720;
    const midScroll = (distanceM * 5.2) % tile;

    for (let base = -midScroll; base < w + tile; base += tile) {
      // Urban storefronts with glowing neon Oakland signs
      const stores: Array<{
        x: number;
        bw: number;
        bh: number;
        sign: string;
        neon: string;
      }> = [
        { x: 40, bw: 76, bh: 64, sign: "CAFÉ", neon: "#22D3EE" },
        { x: 126, bw: 82, bh: 74, sign: "TACOS", neon: "#F97316" },
        { x: 222, bw: 60, bh: 92, sign: "RECORDS", neon: "#F472B6" },
        { x: 472, bw: 86, bh: 70, sign: "MOPEDS", neon: "#FFD700" },
        { x: 572, bw: 68, bh: 56, sign: "CAFÉ", neon: "#4ADE80" },
      ];

      for (const st of stores) {
        const sx = base + st.x;
        ctx.fillStyle = palette.midBuilding;
        ctx.strokeStyle = "#09090B";
        ctx.lineWidth = 2;
        ctx.fillRect(sx, horizonY - st.bh, st.bw, st.bh);
        ctx.strokeRect(sx, horizonY - st.bh, st.bw, st.bh);

        // Upper windows
        ctx.fillStyle = "#FDE047";
        for (let wy = horizonY - st.bh + 10; wy < horizonY - 30; wy += 14) {
          for (let wx = sx + 10; wx < sx + st.bw - 12; wx += 16) {
            ctx.fillRect(wx, wy, 7, 7);
          }
        }

        // Neon storefront sign board
        const pulse = 0.8 + 0.2 * Math.sin(elapsedSec * 7 + st.x);
        ctx.save();
        ctx.fillStyle = "#09090B";
        ctx.strokeStyle = st.neon;
        ctx.lineWidth = 2;
        ctx.fillRect(sx + 6, horizonY - 26, st.bw - 12, 16);
        ctx.strokeRect(sx + 6, horizonY - 26, st.bw - 12, 16);
        ctx.fillStyle = st.neon;
        ctx.globalAlpha = pulse;
        ctx.font = `900 9px ${this.fontRusso}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(st.sign, sx + st.bw * 0.5, horizonY - 17.5);
        ctx.restore();
      }

      // Iconic Fox Oakland Theater & Marquee Tower
      const fx = base + 318;
      ctx.fillStyle = "#7C2D12";
      ctx.strokeStyle = "#09090B";
      ctx.lineWidth = 2.5;
      ctx.fillRect(fx, horizonY - 82, 118, 82);
      ctx.strokeRect(fx, horizonY - 82, 118, 82);

      // Vertical red FOX blade tower
      ctx.fillStyle = "#DC2626";
      ctx.fillRect(fx + 44, horizonY - 126, 30, 56);
      ctx.strokeRect(fx + 44, horizonY - 126, 30, 56);

      // Flashing marquee bulb dots along tower edges
      for (let my = horizonY - 121; my <= horizonY - 76; my += 9) {
        const lit = Math.floor(elapsedSec * 8 + my) % 2 === 0;
        ctx.fillStyle = lit ? "#FFD700" : "#FEF08A";
        ctx.fillRect(fx + 46, my, 2.5, 2.5);
        ctx.fillRect(fx + 69.5, my, 2.5, 2.5);
      }

      // Marquee canopy
      ctx.fillStyle = "#FFD700";
      ctx.fillRect(fx + 10, horizonY - 40, 98, 18);
      ctx.strokeRect(fx + 10, horizonY - 40, 98, 18);
      ctx.fillStyle = "#09090B";
      ctx.font = `900 9px ${this.fontRusso}`;
      ctx.textAlign = "center";
      ctx.fillText("OAKLAND", fx + 59, horizonY - 27.5);

      ctx.fillStyle = "#FFD700";
      ctx.font = `900 13px ${this.fontBangers}`;
      ctx.fillText("FOX", fx + 59, horizonY - 94);
    }

    this.drawPalmTrees(ctx, w, horizonY, distanceM);
  }

  private drawBayBridgeSkyline(
    ctx: CanvasRenderingContext2D,
    w: number,
    horizonY: number,
    _palette: BlendedSkyPalette,
    distanceM: number,
    elapsedSec: number,
  ): void {
    // Deep SF Bay water strip at horizon
    const bayH = 22;
    const deckY = horizonY - bayH;
    ctx.fillStyle = "#0C1E3E";
    ctx.fillRect(-50, deckY, w + 100, bayH + 4);

    // Repeating suspension span (2 towers per 520px tile)
    const tile = 520;
    const bridgeScroll = (distanceM * 4.2) % tile;
    const towerTopY = horizonY - 126;

    for (let base = -bridgeScroll - tile; base < w + tile * 2; base += tile) {
      const t1 = base + 140;
      const t2 = base + 380;

      // Sweeping main suspension cables
      ctx.strokeStyle = "#94A3B8";
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(base, deckY - 6);
      ctx.quadraticCurveTo(base + 70, deckY - 22, t1, towerTopY + 8);
      ctx.quadraticCurveTo((t1 + t2) * 0.5, deckY - 18, t2, towerTopY + 8);
      ctx.quadraticCurveTo(base + 450, deckY - 22, base + tile, deckY - 6);
      ctx.stroke();

      // Vertical suspender cables
      ctx.strokeStyle = "rgba(148, 163, 184, 0.55)";
      ctx.lineWidth = 1.2;
      for (let sx = base + 24; sx < base + tile; sx += 22) {
        let cableY = deckY - 12;
        if (sx < t1) {
          const u = (sx - base) / (t1 - base);
          cableY =
            (1 - u) * (1 - u) * (deckY - 6) +
            2 * (1 - u) * u * (deckY - 22) +
            u * u * (towerTopY + 8);
        } else if (sx <= t2) {
          const u = (sx - t1) / (t2 - t1);
          cableY =
            (1 - u) * (1 - u) * (towerTopY + 8) +
            2 * (1 - u) * u * (deckY - 18) +
            u * u * (towerTopY + 8);
        } else {
          const u = (sx - t2) / (base + tile - t2);
          cableY =
            (1 - u) * (1 - u) * (towerTopY + 8) +
            2 * (1 - u) * u * (deckY - 22) +
            u * u * (deckY - 6);
        }
        ctx.beginPath();
        ctx.moveTo(sx, cableY);
        ctx.lineTo(sx, deckY);
        ctx.stroke();

        // Illuminated cable LED bead along the Bay Bridge lights!
        const shimmer = 0.65 + 0.35 * Math.sin(elapsedSec * 4 + sx * 0.05);
        ctx.fillStyle = `rgba(224, 242, 254, ${shimmer})`;
        ctx.fillRect(sx - 1, cableY - 1, 2, 2);
      }

      // Bridge towers (twin steel legs + cross braces + peak red beacons)
      for (const tx of [t1, t2]) {
        ctx.fillStyle = "#475569";
        ctx.strokeStyle = "#09090B";
        ctx.lineWidth = 2;
        ctx.fillRect(tx - 8, towerTopY, 6, horizonY - towerTopY);
        ctx.strokeRect(tx - 8, towerTopY, 6, horizonY - towerTopY);
        ctx.fillRect(tx + 2, towerTopY, 6, horizonY - towerTopY);
        ctx.strokeRect(tx + 2, towerTopY, 6, horizonY - towerTopY);

        // Cross-beams
        ctx.fillStyle = "#64748B";
        for (const by of [towerTopY + 12, towerTopY + 38, towerTopY + 66]) {
          ctx.fillRect(tx - 10, by, 20, 5);
          ctx.strokeRect(tx - 10, by, 20, 5);
        }

        // Red aviation beacon
        const pulse = 0.55 + 0.45 * Math.sin(elapsedSec * 4 + tx);
        ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
        ctx.beginPath();
        ctx.arc(tx, towerTopY - 3, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Bridge road deck + glowing span lights
    ctx.fillStyle = "#1E293B";
    ctx.fillRect(-50, deckY - 3, w + 100, 6);
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-50, deckY - 3, w + 100, 6);

    const lampStep = 44;
    const lampOffset = (distanceM * 5.2) % lampStep;
    for (let lx = -lampOffset; lx < w + lampStep; lx += lampStep) {
      ctx.fillStyle = "rgba(254, 240, 138, 0.35)";
      ctx.beginPath();
      ctx.arc(lx, deckY - 6, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FEF08A";
      ctx.fillRect(lx - 1.5, deckY - 7, 3, 3);
      // Water reflection
      ctx.fillStyle = "rgba(147, 197, 253, 0.25)";
      ctx.fillRect(lx - 2, deckY + 6, 4, 8);
    }
  }

  private drawWestOaklandSkyline(
    ctx: CanvasRenderingContext2D,
    w: number,
    horizonY: number,
    palette: BlendedSkyPalette,
    distanceM: number,
  ): void {
    const tile = 640;
    const midScroll = (distanceM * 5.2) % tile;

    for (let base = -midScroll; base < w + tile; base += tile) {
      // Industrial West Oakland warehouse blocks
      ctx.fillStyle = palette.midBuilding;
      ctx.strokeStyle = "#09090B";
      ctx.lineWidth = 2;
      ctx.fillRect(base + 290, horizonY - 48, 86, 48);
      ctx.strokeRect(base + 290, horizonY - 48, 86, 48);

      // Port of Oakland iconic orange gantry cranes
      for (const cx of [base + 95, base + 215, base + 465]) {
        const craneTop = horizonY - 102;
        const boomY = horizonY - 72;

        // Main steel frame legs
        ctx.strokeStyle = "#09090B";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(cx - 16, horizonY);
        ctx.lineTo(cx - 8, craneTop);
        ctx.lineTo(cx + 10, craneTop);
        ctx.lineTo(cx + 18, horizonY);
        ctx.stroke();

        ctx.strokeStyle = "#EA580C";
        ctx.lineWidth = 2.8;
        ctx.stroke();

        // Cross-brace & top A-frame stays
        ctx.strokeStyle = "#09090B";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - 42, boomY);
        ctx.lineTo(cx + 68, boomY);
        ctx.moveTo(cx + 1, craneTop);
        ctx.lineTo(cx + 62, boomY);
        ctx.moveTo(cx + 1, craneTop);
        ctx.lineTo(cx - 38, boomY);
        ctx.stroke();

        ctx.strokeStyle = "#F97316";
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Boom beam + operator cab
        ctx.fillStyle = "#EA580C";
        ctx.strokeStyle = "#09090B";
        ctx.lineWidth = 2;
        ctx.fillRect(cx - 44, boomY - 4, 114, 7);
        ctx.strokeRect(cx - 44, boomY - 4, 114, 7);
        ctx.fillStyle = "#FACC15";
        ctx.fillRect(cx + 18, boomY + 3, 12, 8);
        ctx.strokeRect(cx + 18, boomY + 3, 12, 8);
      }

      // Colorful stacked shipping containers along dockyard
      const stacks = [
        { x: 16, colors: ["#DC2626", "#2563EB", "#CA8A04"] },
        { x: 142, colors: ["#0D9488", "#EA580C"] },
        { x: 388, colors: ["#2563EB", "#DC2626", "#0D9488"] },
        { x: 540, colors: ["#CA8A04", "#475569", "#DC2626"] },
      ];
      for (const st of stacks) {
        st.colors.forEach((col, row) => {
          const cy = horizonY - (row + 1) * 12;
          const cw = 46;
          ctx.fillStyle = col;
          ctx.strokeStyle = "#09090B";
          ctx.lineWidth = 1.8;
          ctx.fillRect(base + st.x, cy, cw, 12);
          ctx.strokeRect(base + st.x, cy, cw, 12);
          // Corrugation ribs
          ctx.strokeStyle = "rgba(9, 9, 11, 0.35)";
          ctx.lineWidth = 1;
          for (let rx = base + st.x + 8; rx < base + st.x + cw - 4; rx += 8) {
            ctx.beginPath();
            ctx.moveTo(rx, cy + 2);
            ctx.lineTo(rx, cy + 10);
            ctx.stroke();
          }
        });
      }
    }

    this.drawPalmTrees(ctx, w, horizonY, distanceM);
  }

  private drawPalmTrees(
    ctx: CanvasRenderingContext2D,
    w: number,
    horizonY: number,
    distanceM: number,
  ): void {
    const palmTile = 340;
    const nearScroll = (distanceM * 10.5) % palmTile;
    for (let px = -nearScroll; px < w + palmTile; px += palmTile) {
      ctx.strokeStyle = "#09090B";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(px + 40, horizonY);
      ctx.quadraticCurveTo(px + 46, horizonY - 40, px + 54, horizonY - 78);
      ctx.stroke();
      ctx.strokeStyle = "#92400E";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = "#15803D";
      ctx.lineWidth = 3;
      for (let f = 0; f < 5; f++) {
        const angle = -Math.PI + (f / 4) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(px + 54, horizonY - 78);
        ctx.quadraticCurveTo(
          px + 54 + Math.cos(angle) * 18,
          horizonY - 88,
          px + 54 + Math.cos(angle) * 28,
          horizonY - 70 + Math.abs(Math.cos(angle)) * 6,
        );
        ctx.stroke();
      }
    }
  }

  private drawRoad(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    horizonY: number,
    curbH: number,
    laneTop: number,
    laneH: number,
    state: RunnerState,
    pxPerMeter: number,
  ): void {
    // Sidewalk / Curb (overscanned slightly for subtle grade tilt)
    ctx.fillStyle = "#A1A1AA";
    ctx.fillRect(-50, horizonY, w + 100, curbH);
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-50, horizonY);
    ctx.lineTo(w + 50, horizonY);
    ctx.moveTo(-50, horizonY + curbH);
    ctx.lineTo(w + 50, horizonY + curbH);
    ctx.stroke();

    // Asphalt
    ctx.fillStyle = "#1F2026";
    ctx.fillRect(-50, horizonY + curbH, w + 100, h - horizonY - curbH + 50);

    // Subtle highlight on active target lane so lane position is unmistakably clear
    ctx.fillStyle = "rgba(255, 215, 0, 0.055)";
    ctx.fillRect(-50, laneTop + state.targetLane * laneH, w + 100, laneH);

    // Dashed lane dividers between Lane 0/1 and Lane 1/2
    const dashStep = 110;
    const offset = (state.distanceM * pxPerMeter) % dashStep;
    ctx.fillStyle = "#FFD700";
    for (const dividerIdx of [1, 2]) {
      const y = laneTop + dividerIdx * laneH - 2;
      for (let x = -offset - dashStep; x < w + dashStep; x += dashStep) {
        ctx.fillRect(x, y, 52, 4);
      }
    }

    // Subtle grade chevrons painted along the curb when grade >= 2.5%
    if (Math.abs(state.gradePct) >= 2.5) {
      const uphill = state.gradePct > 0;
      const step = 130;
      const gOff = (state.distanceM * pxPerMeter) % step;
      ctx.save();
      ctx.strokeStyle = uphill ? "rgba(249, 115, 22, 0.7)" : "rgba(56, 189, 248, 0.7)";
      ctx.lineWidth = 2;
      for (let x = -gOff; x < w + step; x += step) {
        const cy = horizonY + curbH * 0.5;
        ctx.beginPath();
        if (uphill) {
          ctx.moveTo(x - 5, cy + 3);
          ctx.lineTo(x, cy - 3);
          ctx.lineTo(x + 5, cy + 3);
        } else {
          ctx.moveTo(x - 5, cy - 3);
          ctx.lineTo(x, cy + 3);
          ctx.lineTo(x + 5, cy - 3);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // Bottom solid street border
    ctx.fillStyle = "#09090B";
    ctx.fillRect(-50, h - 8, w + 100, 58);
  }

  private drawEntity(
    ctx: CanvasRenderingContext2D,
    ent: RunnerEntity,
    x: number,
    y: number,
    laneTop: number,
    laneH: number,
    elapsedSec: number,
    isNight: boolean,
  ): void {
    if (ent.kind === "shop") {
      this.drawShopArch(ctx, ent.subKind as RunnerShopKind, x, laneTop, laneH * 3, elapsedSec);
      return;
    }

    const scale = laneDepthScale(ent.lanePos);

    if (ent.kind === "collectible") {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      this.drawCollectible(ctx, ent.subKind as RunnerCollectibleKind, 0, 0, elapsedSec);
      ctx.restore();
      return;
    }

    // Wheelie-able ground hazard telegraph chevron slightly ahead on asphalt
    if (ent.groundHazard && !ent.hit && !ent.wheelieCleared) {
      this.drawWheelieChevron(ctx, x - 38 * scale, y + 8, scale, elapsedSec);
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    switch (ent.subKind) {
      case "car":
        this.drawCar(
          ctx,
          0,
          0,
          ent.carVariant ?? "sedan",
          ent.carColor ?? "#EF4444",
          isNight,
          ent.blinkerDir,
          elapsedSec,
        );
        break;
      case "bus":
        this.drawBus(ctx, 0, 0, isNight);
        break;
      case "pothole":
        ctx.save();
        ctx.translate(0, 8);
        ctx.fillStyle = "#09090B";
        ctx.strokeStyle = "#52525B";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 26, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = "#FACC15";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 17, 5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        break;
      case "oil-slick":
        ctx.save();
        ctx.translate(0, 8);
        const grad = ctx.createLinearGradient(-26, -6, 26, 6);
        grad.addColorStop(0, "#1E1B4B");
        grad.addColorStop(0.35, "#7C3AED");
        grad.addColorStop(0.65, "#06B6D4");
        grad.addColorStop(1, "#18181B");
        ctx.fillStyle = grad;
        ctx.strokeStyle = "#09090B";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 28, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        break;
      case "traffic-cone":
        ctx.save();
        ctx.translate(0, 6);
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(0, 4, 15, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#F97316";
        ctx.strokeStyle = "#09090B";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-12, 4);
        ctx.lineTo(-3, -24);
        ctx.lineTo(3, -24);
        ctx.lineTo(12, 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Reflective white stripe
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(-6, -13, 12, 5);
        ctx.restore();
        break;
      case "dog":
        this.drawDog(ctx, ent, elapsedSec);
        break;
    }

    ctx.restore();
  }

  private drawWheelieChevron(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
    elapsedSec: number,
  ): void {
    const pulse = 0.65 + 0.35 * Math.sin(elapsedSec * 10);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = pulse;

    // Crisp upward chevron triangle
    ctx.fillStyle = "#FFD700";
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(-8, 1);
    ctx.lineTo(8, 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Micro label
    ctx.font = `900 7.5px ${this.fontRusso}`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#09090B";
    ctx.fillText("WHEELIE", 1, 10.5);
    ctx.fillStyle = "#FFD700";
    ctx.fillText("WHEELIE", 0, 9.5);

    ctx.restore();
  }

  private drawDog(
    ctx: CanvasRenderingContext2D,
    ent: RunnerEntity,
    elapsedSec: number,
  ): void {
    const lat = ent.lateralSpeed ?? 0;
    const moving = Math.abs(lat) > 0.05;
    const stride = moving ? Math.sin(elapsedSec * 24) * 4.5 : 0;
    const hop = Math.abs(Math.sin(elapsedSec * 14)) * 3.5;

    ctx.save();
    ctx.translate(0, 4);

    // Shadow stays grounded
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(0, 6, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Flip horizontally when crossing upward so its crossing direction reads cleanly
    const faceDir = lat < -0.05 ? -1 : 1;
    const tilt = moving ? (lat > 0 ? 0.12 : -0.12) : 0;

    ctx.save();
    ctx.translate(0, -hop);
    ctx.rotate(tilt);
    ctx.scale(faceDir, 1);

    ctx.fillStyle = "#D97706";
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 2.5;

    // Trotting legs (back pair behind body, front pair in front)
    ctx.fillRect(-12 + stride * 0.7, -2, 4, 7.5);
    ctx.strokeRect(-12 + stride * 0.7, -2, 4, 7.5);
    ctx.fillRect(4 - stride * 0.7, -2, 4, 7.5);
    ctx.strokeRect(4 - stride * 0.7, -2, 4, 7.5);

    // Body
    ctx.fillRect(-14, -14, 24, 13);
    ctx.strokeRect(-14, -14, 24, 13);

    // Second trotting leg pair
    ctx.fillRect(-8 - stride * 0.7, -2, 4, 7.5);
    ctx.strokeRect(-8 - stride * 0.7, -2, 4, 7.5);
    ctx.fillRect(0 + stride * 0.7, -2, 4, 7.5);
    ctx.strokeRect(0 + stride * 0.7, -2, 4, 7.5);

    // Head
    ctx.fillRect(6, -22, 12, 11);
    ctx.strokeRect(6, -22, 12, 11);

    // Snout & nose
    ctx.fillStyle = "#09090B";
    ctx.fillRect(16, -18, 3, 3);

    // Floppy ears & wagging tail
    ctx.fillStyle = "#78350F";
    ctx.fillRect(9, -24, 4, 6);
    const tailWag = Math.sin(elapsedSec * 28) * 2.5;
    ctx.fillRect(-19, -16 + tailWag, 6, 4);

    ctx.restore();

    // Exclamation / bark comic callout when crossing/barked
    if (ent.barked || moving) {
      const pop = 0.85 + 0.15 * Math.sin(elapsedSec * 16);
      ctx.save();
      ctx.translate(0, -32 - hop);
      ctx.scale(pop, pop);
      ctx.fillStyle = "#FEF08A";
      ctx.strokeStyle = "#09090B";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-13, -11, 26, 14, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#DC2626";
      ctx.font = `900 9px ${this.fontBangers}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ent.barked ? "ARF!" : "!", 0, -4);
      ctx.restore();
    }

    ctx.restore();
  }

  private drawCar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    variant: "sedan" | "hatchback" | "van",
    color: string,
    isNight: boolean,
    blinkerDir?: -1 | 0 | 1,
    elapsedSec = 0,
  ): void {
    const bodyW = variant === "van" ? 96 : variant === "sedan" ? 84 : 74;
    const bodyH = variant === "van" ? 28 : 22;
    ctx.save();
    ctx.translate(x, y + 6);

    // Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.beginPath();
    ctx.ellipse(0, 4, bodyW * 0.52, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Night headlight cone projecting forward (right)
    if (isNight) {
      const cone = ctx.createLinearGradient(bodyW / 2, -bodyH + 4, bodyW / 2 + 125, -4);
      cone.addColorStop(0, "rgba(254, 240, 138, 0.36)");
      cone.addColorStop(1, "rgba(254, 240, 138, 0)");
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(bodyW / 2, -bodyH + 2);
      ctx.lineTo(bodyW / 2 + 125, -bodyH - 20);
      ctx.lineTo(bodyW / 2 + 125, 12);
      ctx.lineTo(bodyW / 2, -bodyH + 10);
      ctx.closePath();
      ctx.fill();
    }

    // Lower body
    ctx.fillStyle = color;
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 3;
    ctx.fillRect(-bodyW / 2, -bodyH - 4, bodyW, bodyH);
    ctx.strokeRect(-bodyW / 2, -bodyH - 4, bodyW, bodyH);

    // Cabin
    const cabW = variant === "van" ? bodyW * 0.78 : bodyW * 0.56;
    const cabH = variant === "van" ? 16 : 14;
    ctx.fillStyle = "#18181B";
    ctx.fillRect(-cabW / 2 - 4, -bodyH - cabH - 3, cabW, cabH);
    ctx.strokeRect(-cabW / 2 - 4, -bodyH - cabH - 3, cabW, cabH);
    // Windows
    ctx.fillStyle = isNight ? "#1E3A8A" : "#93C5FD";
    ctx.fillRect(-cabW / 2, -bodyH - cabH, cabW - 8, cabH - 4);

    // Glowing red brake/taillights (rear left)
    ctx.fillStyle = "rgba(239, 68, 68, 0.4)";
    ctx.beginPath();
    ctx.arc(-bodyW / 2 - 2, -bodyH + 4, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#EF4444";
    ctx.fillRect(-bodyW / 2, -bodyH, 6, 8);

    // Headlights (front right)
    ctx.fillStyle = "#FEF08A";
    ctx.fillRect(bodyW / 2 - 5, -bodyH, 5, 8);

    // Blinking bright amber turn signals when changing lanes
    if (blinkerDir === -1 || blinkerDir === 1) {
      const blinkOn = Math.floor(elapsedSec * 6.5) % 2 === 0;
      const sigY = blinkerDir === -1 ? -bodyH - 4 : -10;
      if (blinkOn) {
        ctx.fillStyle = "rgba(245, 158, 11, 0.55)";
        ctx.beginPath();
        ctx.arc(-bodyW / 2 + 2, sigY + 3, 9, 0, Math.PI * 2);
        ctx.arc(bodyW / 2 - 2, sigY + 3, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#FBBF24";
        ctx.strokeStyle = "#09090B";
        ctx.lineWidth = 1.5;
        ctx.fillRect(-bodyW / 2 - 1, sigY, 7, 6);
        ctx.strokeRect(-bodyW / 2 - 1, sigY, 7, 6);
        ctx.fillRect(bodyW / 2 - 6, sigY, 7, 6);
        ctx.strokeRect(bodyW / 2 - 6, sigY, 7, 6);

        // Telegraph directional arrow on the side the car is about to move toward
        const arrowY = blinkerDir === -1 ? -bodyH - cabH - 12 : 12;
        ctx.fillStyle = "#F59E0B";
        ctx.strokeStyle = "#09090B";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        if (blinkerDir === -1) {
          ctx.moveTo(0, arrowY - 7);
          ctx.lineTo(-7, arrowY + 2);
          ctx.lineTo(7, arrowY + 2);
        } else {
          ctx.moveTo(0, arrowY + 7);
          ctx.lineTo(-7, arrowY - 2);
          ctx.lineTo(7, arrowY - 2);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // Wheels
    for (const wx of [-bodyW * 0.3, bodyW * 0.3]) {
      ctx.fillStyle = "#09090B";
      ctx.beginPath();
      ctx.arc(wx, -2, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#D4D4D8";
      ctx.beginPath();
      ctx.arc(wx, -2, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawBus(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    isNight: boolean,
  ): void {
    const bodyW = 162;
    const bodyH = 44;
    ctx.save();
    ctx.translate(x, y + 6);

    // Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.ellipse(0, 5, bodyW * 0.52, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Night headlight cone
    if (isNight) {
      const cone = ctx.createLinearGradient(bodyW / 2, -16, bodyW / 2 + 150, -4);
      cone.addColorStop(0, "rgba(254, 240, 138, 0.4)");
      cone.addColorStop(1, "rgba(254, 240, 138, 0)");
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(bodyW / 2, -22);
      ctx.lineTo(bodyW / 2 + 150, -44);
      ctx.lineTo(bodyW / 2 + 150, 14);
      ctx.lineTo(bodyW / 2, -10);
      ctx.closePath();
      ctx.fill();
    }

    // Main white AC Transit bus body
    ctx.fillStyle = "#F8FAFC";
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-bodyW / 2, -bodyH - 4, bodyW, bodyH, [5, 8, 2, 2]);
    ctx.fill();
    ctx.stroke();

    // Bold East Bay green livery stripes
    ctx.fillStyle = "#15803D";
    ctx.fillRect(-bodyW / 2 + 2, -19, bodyW - 4, 10);
    ctx.fillStyle = "#22C55E";
    ctx.fillRect(-bodyW / 2 + 2, -23, bodyW - 4, 4);

    // Dark tinted passenger windows
    ctx.fillStyle = "#0F172A";
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const wx = -bodyW / 2 + 8 + i * 24;
      ctx.fillRect(wx, -bodyH + 5, 20, 14);
      ctx.strokeRect(wx, -bodyH + 5, 20, 14);
      // Subtle tint highlight
      ctx.fillStyle = "rgba(56, 189, 248, 0.16)";
      ctx.fillRect(wx + 2, -bodyH + 7, 6, 10);
      ctx.fillStyle = "#0F172A";
    }

    // Tall front driver windshield (right side)
    ctx.fillStyle = "#0F172A";
    ctx.fillRect(bodyW / 2 - 26, -bodyH + 4, 22, 20);
    ctx.strokeRect(bodyW / 2 - 26, -bodyH + 4, 22, 20);

    // "51A OAKLAND" LED amber headsign bezel
    ctx.fillStyle = "#09090B";
    ctx.fillRect(-bodyW / 2 + 10, -bodyH - 3, 74, 10);
    ctx.fillStyle = "#FBBF24";
    ctx.font = `900 7.5px ${this.fontRusso}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("51A OAKLAND", -bodyW / 2 + 47, -bodyH + 2.5);

    // Rear red brake lights + glow
    ctx.fillStyle = "rgba(239, 68, 68, 0.45)";
    ctx.beginPath();
    ctx.arc(-bodyW / 2 - 2, -18, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#EF4444";
    ctx.fillRect(-bodyW / 2, -26, 6, 14);
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-bodyW / 2, -26, 6, 14);

    // Front headlights
    ctx.fillStyle = "#FEF08A";
    ctx.fillRect(bodyW / 2 - 5, -20, 5, 10);

    // Dual rear wheels + front wheel
    for (const wx of [-bodyW * 0.36, -bodyW * 0.24, bodyW * 0.34]) {
      ctx.fillStyle = "#09090B";
      ctx.beginPath();
      ctx.arc(wx, -2, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#D4D4D8";
      ctx.beginPath();
      ctx.arc(wx, -2, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawClosingTrafficWarnings(
    ctx: CanvasRenderingContext2D,
    state: RunnerState,
    metrics: RoadMetrics,
  ): void {
    const { laneY, playerScreenX, pxPerMeter } = metrics;
    const w = this.width;
    let warnLane: number | null = null;
    let urgent = false;

    for (const ent of state.entities) {
      if (ent.hit || (ent.subKind !== "car" && ent.subKind !== "bus")) continue;
      const incomingLane =
        ent.laneChangeTargetLane ??
        (ent.blinkerDir ? clamp(ent.lane + ent.blinkerDir, 0, 2) : ent.lane);
      const threatensTarget =
        Math.abs(ent.lanePos - state.targetLane) < 0.65 || incomingLane === state.targetLane;
      if (!threatensTarget) continue;

      const relX = ent.xM - state.distanceM;
      const rearDistM = relX - ent.lengthM * 0.5;
      if (rearDistM <= 0) continue;

      const closingMps = Math.max(3, state.speedMps - ent.speedMps);
      const ttc = rearDistM / closingMps;
      const rearScreenX = playerScreenX + rearDistM * pxPerMeter;

      if ((ttc >= 0.7 && ttc <= 1.85) || (rearScreenX >= w - 28 && ttc <= 2.2)) {
        warnLane = state.targetLane;
        urgent = ttc <= 1.15;
        break;
      }
    }

    if (warnLane === null) return;

    const wy = laneY(warnLane);
    const pulse = 0.55 + 0.45 * Math.sin(state.elapsedSec * (urgent ? 18 : 11));
    ctx.save();
    ctx.translate(w - 22, wy);
    ctx.globalAlpha = pulse;

    // Red warning badge with left-pointing arrow
    ctx.fillStyle = "#EF4444";
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(-2, -13);
    ctx.lineTo(14, -13);
    ctx.lineTo(14, 13);
    ctx.lineTo(-2, 13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = `900 13px ${this.fontBangers}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("!", 4, 1);

    ctx.restore();
  }

  private drawCollectible(
    ctx: CanvasRenderingContext2D,
    kind: RunnerCollectibleKind,
    x: number,
    y: number,
    elapsedSec: number,
  ): void {
    const bob = Math.sin(elapsedSec * 6 + x * 0.05) * 4;
    const color =
      kind === "cylinder"
        ? "#F97316"
        : kind === "pipe"
          ? "#22D3EE"
          : kind === "jet"
            ? "#FFD700"
            : "#4ADE80";
    const label =
      kind === "cylinder" ? "70CC" : kind === "pipe" ? "PIPE" : kind === "jet" ? "JET" : "PLUG";

    ctx.save();
    ctx.translate(x, y - 10 + bob);

    // Glow
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Neo-brutalist badge coin
    ctx.fillStyle = "#09090B";
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = `900 8px ${this.fontRusso}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 0, 0.5);

    ctx.restore();
  }

  private drawShopArch(
    ctx: CanvasRenderingContext2D,
    shop: RunnerShopKind,
    x: number,
    laneTop: number,
    totalRoadH: number,
    elapsedSec: number,
  ): void {
    const config: Record<RunnerShopKind, { title: string; sub: string; color: string }> = {
      treatland: { title: "TREATLAND", sub: "TURBO BOOST", color: "#FFD700" },
      "1977-mopeds": { title: "1977 MOPEDS", sub: "+1 HP & COOL", color: "#4ADE80" },
      "myrons-mopeds": { title: "MYRON'S", sub: "PART MAGNET", color: "#22D3EE" },
    };
    const c = config[shop];
    const pulse = 0.85 + Math.sin(elapsedSec * 8) * 0.15;

    ctx.save();
    // Glowing road strip
    ctx.fillStyle = c.color;
    ctx.globalAlpha = 0.16 * pulse;
    ctx.fillRect(x - 18, laneTop, 36, totalRoadH);
    ctx.globalAlpha = 1;

    // Arch posts
    ctx.fillStyle = "#18181B";
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 3;
    ctx.fillRect(x - 6, laneTop - 68, 12, 74);
    ctx.strokeRect(x - 6, laneTop - 68, 12, 74);

    // Overhead neon sign
    ctx.fillStyle = "#09090B";
    ctx.strokeStyle = c.color;
    ctx.lineWidth = 3;
    ctx.fillRect(x - 66, laneTop - 102, 132, 38);
    ctx.strokeRect(x - 66, laneTop - 102, 132, 38);

    ctx.fillStyle = c.color;
    ctx.font = `900 14px ${this.fontBangers}`;
    ctx.textAlign = "center";
    ctx.fillText(c.title, x, laneTop - 83);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `800 8.5px ${this.fontRusso}`;
    ctx.fillText(c.sub, x, laneTop - 70);
    ctx.restore();
  }

  private drawMopedAndRider(
    ctx: CanvasRenderingContext2D,
    state: RunnerState,
    x: number,
    y: number,
    isNight: boolean,
  ): void {
    // Blink during post-hit invincibility (never hide during death beat!)
    if (!state.dying && state.invincibleSec > 0 && Math.floor(state.elapsedSec * 18) % 2 === 0) {
      return;
    }

    const eng = state.engine;
    const p = state.profile;
    const depthScale = laneDepthScale(state.lanePos);
    const wheelieLift = state.wheelieHeightFrac * 18;
    const wheeliePitch = -state.wheelieHeightFrac * 0.48; // nose up!
    const vib = eng.running && !state.dying ? Math.sin(state.elapsedSec * 65) * 0.9 : 0;

    const isCrashed = state.dying && state.deathReason === "crashed";
    const isSeized = state.dying && state.deathReason === "seized";
    const isStalled = state.dying && state.deathReason === "stalled";

    const slideT = isCrashed ? clamp(state.deathElapsedSec / 0.45, 0, 1) : 0;
    const tumbleT = isCrashed ? clamp(state.deathElapsedSec / 0.65, 0, 1) : 0;
    const skidT = isSeized ? clamp(state.deathElapsedSec / 0.5, 0, 1) : 0;

    ctx.save();
    ctx.translate(x, y + 8);
    ctx.scale(depthScale, depthScale);

    // Thick black rubber skid mark behind rear tire on seize!
    if (isSeized) {
      const skidLen = 28 + skidT * 175;
      ctx.save();
      ctx.strokeStyle = "#09090B";
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-24, 1);
      ctx.quadraticCurveTo(-24 - skidLen * 0.45, -3, -24 - skidLen, 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(39, 39, 42, 0.7)";
      ctx.lineWidth = 10;
      ctx.stroke();
      ctx.restore();
    }

    // Asphalt scrape streak behind sliding bike on wipeout
    if (isCrashed && slideT > 0.05) {
      const scrapeLen = 20 + slideT * 135;
      ctx.strokeStyle = "rgba(82, 82, 91, 0.7)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-18, 2);
      ctx.lineTo(-18 - scrapeLen, 2);
      ctx.stroke();
    }

    // Ground shadow stays on asphalt
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.beginPath();
    ctx.ellipse(0, 4, 42 - state.wheelieHeightFrac * 8, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bike transform (wheelie pivot, or crashed side-slide, or seized shudder)
    ctx.save();
    if (isCrashed) {
      ctx.translate(0, 5 * slideT);
      ctx.rotate(slideT * 0.36);
      ctx.scale(1, 1 - 0.38 * slideT);
    } else if (isSeized) {
      const shudder = state.deathElapsedSec < 0.5 ? Math.sin(state.deathElapsedSec * 55) * 1.8 : 0;
      ctx.translate(0, shudder);
      ctx.rotate(-0.08 * skidT);
    } else if (isStalled) {
      const wobble =
        state.deathElapsedSec < 0.55 ? Math.sin(state.deathElapsedSec * 16) * 0.04 : 0;
      ctx.rotate(wobble);
    } else {
      ctx.translate(-22, -wheelieLift * 0.35);
      ctx.rotate(wheeliePitch + state.leanAngle * 0.08);
      ctx.translate(22, 0);
    }

    // Turbo aura
    if (state.turboSec > 0 && !state.dying) {
      ctx.fillStyle = "rgba(255, 215, 0, 0.22)";
      ctx.beginPath();
      ctx.ellipse(-6, -24, 52, 26, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Wheels
    this.drawWheel(ctx, -24, -12, 13, this.wheelAngle);
    this.drawWheel(ctx, 26, -12, 13, this.wheelAngle);

    // Frame by make (all 4 Stable-accurate silhouettes preserved)
    this.drawFrame(
      ctx,
      state.bike.make,
      state.bike.colorHex,
      state.bike.accentHex,
      isNight && !isCrashed,
    );

    // Cylinder (glows orange-red if overheating or seized!)
    ctx.save();
    ctx.translate(4, -22 + vib);
    const hot = eng.chtC > 185 || isSeized;
    ctx.fillStyle = hot ? "#EA580C" : p.cylinderVisual === "stock" ? "#71717A" : "#D4D4D8";
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 2;
    ctx.fillRect(-6, -6, p.cylinderVisual === "stock" ? 11 : 15, 11);
    ctx.strokeRect(-6, -6, p.cylinderVisual === "stock" ? 11 : 15, 11);
    ctx.restore();

    // Exhaust
    ctx.save();
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 2;
    if (p.exhaustVisual === "stock") {
      ctx.fillStyle = "#3F3F46";
      ctx.fillRect(-36, -14, 40, 5);
      ctx.strokeRect(-36, -14, 40, 5);
    } else {
      ctx.fillStyle = p.exhaustVisual === "race" ? "#27272A" : "#D4D4D8";
      ctx.beginPath();
      ctx.moveTo(6, -16);
      ctx.lineTo(-18, -9);
      ctx.lineTo(-34, -16);
      ctx.lineTo(-18, -18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = p.exhaustVisual === "race" ? "#FFD700" : "#52525B";
      ctx.fillRect(-44, -21, 12, 5);
      ctx.strokeRect(-44, -21, 12, 5);
    }
    ctx.restore();

    // Rider (stays on bike unless crashed -> tumbles forward in a comic arc outside bike roll!)
    if (!isCrashed) {
      this.drawRiderFigure(ctx, false);
    }

    // High-contrast heat shimmer when hot
    if (eng.chtC > 180 && !isCrashed) {
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const sx = 2 + i * 5;
        const phase = state.elapsedSec * 9 + i * 2;
        ctx.strokeStyle = "rgba(9, 9, 11, 0.7)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(sx, -32);
        ctx.quadraticCurveTo(sx + Math.sin(phase) * 4, -40, sx - Math.sin(phase) * 3, -49);
        ctx.stroke();
        ctx.strokeStyle = eng.chtC > 210 ? "#EF4444" : "#F97316";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore(); // end bike transform

    // Tumbling rider during crashed wipeout beat
    if (isCrashed) {
      const arcX = tumbleT * 74;
      const arcY = -Math.sin(tumbleT * Math.PI) * 44 + tumbleT * 10;
      const spin = tumbleT * Math.PI * 1.9;
      ctx.save();
      ctx.translate(arcX, arcY - 28);
      ctx.rotate(spin);
      ctx.translate(4, 34);
      this.drawRiderFigure(ctx, true);
      ctx.restore();
    }

    ctx.restore();
  }

  private drawRiderFigure(ctx: CanvasRenderingContext2D, tumbling: boolean): void {
    ctx.save();
    ctx.lineCap = "round";

    // Leg (black outline first, then slate fill)
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-14, -29);
    ctx.lineTo(tumbling ? -4 : -2, tumbling ? -16 : -20);
    ctx.lineTo(tumbling ? -10 : -6, tumbling ? -8 : -10);
    ctx.stroke();
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 4.5;
    ctx.stroke();

    // Torso
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(-14, -30);
    ctx.lineTo(-2, -48);
    ctx.stroke();
    ctx.strokeStyle = "#18181B";
    ctx.lineWidth = 7;
    ctx.stroke();

    // Arm to bars (flailing up when tumbling)
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-2, -46);
    ctx.lineTo(tumbling ? 12 : 14, tumbling ? -56 : -39);
    ctx.stroke();
    ctx.strokeStyle = "#27272A";
    ctx.lineWidth = 4;
    ctx.stroke();

    // V8: PCA Gold helmet (#FFD700) with crisp black racing stripe (matches ride-renderer.ts)
    ctx.fillStyle = "#FFD700";
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(1, -56, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Black racing stripe over helmet crown
    ctx.save();
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(1, -56, 6.4, Math.PI * 1.05, Math.PI * 1.9);
    ctx.stroke();
    ctx.restore();

    // Visor
    ctx.fillStyle = "#09090B";
    ctx.beginPath();
    ctx.roundRect(3, -59, 7, 4.5, 1.5);
    ctx.fill();
    ctx.restore();
  }

  private drawWheel(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, angle: number): void {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = "#18181B";
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#E4E4E7";
    ctx.beginPath();
    ctx.arc(0, 0, r - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.rotate(angle);
    ctx.strokeStyle = "#52525B";
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * (r - 5), Math.sin(a) * (r - 5));
      ctx.stroke();
    }
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawFrame(
    ctx: CanvasRenderingContext2D,
    make: SimBikeMake,
    colorHex: string,
    accentHex: string,
    isNight: boolean,
  ): void {
    ctx.save();
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 2.5;

    // Rear fender
    ctx.fillStyle = colorHex;
    ctx.beginPath();
    ctx.arc(-24, -12, 16, Math.PI * 1.08, Math.PI * 1.88);
    ctx.lineTo(-10, -14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Main frame geometry matching Pedal Code Army Stable reference photos
    ctx.fillStyle = colorHex;
    if (make === "puch-maxi") {
      // Stamped sheet-metal step-through monocoque + straight diagonal tank + chrome lower rail
      ctx.beginPath();
      ctx.moveTo(-26, -24);
      ctx.lineTo(-14, -31);
      ctx.lineTo(-6, -31);
      ctx.lineTo(-2, -22);
      ctx.lineTo(4, -22);
      ctx.lineTo(14, -37);
      ctx.lineTo(18, -32);
      ctx.lineTo(6, -16);
      ctx.lineTo(-12, -16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Chrome side trim & black PUCH tank stripe
      ctx.strokeStyle = "#F4F4F5";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-16, -28);
      ctx.lineTo(-8, -19);
      ctx.lineTo(5, -19);
      ctx.stroke();
      ctx.strokeStyle = "#18181B";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(7, -25);
      ctx.lineTo(14, -33);
      ctx.stroke();
    } else if (make === "honda-hobbit") {
      // Silver vented PA50 variator swingarm cover
      ctx.fillStyle = "#A1A1AA";
      ctx.beginPath();
      ctx.roundRect(-26, -18, 25, 8, 4);
      ctx.fill();
      ctx.stroke();

      // Deep open step-through U-frame
      ctx.fillStyle = colorHex;
      ctx.beginPath();
      ctx.moveTo(-27, -28);
      ctx.lineTo(-10, -30);
      ctx.lineTo(-4, -20);
      ctx.lineTo(6, -20);
      ctx.lineTo(14, -35);
      ctx.lineTo(17, -31);
      ctx.lineTo(8, -16);
      ctx.lineTo(-10, -16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Iconic WHITE/CREAM front downtube shield + footboard
      ctx.fillStyle = "#FAFAF9";
      ctx.beginPath();
      ctx.moveTo(-4, -20);
      ctx.lineTo(6, -20);
      ctx.lineTo(14, -34);
      ctx.lineTo(17, -31);
      ctx.lineTo(7, -17);
      ctx.lineTo(-4, -17);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (make === "derbi-variant") {
      // Authentic Derbi Variant SL: boxy trapezoidal under-seat body + low flat step-through spine
      ctx.beginPath();
      ctx.moveTo(-26, -31);
      ctx.lineTo(-6, -31);
      ctx.lineTo(-1, -21);
      ctx.lineTo(8, -21);
      ctx.lineTo(15, -37);
      ctx.lineTo(19, -34);
      ctx.lineTo(10, -16);
      ctx.lineTo(-16, -16);
      ctx.lineTo(-26, -24);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = accentHex;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-12, -18.5);
      ctx.lineTo(8, -18.5);
      ctx.lineTo(15, -33);
      ctx.stroke();
    } else {
      // Authentic Tomos A35: chunky diagonal box tank + horizontal side-body skirt
      ctx.beginPath();
      ctx.moveTo(-26, -22);
      ctx.lineTo(-11, -30);
      ctx.lineTo(-6, -30);
      ctx.lineTo(-1, -21);
      ctx.lineTo(5, -21);
      ctx.lineTo(14, -37);
      ctx.lineTo(18, -33);
      ctx.lineTo(7, -17);
      ctx.lineTo(-26, -17);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = accentHex;
      ctx.fillRect(-22, -20, 22, 2.5);
    }

    // Seat (long flat bench on Derbi SL, high-backed solo on Hobbit, chunky flat-top on Maxi/Tomos)
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 2.2;
    ctx.fillStyle = "#18181B";
    if (make === "derbi-variant") {
      ctx.fillRect(-26, -36, 22, 5.5);
      ctx.strokeRect(-26, -36, 22, 5.5);
    } else if (make === "honda-hobbit") {
      ctx.beginPath();
      ctx.moveTo(-20, -38);
      ctx.lineTo(-4, -34);
      ctx.lineTo(-5, -29.5);
      ctx.lineTo(-20, -29.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(-22, -36, 17, 6);
      ctx.strokeRect(-22, -36, 17, 6);
    }

    // Front Fork + Gaiters/Uppers + Front Fender
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(26, -12);
    ctx.lineTo(14, -40);
    ctx.stroke();
    ctx.strokeStyle =
      make === "derbi-variant" || make === "tomos-a35" ? "#18181B" : "#E4E4E7";
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Front fender (contrast black on Maxi, body color on others)
    ctx.strokeStyle = make === "puch-maxi" ? "#18181B" : colorHex;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(26, -12, 15, Math.PI * 1.15, Math.PI * 1.82);
    ctx.stroke();

    // Headlight (aero fairing on Tomos A35, painted square on Hobbit, round chrome on Derbi, round black on Maxi)
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 2;
    if (make === "tomos-a35") {
      ctx.fillStyle = colorHex;
      ctx.beginPath();
      ctx.moveTo(14, -44);
      ctx.quadraticCurveTo(22, -41, 24, -31);
      ctx.lineTo(16, -30);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (make === "honda-hobbit") {
      ctx.fillStyle = colorHex;
      ctx.fillRect(16, -40, 8, 7);
      ctx.strokeRect(16, -40, 8, 7);
    } else {
      ctx.fillStyle = isNight ? "#FEF08A" : make === "derbi-variant" ? "#E4E4E7" : "#18181B";
      ctx.beginPath();
      ctx.arc(20, -35, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    if (isNight) {
      ctx.fillStyle = "rgba(254, 240, 138, 0.14)";
      ctx.beginPath();
      ctx.moveTo(24, -34);
      ctx.lineTo(175, -62);
      ctx.lineTo(175, 4);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  private updateParticles(state: RunnerState, dt: number, px: number, py: number): void {
    const eng = state.engine;
    const scale = laneDepthScale(state.lanePos);

    // Dying particle bursts
    if (state.dying) {
      if (state.deathReason === "crashed" && state.deathElapsedSec <= 0.45) {
        this.deathSparkTimer += dt * 55;
        while (this.deathSparkTimer >= 1) {
          this.deathSparkTimer -= 1;
          const colors = ["#F97316", "#FFD700", "#FEF08A"];
          this.sparks.push({
            x: px + (Math.random() - 0.5) * 28,
            y: py + 9,
            vx: -110 - Math.random() * 140,
            vy: -35 - Math.random() * 85,
            life: 0.25 + Math.random() * 0.22,
            color: colors[Math.floor(Math.random() * colors.length)]!,
          });
        }
      } else if (state.deathReason === "seized") {
        this.deathSmokeTimer += dt * 26;
        while (this.deathSmokeTimer >= 1) {
          this.deathSmokeTimer -= 1;
          const tint: SmokeTint = Math.random() < 0.52 ? "white-steam" : "thick-blue-grey";
          this.smokePuffs.push({
            x: px + 4 * scale + (Math.random() - 0.5) * 8,
            y: py - 14 * scale,
            vx: -30 - state.speedMps * 4 + (Math.random() - 0.5) * 24,
            vy: -28 - Math.random() * 26,
            radius: 7 + Math.random() * 6,
            alpha: 0.8,
            age: 0,
            maxAge: 0.65 + Math.random() * 0.45,
            tint,
          });
        }
      } else if (state.deathReason === "stalled" && state.deathElapsedSec <= 0.55) {
        this.deathSmokeTimer += dt * 7;
        while (this.deathSmokeTimer >= 1) {
          this.deathSmokeTimer -= 1;
          this.smokePuffs.push({
            x: px - 36 * scale,
            y: py - 6 * scale,
            vx: -34 - Math.random() * 18,
            vy: -14 - Math.random() * 12,
            radius: 4 + Math.random() * 3,
            alpha: 0.42,
            age: 0,
            maxAge: 0.55,
            tint: "light-blue",
          });
        }
      }
    }

    // Normal 2-stroke exhaust smoke based on real smokeDensity & tint
    if (!state.dying && eng.running && eng.smokeDensity > 0.04) {
      this.smokeTimer += dt * (8 + eng.smokeDensity * 26);
      while (this.smokeTimer >= 1) {
        this.smokeTimer -= 1;
        this.smokePuffs.push({
          x: px - 38 * scale,
          y: py - (8 + state.wheelieHeightFrac * 8) * scale + (Math.random() - 0.5) * 4,
          vx: -80 - state.speedMps * 8 - Math.random() * 40,
          vy: -14 - Math.random() * 18,
          radius: (5 + eng.smokeDensity * 8) * scale,
          alpha: Math.min(0.85, 0.25 + eng.smokeDensity * 0.65),
          age: 0,
          maxAge: 0.45 + eng.smokeDensity * 0.55,
          tint: eng.smokeTint,
        });
      }
    }

    for (const puff of this.smokePuffs) {
      puff.age += dt;
      puff.x += puff.vx * dt;
      puff.y += puff.vy * dt;
      puff.radius += dt * 16;
    }
    this.smokePuffs = this.smokePuffs.filter((p) => p.age < p.maxAge);

    for (const sp of this.sparks) {
      sp.life -= dt;
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.vy += 320 * dt;
    }
    this.sparks = this.sparks.filter((sp) => sp.life > 0);
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.smokePuffs) {
      const frac = 1 - p.age / p.maxAge;
      const color =
        p.tint === "thick-blue-grey"
          ? "148, 163, 184"
          : p.tint === "white-steam"
            ? "241, 245, 249"
            : "186, 230, 253";
      ctx.fillStyle = `rgba(${color}, ${p.alpha * frac})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      if (p.tint === "thick-blue-grey" || p.tint === "white-steam") {
        ctx.strokeStyle = `rgba(9, 9, 11, ${0.32 * frac})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    for (const sp of this.sparks) {
      ctx.fillStyle = sp.color;
      ctx.fillRect(sp.x - 2, sp.y - 2, 4.5, 4.5);
    }
  }

  private drawSpeedLines(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    color: string,
    elapsedSec: number,
  ): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const y = 30 + ((i * 57) % (h - 60));
      const x = w - (((elapsedSec * 900 + i * 193) % (w + 200)) - 60);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 70, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawHeadwindStreaks(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    elapsedSec: number,
  ): void {
    ctx.save();
    ctx.strokeStyle = "#93C5FD";
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 10; i++) {
      const y = 24 + ((i * 47 + 19) % Math.max(60, h - 48));
      const x = w - (((elapsedSec * 680 + i * 151) % (w + 180)) - 40);
      ctx.globalAlpha = 0.22 + (i % 3) * 0.08;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 48 + (i % 3) * 18, y + Math.sin(elapsedSec * 6 + i) * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawDeathSplashBanner(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    reason: NonNullable<RunnerState["deathReason"]>,
    deathElapsedSec: number,
  ): void {
    const popRaw = clamp((deathElapsedSec - 0.35) / 0.16, 0, 1);
    // Elastic comic overshoot
    const scale = popRaw < 1 ? 0.4 + popRaw * 0.72 : 1 + Math.sin((deathElapsedSec - 0.51) * 14) * 0.025;

    const config: Record<
      NonNullable<RunnerState["deathReason"]>,
      { title: string; bg: string; fg: string }
    > = {
      crashed: { title: "WIPEOUT!", bg: "#EF4444", fg: "#FFD700" },
      seized: { title: "SEIZED!", bg: "#DC2626", fg: "#FFFFFF" },
      stalled: { title: "STALLED OUT!", bg: "#F59E0B", fg: "#09090B" },
      aborted: { title: "RUN ENDED", bg: "#52525B", fg: "#FFFFFF" },
    };
    const cfg = config[reason];

    const cx = w * 0.5;
    const cy = h * 0.42;
    const boxW = Math.min(w - 48, 340);
    const boxH = 74;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.045);
    ctx.scale(scale, scale);

    // Neo-brutalist offset black drop shadow
    ctx.fillStyle = "#09090B";
    ctx.fillRect(-boxW / 2 + 8, -boxH / 2 + 8, boxW, boxH);

    // Banner box
    ctx.fillStyle = cfg.bg;
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 4;
    ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);
    ctx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);

    // Comic halftone dot pattern inside banner edges
    ctx.fillStyle = "rgba(9, 9, 11, 0.22)";
    for (let dx = -boxW / 2 + 10; dx <= boxW / 2 - 10; dx += 12) {
      ctx.beginPath();
      ctx.arc(dx, -boxH / 2 + 8, 2.2, 0, Math.PI * 2);
      ctx.arc(dx + 5, boxH / 2 - 8, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Main Bangers comic lettering + crisp black shadow
    ctx.font = `900 44px ${this.fontBangers}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#09090B";
    ctx.strokeText(cfg.title, 2, 4);
    ctx.fillStyle = cfg.fg;
    ctx.fillText(cfg.title, 0, 2);

    ctx.restore();
  }
}
