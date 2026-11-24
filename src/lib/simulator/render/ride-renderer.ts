"use client";

import type {
  RideTelemetrySnapshot,
  SimBikeMake,
  SmokeTint,
} from "../contract";

interface SmokeParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  tint: SmokeTint;
  outlined: boolean;
}

interface SkyPalette {
  skyTop: string;
  skyBottom: string;
  sunColor: string;
  sunGlow: string;
  cloudFill: string;
  hillsFar: string;
  craneColor: string;
  bridgeColor: string;
  midBuilding: string;
  midWindow: string;
  lakeWater: string;
  nearBuildingA: string;
  nearBuildingB: string;
  nearBuildingC: string;
  roadTop: string;
  roadStripe: string;
  sidewalk: string;
  isNight: boolean;
}

const PALETTES: Record<RideTelemetrySnapshot["timeOfDay"], SkyPalette> = {
  morning: {
    skyTop: "#38BDF8",
    skyBottom: "#FEF08A",
    sunColor: "#FFD700",
    sunGlow: "rgba(255, 215, 0, 0.32)",
    cloudFill: "#FFFFFF",
    hillsFar: "#1E3A5F",
    craneColor: "#EA580C",
    bridgeColor: "#94A3B8",
    midBuilding: "#334155",
    midWindow: "#FDE047",
    lakeWater: "#0284C7",
    nearBuildingA: "#B45309",
    nearBuildingB: "#0F766E",
    nearBuildingC: "#7C2D12",
    roadTop: "#27272A",
    roadStripe: "#FFD700",
    sidewalk: "#D4D4D8",
    isNight: false,
  },
  golden: {
    skyTop: "#F59E0B",
    skyBottom: "#FDE047",
    sunColor: "#FFFBEB",
    sunGlow: "rgba(255, 215, 0, 0.45)",
    cloudFill: "#FEF3C7",
    hillsFar: "#451A03",
    craneColor: "#C2410C",
    bridgeColor: "#78350F",
    midBuilding: "#292524",
    midWindow: "#FACC15",
    lakeWater: "#D97706",
    nearBuildingA: "#9A3412",
    nearBuildingB: "#713F12",
    nearBuildingC: "#854D0E",
    roadTop: "#1C1917",
    roadStripe: "#FFD700",
    sidewalk: "#E7E5E4",
    isNight: false,
  },
  sunset: {
    skyTop: "#581C87",
    skyBottom: "#FB7185",
    sunColor: "#FDBA74",
    sunGlow: "rgba(251, 146, 60, 0.45)",
    cloudFill: "#FED7AA",
    hillsFar: "#1E1B4B",
    craneColor: "#F97316",
    bridgeColor: "#4C1D95",
    midBuilding: "#18181B",
    midWindow: "#FDE047",
    lakeWater: "#7C3AED",
    nearBuildingA: "#4338CA",
    nearBuildingB: "#9D174D",
    nearBuildingC: "#7C2D12",
    roadTop: "#18181B",
    roadStripe: "#FFD700",
    sidewalk: "#A1A1AA",
    isNight: false,
  },
  night: {
    skyTop: "#020617",
    skyBottom: "#1E1B4B",
    sunColor: "#F8FAFC",
    sunGlow: "rgba(226, 232, 240, 0.25)",
    cloudFill: "#334155",
    hillsFar: "#090D16",
    craneColor: "#F97316",
    bridgeColor: "#334155",
    midBuilding: "#0F172A",
    midWindow: "#FFD700",
    lakeWater: "#0F172A",
    nearBuildingA: "#1E293B",
    nearBuildingB: "#312E81",
    nearBuildingC: "#3F3F46",
    roadTop: "#09090B",
    roadStripe: "#FFD700",
    sidewalk: "#52525B",
    isNight: true,
  },
};

const MAX_PARTICLES = 250;
const TILE_WIDTH = 1600;
const LAYER_HEIGHT = 420;

/**
 * Neo-Brutalist side-view East Bay Canvas 2D renderer for RAN WHEN PARKED.
 *
 * Pre-renders tileable offscreen parallax layers (Port of Oakland cranes,
 * Bay Bridge, Tribune Tower, FOX Theater, Lake Merritt lights, East Bay
 * storefronts & palms) and renders the side-profile moped, dynamic road grade,
 * pooled exhaust smoke, heat shimmer, and speed lines at 60fps.
 */
export class RideRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private width = 960;
  private height = 460;
  private dpr = 1;

  private farLayer: HTMLCanvasElement | null = null;
  private midLayer: HTMLCanvasElement | null = null;
  private nearLayer: HTMLCanvasElement | null = null;
  private cachedTimeOfDay: RideTelemetrySnapshot["timeOfDay"] | null = null;
  private layerDpr = 1;

  private particles: SmokeParticle[] = [];
  private particleCursor = 0;
  private smokeAccum = 0;
  private wheelAngle = 0;
  private rearWheelAngle = 0;
  private pedalAngle = 0;
  private smoothGrade = 0;
  private shakeAmp = 0;
  private elapsedRenderSec = 0;
  private lastSeizeActive = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 4,
        maxRadius: 18,
        life: 0,
        maxLife: 1,
        tint: "clear",
        outlined: false,
      });
    }
    this.resize();
  }

  resize(width?: number, height?: number): void {
    if (typeof window === "undefined") return;
    const rect =
      width !== undefined && height !== undefined
        ? { width, height }
        : this.canvas.getBoundingClientRect();
    const w = Math.max(
      280,
      Math.floor(rect.width || this.canvas.clientWidth || 960),
    );
    const h = Math.max(
      240,
      Math.floor(rect.height || this.canvas.clientHeight || 460),
    );
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.width = w;
    this.height = h;
    this.dpr = dpr;

    if (this.canvas.width !== Math.floor(w * dpr) || this.canvas.height !== Math.floor(h * dpr)) {
      this.canvas.width = Math.floor(w * dpr);
      this.canvas.height = Math.floor(h * dpr);
    }
  }

  triggerShake(intensity: number): void {
    this.shakeAmp = Math.min(18, Math.max(this.shakeAmp, intensity));
  }

  render(snapshot: RideTelemetrySnapshot, dtSec: number): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const dt = Math.min(0.05, Math.max(0.001, dtSec));
    this.elapsedRenderSec += dt;

    const targetLayerDpr = Math.min(this.dpr, 2);
    if (
      this.cachedTimeOfDay !== snapshot.timeOfDay ||
      this.layerDpr !== targetLayerDpr
    ) {
      this.buildParallaxLayers(snapshot.timeOfDay, targetLayerDpr);
      this.cachedTimeOfDay = snapshot.timeOfDay;
      this.layerDpr = targetLayerDpr;
    }

    // Trigger camera shake on seizure onset
    if (snapshot.seizeActive && !this.lastSeizeActive) {
      this.triggerShake(11);
    }
    this.lastSeizeActive = snapshot.seizeActive;

    // Smooth grade transition & motion accumulation
    this.smoothGrade += (snapshot.gradePct - this.smoothGrade) * Math.min(1, dt * 6);
    const metersPerSec = snapshot.speedMph * 0.44704;
    const wheelDelta = (metersPerSec * dt) / 0.24;
    this.wheelAngle += wheelDelta;
    if (!(snapshot.seizedHard && !snapshot.pedalingHome)) {
      this.rearWheelAngle += wheelDelta;
    }
    if (snapshot.pedaling) {
      this.pedalAngle += dt * 11;
    }
    this.shakeAmp *= Math.pow(0.04, dt);
    if (this.shakeAmp < 0.15) this.shakeAmp = 0;

    const palette = PALETTES[snapshot.timeOfDay];
    const w = this.width;
    const h = this.height;
    const roadY = Math.round(h * 0.72);
    const bikeX = Math.round(w * (w < 640 ? 0.28 : 0.32));

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // Camera shake offset
    const shakeX = this.shakeAmp > 0 ? (Math.random() * 2 - 1) * this.shakeAmp : 0;
    const shakeY = this.shakeAmp > 0 ? (Math.random() * 2 - 1) * this.shakeAmp : 0;

    // 1. Sky + Sun/Moon + Clouds/Stars
    this.drawSky(ctx, w, h, palette, snapshot.distanceM);

    // 2. Parallax East Bay skyline layers (with damped camera shake)
    const layerScale = Math.max(0.75, Math.min(1.15, h / 460));
    const drawLayerH = LAYER_HEIGHT * layerScale;
    const layerTop = roadY - drawLayerH + 14 * layerScale;

    this.drawTiledLayer(
      ctx,
      this.farLayer,
      snapshot.distanceM * 1.6 - shakeX * 0.25,
      layerTop + shakeY * 0.25,
      drawLayerH,
    );
    this.drawTiledLayer(
      ctx,
      this.midLayer,
      snapshot.distanceM * 4.4 - shakeX * 0.5,
      layerTop + 10 * layerScale + shakeY * 0.5,
      drawLayerH,
    );
    const nearLayerTop = layerTop + 16 * layerScale + shakeY * 0.75;
    this.drawTiledLayer(
      ctx,
      this.nearLayer,
      snapshot.distanceM * 9.8 - shakeX * 0.75,
      nearLayerTop,
      drawLayerH,
    );

    // Opaque ground skirt below nearLayer so steep +12% climbs never expose sky
    const skirtTop = nearLayerTop + drawLayerH - 2;
    if (skirtTop < h + 40) {
      ctx.fillStyle = palette.roadTop;
      ctx.fillRect(-24, skirtTop, w + 48, h + 40 - skirtTop);
    }

    // 3. Dynamic Road Grade World (tilted around moped ground contact)
    const gradeRad = -Math.max(-10, Math.min(15, this.smoothGrade)) * 0.011;

    const engineVib =
      snapshot.engineRunning && !snapshot.stalled
        ? Math.sin(this.elapsedRenderSec * 58) *
          (0.6 + snapshot.pistonKnock * 1.5)
        : 0;
    const bounce =
      snapshot.speedMph > 2
        ? Math.sin(this.elapsedRenderSec * 18) * Math.min(1.6, snapshot.speedMph * 0.04)
        : 0;

    const exhaustTip = this.getExhaustTipOffset(snapshot.exhaustVisual);
    const localTipX = exhaustTip.x;
    const localTipY = exhaustTip.y + bounce;
    const cosG = Math.cos(gradeRad);
    const sinG = Math.sin(gradeRad);
    const worldTipX = bikeX + shakeX + localTipX * cosG - localTipY * sinG;
    const worldTipY = roadY + shakeY + localTipX * sinG + localTipY * cosG;

    ctx.save();
    ctx.translate(bikeX + shakeX, roadY + shakeY);
    ctx.rotate(gradeRad);

    this.drawRoadAndHazards(ctx, w, h, bikeX, palette, snapshot);

    // Skid marks behind rear tire if seizing/locked while moving (not pedaling home)
    if (
      (snapshot.seizeActive || snapshot.seizedHard) &&
      !snapshot.pedalingHome &&
      snapshot.speedMph > 1
    ) {
      ctx.fillStyle = "rgba(9, 9, 11, 0.75)";
      ctx.fillRect(-260, 0, 232, 6);
    }

    ctx.restore();

    // 4. Exhaust smoke particles in world/screen-aligned coordinates
    this.updateAndDrawSmoke(
      ctx,
      dt,
      worldTipX,
      worldTipY,
      snapshot,
      metersPerSec,
      gradeRad,
    );

    // 5. Side-View Moped, Rider & Heat Shimmer in road-tilted space
    ctx.save();
    ctx.translate(bikeX + shakeX, roadY + shakeY);
    ctx.rotate(gradeRad);

    this.drawMopedAndRider(
      ctx,
      snapshot,
      bounce,
      engineVib,
      palette.isNight,
    );

    // Heat Shimmer off cylinder head when CHT > 180C
    if (snapshot.chtC > 180) {
      this.drawHeatShimmer(ctx, snapshot.chtC, bounce);
    }

    ctx.restore();

    // 6. Speed lines above 25 MPH
    if (snapshot.speedMph > 25) {
      this.drawSpeedLines(ctx, w, h, snapshot.speedMph, snapshot.powerbandActive);
    }

    // Subtle grade badge vignette on extreme climbs
    if (snapshot.seizeActive) {
      ctx.fillStyle = "rgba(220, 38, 38, 0.14)";
      ctx.fillRect(0, 0, w, h);
    }

    ctx.restore();
  }

  destroy(): void {
    this.farLayer = null;
    this.midLayer = null;
    this.nearLayer = null;
    this.ctx = null;
  }

  private drawSky(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    palette: SkyPalette,
    distanceM: number,
  ): void {
    const grad = ctx.createLinearGradient(0, 0, 0, h * 0.76);
    grad.addColorStop(0, palette.skyTop);
    grad.addColorStop(1, palette.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Sun or Moon
    const orbX = w * 0.78;
    const orbY = h * 0.19;
    ctx.fillStyle = palette.sunGlow;
    ctx.beginPath();
    ctx.arc(orbX, orbY, 54, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = palette.sunColor;
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(orbX, orbY, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (palette.isNight) {
      // Crisp geometric stars
      ctx.fillStyle = "#FEF08A";
      for (let i = 0; i < 24; i++) {
        const sx = ((i * 197 + 41) % w);
        const sy = ((i * 89 + 23) % (h * 0.42));
        const twinkle = 1.5 + Math.sin(this.elapsedRenderSec * 2.5 + i) * 0.8;
        ctx.fillRect(sx, sy, twinkle * 2, twinkle * 2);
      }
    } else {
      // Stylized neo-brutalist drifting clouds
      const drift = (distanceM * 0.4 + this.elapsedRenderSec * 6) % (w + 260);
      for (let i = 0; i < 3; i++) {
        const cx = ((w + 200 - drift + i * (w * 0.38)) % (w + 260)) - 130;
        const cy = h * (0.14 + (i % 2) * 0.09);
        ctx.fillStyle = palette.cloudFill;
        ctx.strokeStyle = "#09090B";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(cx, cy, 108, 28, 14);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + 34, cy, 18, Math.PI, 0);
        ctx.arc(cx + 68, cy - 2, 22, Math.PI, 0);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  private buildParallaxLayers(
    timeOfDay: RideTelemetrySnapshot["timeOfDay"],
    dpr: number,
  ): void {
    if (typeof document === "undefined") return;
    const p = PALETTES[timeOfDay];
    const layerDpr = Math.min(dpr, 2);

    // ── FAR LAYER: East Bay Hills + Port of Oakland Cranes + Bay Bridge ──
    const far = document.createElement("canvas");
    far.width = Math.round(TILE_WIDTH * layerDpr);
    far.height = Math.round(LAYER_HEIGHT * layerDpr);
    const fctx = far.getContext("2d");
    if (fctx) {
      fctx.scale(layerDpr, layerDpr);
      // Rolling Grizzly Peak / Oakland Hills (exact 2*PI periodic frequencies, ridge-only stroke)
      const ridgeY = (x: number) =>
        LAYER_HEIGHT -
        165 -
        Math.sin((x / TILE_WIDTH) * Math.PI * 2) * 48 -
        Math.cos((x / TILE_WIDTH) * Math.PI * 4) * 26;

      fctx.fillStyle = p.hillsFar;
      fctx.beginPath();
      fctx.moveTo(0, LAYER_HEIGHT);
      for (let x = 0; x <= TILE_WIDTH; x += 40) {
        fctx.lineTo(x, ridgeY(x));
      }
      fctx.lineTo(TILE_WIDTH, LAYER_HEIGHT);
      fctx.closePath();
      fctx.fill();

      fctx.strokeStyle = "#09090B";
      fctx.lineWidth = 3;
      fctx.beginPath();
      fctx.moveTo(0, ridgeY(0));
      for (let x = 40; x <= TILE_WIDTH; x += 40) {
        fctx.lineTo(x, ridgeY(x));
      }
      fctx.stroke();

      // Radio mast on Grizzly Peak
      fctx.strokeStyle = "#09090B";
      fctx.lineWidth = 3;
      fctx.beginPath();
      fctx.moveTo(395, 195);
      fctx.lineTo(395, 145);
      fctx.stroke();
      fctx.fillStyle = "#EF4444";
      fctx.beginPath();
      fctx.arc(395, 143, 4, 0, Math.PI * 2);
      fctx.fill();

      // Bay Bridge towers & suspension cables
      fctx.strokeStyle = p.bridgeColor;
      fctx.lineWidth = 4;
      const bridgeTowers = [640, 860];
      for (const tx of bridgeTowers) {
        fctx.fillStyle = p.bridgeColor;
        fctx.strokeStyle = "#09090B";
        fctx.lineWidth = 2.5;
        fctx.fillRect(tx - 6, 175, 12, 165);
        fctx.strokeRect(tx - 6, 175, 12, 165);
        fctx.fillRect(tx - 12, 205, 24, 6);
        fctx.fillRect(tx - 12, 245, 24, 6);
      }
      fctx.strokeStyle = p.bridgeColor;
      fctx.lineWidth = 2.5;
      fctx.beginPath();
      fctx.moveTo(520, 290);
      fctx.quadraticCurveTo(580, 275, 640, 180);
      fctx.quadraticCurveTo(750, 265, 860, 180);
      fctx.quadraticCurveTo(920, 275, 980, 290);
      fctx.stroke();

      // Port of Oakland Container Cranes (iconic orange/red A-frames)
      const craneXs = [110, 220, 1140, 1270];
      for (const cx of craneXs) {
        fctx.strokeStyle = "#09090B";
        fctx.fillStyle = p.craneColor;
        fctx.lineWidth = 2.5;
        // Boom arm
        fctx.beginPath();
        fctx.rect(cx - 42, 212, 108, 9);
        fctx.fill();
        fctx.stroke();
        // Legs
        fctx.fillRect(cx - 12, 212, 8, 125);
        fctx.strokeRect(cx - 12, 212, 8, 125);
        fctx.fillRect(cx + 18, 212, 8, 125);
        fctx.strokeRect(cx + 18, 212, 8, 125);
        // Top A-frame
        fctx.beginPath();
        fctx.moveTo(cx - 10, 212);
        fctx.lineTo(cx + 6, 178);
        fctx.lineTo(cx + 22, 212);
        fctx.stroke();
      }
    }
    this.farLayer = far;

    // ── MID LAYER: Tribune Tower, FOX Theater Marquee, Lake Merritt Lights ──
    const mid = document.createElement("canvas");
    mid.width = Math.round(TILE_WIDTH * layerDpr);
    mid.height = Math.round(LAYER_HEIGHT * layerDpr);
    const mctx = mid.getContext("2d");
    if (mctx) {
      mctx.scale(layerDpr, layerDpr);
      // Generic downtown Oakland silhouette blocks
      const blocks = [
        { x: 40, w: 90, h: 150 },
        { x: 145, w: 72, h: 195 },
        { x: 470, w: 110, h: 140 },
        { x: 960, w: 96, h: 175 },
        { x: 1380, w: 120, h: 155 },
      ];
      for (const b of blocks) {
        mctx.fillStyle = p.midBuilding;
        mctx.strokeStyle = "#09090B";
        mctx.lineWidth = 3;
        mctx.fillRect(b.x, LAYER_HEIGHT - b.h, b.w, b.h);
        mctx.strokeRect(b.x, LAYER_HEIGHT - b.h, b.w, b.h);
        mctx.fillStyle = p.midWindow;
        for (let wy = LAYER_HEIGHT - b.h + 18; wy < LAYER_HEIGHT - 45; wy += 22) {
          for (let wx = b.x + 14; wx < b.x + b.w - 18; wx += 22) {
            if ((wx + wy) % 3 !== 0 || p.isNight) {
              mctx.fillRect(wx, wy, 10, 12);
            }
          }
        }
      }

      // Oakland Tribune Tower (x ~ 270)
      const tx = 270;
      mctx.fillStyle = "#9A3412";
      mctx.strokeStyle = "#09090B";
      mctx.lineWidth = 3;
      mctx.fillRect(tx, LAYER_HEIGHT - 220, 74, 220);
      mctx.strokeRect(tx, LAYER_HEIGHT - 220, 74, 220);
      // Stepped copper-green roof & spire
      mctx.fillStyle = "#10B981";
      mctx.fillRect(tx + 14, LAYER_HEIGHT - 268, 46, 48);
      mctx.strokeRect(tx + 14, LAYER_HEIGHT - 268, 46, 48);
      mctx.beginPath();
      mctx.moveTo(tx + 18, LAYER_HEIGHT - 268);
      mctx.lineTo(tx + 37, LAYER_HEIGHT - 322);
      mctx.lineTo(tx + 56, LAYER_HEIGHT - 268);
      mctx.closePath();
      mctx.fill();
      mctx.stroke();
      // Clockface
      mctx.fillStyle = "#FEF08A";
      mctx.beginPath();
      mctx.arc(tx + 37, LAYER_HEIGHT - 244, 10, 0, Math.PI * 2);
      mctx.fill();
      mctx.stroke();

      // Lake Merritt strip + Necklace of Lights (x ~ 620..920)
      mctx.fillStyle = p.lakeWater;
      mctx.fillRect(600, LAYER_HEIGHT - 55, 340, 55);
      mctx.strokeStyle = "#09090B";
      mctx.lineWidth = 3;
      mctx.strokeRect(600, LAYER_HEIGHT - 55, 340, 55);
      for (let lx = 620; lx <= 920; lx += 30) {
        mctx.strokeStyle = "#09090B";
        mctx.lineWidth = 2;
        mctx.beginPath();
        mctx.moveTo(lx, LAYER_HEIGHT - 55);
        mctx.lineTo(lx, LAYER_HEIGHT - 78);
        mctx.stroke();
        mctx.fillStyle = "#FFD700";
        mctx.beginPath();
        mctx.arc(lx, LAYER_HEIGHT - 81, 4.5, 0, Math.PI * 2);
        mctx.fill();
        mctx.stroke();
      }

      // Glowing FOX Theater Marquee (x ~ 1100)
      const fx = 1100;
      mctx.fillStyle = "#7C2D12";
      mctx.strokeStyle = "#09090B";
      mctx.lineWidth = 3;
      mctx.fillRect(fx, LAYER_HEIGHT - 190, 180, 190);
      mctx.strokeRect(fx, LAYER_HEIGHT - 190, 180, 190);
      // Vertical FOX sign tower
      mctx.fillStyle = "#DC2626";
      mctx.fillRect(fx + 68, LAYER_HEIGHT - 275, 44, 95);
      mctx.strokeRect(fx + 68, LAYER_HEIGHT - 275, 44, 95);
      // Marquee canopy
      mctx.fillStyle = "#FFD700";
      mctx.fillRect(fx + 14, LAYER_HEIGHT - 125, 152, 34);
      mctx.strokeRect(fx + 14, LAYER_HEIGHT - 125, 152, 34);
      mctx.fillStyle = "#09090B";
      mctx.font = "900 22px Impact, sans-serif";
      mctx.textAlign = "center";
      mctx.fillText("FOX", fx + 90, LAYER_HEIGHT - 218);
      mctx.font = "900 14px sans-serif";
      mctx.fillText("OAKLAND", fx + 90, LAYER_HEIGHT - 103);
    }
    this.midLayer = mid;

    // ── NEAR LAYER: Storefronts, Utility Poles, Palm Trees, Streetlights ──
    const near = document.createElement("canvas");
    near.width = Math.round(TILE_WIDTH * layerDpr);
    near.height = Math.round(LAYER_HEIGHT * layerDpr);
    const nctx = near.getContext("2d");
    if (nctx) {
      nctx.scale(layerDpr, layerDpr);
      const shops = [
        { x: 60, w: 170, h: 118, color: p.nearBuildingA, awning: "#FFD700", label: "CAFÉ" },
        { x: 350, w: 190, h: 132, color: p.nearBuildingB, awning: "#EF4444", label: "TACOS" },
        { x: 740, w: 185, h: 124, color: p.nearBuildingC, awning: "#FFD700", label: "MOPEDS" },
        { x: 1120, w: 175, h: 128, color: p.nearBuildingA, awning: "#22D3EE", label: "PARTS" },
      ];
      for (const s of shops) {
        nctx.fillStyle = s.color;
        nctx.strokeStyle = "#09090B";
        nctx.lineWidth = 3;
        nctx.fillRect(s.x, LAYER_HEIGHT - s.h, s.w, s.h);
        nctx.strokeRect(s.x, LAYER_HEIGHT - s.h, s.w, s.h);
        // Awning
        nctx.fillStyle = s.awning;
        nctx.fillRect(s.x - 4, LAYER_HEIGHT - 74, s.w + 8, 20);
        nctx.strokeRect(s.x - 4, LAYER_HEIGHT - 74, s.w + 8, 20);
        // Shop window
        nctx.fillStyle = p.isNight ? "#FEF08A" : "#BAE6FD";
        nctx.fillRect(s.x + 18, LAYER_HEIGHT - 50, s.w - 36, 44);
        nctx.strokeRect(s.x + 18, LAYER_HEIGHT - 50, s.w - 36, 44);
        // Sign text
        nctx.fillStyle = "#09090B";
        nctx.font = "900 12px sans-serif";
        nctx.textAlign = "center";
        nctx.fillText(s.label, s.x + s.w / 2, LAYER_HEIGHT - 60);
      }

      // California Palm Trees
      const palmXs = [285, 640, 1020, 1440];
      for (const px of palmXs) {
        nctx.strokeStyle = "#09090B";
        nctx.fillStyle = "#78350F";
        nctx.lineWidth = 3;
        nctx.beginPath();
        nctx.moveTo(px - 7, LAYER_HEIGHT);
        nctx.quadraticCurveTo(px - 2, LAYER_HEIGHT - 95, px + 5, LAYER_HEIGHT - 175);
        nctx.lineTo(px + 13, LAYER_HEIGHT - 175);
        nctx.quadraticCurveTo(px + 8, LAYER_HEIGHT - 95, px + 7, LAYER_HEIGHT);
        nctx.closePath();
        nctx.fill();
        nctx.stroke();

        // Palm fronds
        nctx.fillStyle = p.isNight ? "#065F46" : "#16A34A";
        const frondAngles = [-2.5, -1.8, -1.1, -0.4, 0.3, 0.9];
        for (const ang of frondAngles) {
          nctx.save();
          nctx.translate(px + 9, LAYER_HEIGHT - 176);
          nctx.rotate(ang);
          nctx.beginPath();
          nctx.ellipse(24, 0, 26, 8, 0, 0, Math.PI * 2);
          nctx.fill();
          nctx.stroke();
          nctx.restore();
        }
      }

      // Utility poles & overhead wires
      const poleXs = [20, 560, 960, 1340];
      for (const ux of poleXs) {
        nctx.fillStyle = "#451A03";
        nctx.strokeStyle = "#09090B";
        nctx.lineWidth = 2.5;
        nctx.fillRect(ux, LAYER_HEIGHT - 210, 9, 210);
        nctx.strokeRect(ux, LAYER_HEIGHT - 210, 9, 210);
        nctx.fillRect(ux - 14, LAYER_HEIGHT - 196, 36, 6);
        nctx.strokeRect(ux - 14, LAYER_HEIGHT - 196, 36, 6);

        // Streetlight fixture
        nctx.fillStyle = "#FFD700";
        nctx.beginPath();
        nctx.arc(ux + 20, LAYER_HEIGHT - 190, 5, 0, Math.PI * 2);
        nctx.fill();
        if (p.isNight) {
          const wrapOffsets = [0];
          if (ux - 32 < 0) wrapOffsets.push(TILE_WIDTH);
          if (ux + 72 > TILE_WIDTH) wrapOffsets.push(-TILE_WIDTH);
          for (const dx of wrapOffsets) {
            const wx = ux + dx;
            const cone = nctx.createLinearGradient(
              wx + 20,
              LAYER_HEIGHT - 190,
              wx + 20,
              LAYER_HEIGHT,
            );
            cone.addColorStop(0, "rgba(255, 215, 0, 0.24)");
            cone.addColorStop(1, "rgba(255, 215, 0, 0)");
            nctx.fillStyle = cone;
            nctx.beginPath();
            nctx.moveTo(wx + 14, LAYER_HEIGHT - 186);
            nctx.lineTo(wx + 26, LAYER_HEIGHT - 186);
            nctx.lineTo(wx + 72, LAYER_HEIGHT);
            nctx.lineTo(wx - 32, LAYER_HEIGHT);
            nctx.closePath();
            nctx.fill();
          }
        }
      }

      // Power wires spanning across tile
      nctx.strokeStyle = "rgba(9, 9, 11, 0.65)";
      nctx.lineWidth = 1.5;
      nctx.beginPath();
      nctx.moveTo(0, LAYER_HEIGHT - 193);
      nctx.quadraticCurveTo(280, LAYER_HEIGHT - 170, 565, LAYER_HEIGHT - 193);
      nctx.quadraticCurveTo(760, LAYER_HEIGHT - 172, 965, LAYER_HEIGHT - 193);
      nctx.quadraticCurveTo(1150, LAYER_HEIGHT - 172, 1345, LAYER_HEIGHT - 193);
      nctx.quadraticCurveTo(1480, LAYER_HEIGHT - 176, TILE_WIDTH, LAYER_HEIGHT - 193);
      nctx.stroke();
    }
    this.nearLayer = near;
  }

  private drawTiledLayer(
    ctx: CanvasRenderingContext2D,
    layer: HTMLCanvasElement | null,
    scrollPx: number,
    top: number,
    drawHeight: number,
  ): void {
    if (!layer) return;
    const drawWidth = (TILE_WIDTH * drawHeight) / LAYER_HEIGHT;
    const offset = ((scrollPx % drawWidth) + drawWidth) % drawWidth;
    for (let x = -offset; x < this.width; x += drawWidth) {
      ctx.drawImage(layer, x, top, drawWidth, drawHeight);
    }
  }

  private drawRoadAndHazards(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    bikeX: number,
    palette: SkyPalette,
    snapshot: RideTelemetrySnapshot,
  ): void {
    const left = -bikeX - 180;
    const right = w - bikeX + 240;
    const roadSpan = right - left;

    // Sidewalk strip above road
    ctx.fillStyle = palette.sidewalk;
    ctx.fillRect(left, -24, roadSpan, 24);
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(left, -24);
    ctx.lineTo(right, -24);
    ctx.moveTo(left, 0);
    ctx.lineTo(right, 0);
    ctx.stroke();

    // Asphalt deck (deep enough so steep +12% climbs never expose sky)
    ctx.fillStyle = palette.roadTop;
    ctx.fillRect(left, 0, roadSpan, h + Math.ceil(w * 0.25));

    // Scrolling dashed yellow road markings
    const pxPerMeter = 22;
    const roadScroll = (snapshot.distanceM * pxPerMeter) % 140;
    ctx.fillStyle = palette.roadStripe;
    for (let x = left - roadScroll; x < right; x += 140) {
      ctx.fillRect(x, 42, 68, 7);
    }

    // Distance mile-markers every 250m
    const markerSpacingM = 250;
    const firstMarkerM =
      Math.floor((snapshot.distanceM - 25) / markerSpacingM) * markerSpacingM;
    for (let m = firstMarkerM; m <= snapshot.distanceM + 60; m += markerSpacingM) {
      if (m <= 0) continue;
      const mx = (m - snapshot.distanceM) * pxPerMeter;
      if (mx < left || mx > right) continue;
      ctx.fillStyle = "#18181B";
      ctx.fillRect(mx - 2, -62, 5, 40);
      ctx.fillStyle = "#FFD700";
      ctx.strokeStyle = "#09090B";
      ctx.lineWidth = 2.5;
      ctx.fillRect(mx - 24, -84, 48, 22);
      ctx.strokeRect(mx - 24, -84, 48, 22);
      ctx.fillStyle = "#09090B";
      ctx.font = "900 10px sans-serif";
      ctx.textAlign = "center";
      const miles = (m / 1609.34).toFixed(1);
      ctx.fillText(`${miles}MI`, mx, -69);
    }

    // Subtle scrolling pavement patches / potholes
    const patchSpacing = 260;
    const patchOffset = (snapshot.distanceM * pxPerMeter) % patchSpacing;
    ctx.fillStyle = "#09090B";
    for (let x = left - patchOffset; x < right; x += patchSpacing) {
      ctx.beginPath();
      ctx.ellipse(x + 80, 18, 16, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Overhead Stoplight Gantry when atStoplight or waiting at light
    if (snapshot.atStoplight || snapshot.stoplightRedSec > 0) {
      const gantryX = snapshot.atStoplight ? 130 : 210;
      // Stop line on road
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(gantryX - 18, 2, 10, 88);

      // Gantry pole & arm
      ctx.fillStyle = "#52525B";
      ctx.strokeStyle = "#09090B";
      ctx.lineWidth = 3;
      ctx.fillRect(gantryX, -178, 12, 156);
      ctx.strokeRect(gantryX, -178, 12, 156);
      ctx.fillRect(gantryX - 96, -172, 108, 10);
      ctx.strokeRect(gantryX - 96, -172, 108, 10);

      // Signal housing
      const sx = gantryX - 88;
      const sy = -166;
      ctx.fillStyle = "#18181B";
      ctx.fillRect(sx, sy, 26, 62);
      ctx.strokeRect(sx, sy, 26, 62);

      const isRed = snapshot.stoplightRedSec > 0;
      ctx.fillStyle = isRed ? "#EF4444" : "#450A0A";
      ctx.beginPath();
      ctx.arc(sx + 13, sy + 14, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#422006";
      ctx.beginPath();
      ctx.arc(sx + 13, sy + 31, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isRed ? "#052E16" : "#22C55E";
      ctx.beginPath();
      ctx.arc(sx + 13, sy + 48, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private getExhaustTipOffset(
    exhaustVisual: RideTelemetrySnapshot["exhaustVisual"],
  ): { x: number; y: number } {
    if (exhaustVisual === "stock") {
      return { x: -46, y: -15 };
    }
    return { x: -56, y: -24.5 };
  }

  private drawMopedAndRider(
    ctx: CanvasRenderingContext2D,
    snap: RideTelemetrySnapshot,
    bounce: number,
    engineVib: number,
    isNight: boolean,
  ): void {
    const rearX = -32;
    const frontX = 34;
    const wheelY = -17;
    const wheelR = 17;

    // Ground shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
    ctx.beginPath();
    ctx.ellipse(0, 2, 54, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw wheels (rear wheel freezes when seizedHard & not pedalingHome)
    this.drawWheel(ctx, rearX, wheelY, wheelR, this.rearWheelAngle);
    this.drawWheel(ctx, frontX, wheelY, wheelR, this.wheelAngle);

    ctx.save();
    ctx.translate(0, bounce);

    // Frame/Swingarm draws BEFORE Cylinder, which draws BEFORE Exhaust
    this.drawFrameByMake(
      ctx,
      snap.bikeMake,
      snap.bikeColorHex,
      snap.bikeAccentHex,
      isNight,
    );

    // Cylinder head & block
    this.drawCylinder(ctx, snap.cylinderVisual, snap.chtC, engineVib);

    // Exhaust pipe sits naturally outside the frame & cylinder
    this.drawExhaust(ctx, snap.exhaustVisual, engineVib);

    // Animated pedals & rider
    this.drawRiderAndPedals(ctx, snap);

    ctx.restore();
  }

  private drawWheel(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    angle: number,
  ): void {
    ctx.save();
    ctx.translate(cx, cy);

    // Tire
    ctx.fillStyle = "#18181B";
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rim
    ctx.fillStyle = "#E4E4E7";
    ctx.beginPath();
    ctx.arc(0, 0, r - 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Spinning spokes
    ctx.rotate(angle);
    ctx.strokeStyle = "#52525B";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * (r - 6), Math.sin(a) * (r - 6));
      ctx.stroke();
    }

    // Center hub
    ctx.fillStyle = "#FFD700";
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  private drawExhaust(
    ctx: CanvasRenderingContext2D,
    visual: RideTelemetrySnapshot["exhaustVisual"],
    vib: number,
  ): void {
    ctx.save();
    ctx.translate(0, vib * 0.5);
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 2.5;

    if (visual === "stock") {
      // Classic straight cigar muffler
      ctx.fillStyle = "#3F3F46";
      ctx.beginPath();
      ctx.moveTo(6, -18);
      ctx.lineTo(-46, -18);
      ctx.lineTo(-46, -12);
      ctx.lineTo(8, -12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // Expansion chamber (chrome/silver for performance, stealth black + gold for race)
      ctx.fillStyle = visual === "race" ? "#27272A" : "#D4D4D8";
      ctx.beginPath();
      ctx.moveTo(8, -20);
      ctx.lineTo(-4, -14);
      ctx.lineTo(-26, -11);
      ctx.lineTo(-40, -17);
      ctx.lineTo(-42, -23);
      ctx.lineTo(-24, -21);
      ctx.lineTo(-4, -19);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Stinger silencer
      ctx.fillStyle = visual === "race" ? "#FFD700" : "#52525B";
      ctx.fillRect(-56, -28, 16, 7);
      ctx.strokeRect(-56, -28, 16, 7);
    }
    ctx.restore();
  }

  private drawCylinder(
    ctx: CanvasRenderingContext2D,
    visual: RideTelemetrySnapshot["cylinderVisual"],
    chtC: number,
    vib: number,
  ): void {
    const isBigKit = visual !== "stock";
    const cylW = isBigKit ? 18 : 13;
    const cylH = isBigKit ? 16 : 12;
    const cx = 6;
    const cy = -28 + vib;

    ctx.save();
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 2.5;

    // Hot cylinder glow when approaching/in seizure range
    if (chtC > 195) {
      ctx.fillStyle = "rgba(239, 68, 68, 0.35)";
      ctx.beginPath();
      ctx.arc(cx + cylW / 2, cy + cylH / 2, 16, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle =
      visual === "race" ? "#FFD700" : isBigKit ? "#E4E4E7" : "#71717A";
    ctx.fillRect(cx, cy, cylW, cylH);
    ctx.strokeRect(cx, cy, cylW, cylH);

    // Cooling fins
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 1.5;
    const finCount = isBigKit ? 4 : 3;
    for (let i = 1; i <= finCount; i++) {
      const fy = cy + (cylH / (finCount + 1)) * i;
      ctx.beginPath();
      ctx.moveTo(cx + 1, fy);
      ctx.lineTo(cx + cylW - 1, fy);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawFrameByMake(
    ctx: CanvasRenderingContext2D,
    make: SimBikeMake,
    colorHex: string,
    accentHex: string,
    isNight: boolean,
  ): void {
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 3;

    // Rear swingarm + shock
    ctx.fillStyle = "#27272A";
    ctx.beginPath();
    ctx.moveTo(-32, -18);
    ctx.lineTo(-4, -22);
    ctx.lineTo(-4, -17);
    ctx.lineTo(-32, -14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Rear shock absorber
    ctx.strokeStyle = "#E4E4E7";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-30, -20);
    ctx.lineTo(-21, -39);
    ctx.stroke();
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 3;

    // Front forks & handlebars
    ctx.fillStyle = "#D4D4D8";
    ctx.beginPath();
    ctx.moveTo(32, -17);
    ctx.lineTo(18, -55);
    ctx.lineTo(23, -56);
    ctx.lineTo(36, -18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Handlebars
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(20, -55);
    ctx.lineTo(16, -65);
    ctx.lineTo(8, -65);
    ctx.stroke();

    // Make-specific silhouette
    ctx.fillStyle = colorHex;
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 3;

    if (make === "puch-maxi") {
      // Sweeping monocoque step-through backbone
      ctx.beginPath();
      ctx.moveTo(-34, -36);
      ctx.lineTo(-14, -44);
      ctx.lineTo(0, -34);
      ctx.lineTo(15, -49);
      ctx.lineTo(22, -46);
      ctx.lineTo(7, -26);
      ctx.lineTo(-16, -26);
      ctx.lineTo(-36, -30);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Tank stripe accent
      ctx.fillStyle = accentHex;
      ctx.fillRect(6, -42, 11, 5);
    } else if (make === "honda-hobbit") {
      // U-frame with rear under-rack tank & cream/accent downtube cover
      ctx.beginPath();
      ctx.moveTo(-36, -40);
      ctx.lineTo(-10, -40);
      ctx.lineTo(-4, -27);
      ctx.lineTo(12, -27);
      ctx.lineTo(18, -48);
      ctx.lineTo(23, -46);
      ctx.lineTo(16, -22);
      ctx.lineTo(-12, -22);
      ctx.lineTo(-36, -32);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Hobbit signature downtube cover
      ctx.fillStyle = "#FEF3C7";
      ctx.fillRect(-3, -34, 15, 7);
      ctx.strokeRect(-3, -34, 15, 7);
    } else if (make === "derbi-variant") {
      // Angular wedge monocoque
      ctx.beginPath();
      ctx.moveTo(-35, -39);
      ctx.lineTo(-12, -46);
      ctx.lineTo(2, -32);
      ctx.lineTo(17, -50);
      ctx.lineTo(25, -46);
      ctx.lineTo(8, -24);
      ctx.lineTo(-18, -24);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = accentHex;
      ctx.beginPath();
      ctx.moveTo(-18, -33);
      ctx.lineTo(4, -33);
      ctx.lineTo(1, -27);
      ctx.lineTo(-18, -27);
      ctx.closePath();
      ctx.fill();
    } else {
      // Tomos A35: horizontal top-tube box tank + boxy side cover + aero nose
      ctx.beginPath();
      ctx.moveTo(-34, -38);
      ctx.lineTo(-10, -43);
      ctx.lineTo(19, -45);
      ctx.lineTo(23, -37);
      ctx.lineTo(4, -24);
      ctx.lineTo(-22, -24);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Boxy top tank accent
      ctx.fillStyle = accentHex;
      ctx.fillRect(-4, -44, 20, 8);
      ctx.strokeRect(-4, -44, 20, 8);
    }

    // Saddle
    ctx.fillStyle = "#18181B";
    ctx.beginPath();
    ctx.roundRect(-24, -49, 22, 8, 3);
    ctx.fill();
    ctx.stroke();

    // Headlight + beam
    ctx.fillStyle = "#18181B";
    ctx.beginPath();
    if (make === "honda-hobbit" || make === "tomos-a35") {
      ctx.rect(22, -55, 9, 8);
    } else {
      ctx.arc(25, -51, 5.5, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();

    // Headlight lens + beam cone
    ctx.fillStyle = "#FEF08A";
    ctx.fillRect(29, -54, 3, 6);
    if (isNight) {
      const beam = ctx.createLinearGradient(32, -51, 210, -25);
      beam.addColorStop(0, "rgba(254, 240, 138, 0.48)");
      beam.addColorStop(1, "rgba(254, 240, 138, 0)");
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(32, -54);
      ctx.lineTo(220, -78);
      ctx.lineTo(220, -4);
      ctx.lineTo(32, -48);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawRiderAndPedals(
    ctx: CanvasRenderingContext2D,
    snap: RideTelemetrySnapshot,
  ): void {
    const tuckAmt = snap.tuck ? 1 : 0;
    const isPedaling = snap.pedaling;

    // Crank & pedal animation
    const crankX = -3;
    const crankY = -19;
    const pedX = crankX + Math.cos(this.pedalAngle) * 8;
    const pedY = crankY + Math.sin(this.pedalAngle) * 8;

    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(crankX, crankY);
    ctx.lineTo(pedX, pedY);
    ctx.stroke();

    // Torso lean angle (upright vs aero tuck)
    const hipX = -15;
    const hipY = -49;
    const shoulderX = hipX + 6 + tuckAmt * 14;
    const shoulderY = hipY - 22 + tuckAmt * 11;
    const headX = shoulderX + 3 + tuckAmt * 7;
    const headY = shoulderY - 12 + tuckAmt * 3;

    // Leg (hip -> knee -> pedal): outline first, inner fill on top, isolated lineCap
    const kneeX = (hipX + pedX) * 0.5 + 9;
    const kneeY = (hipY + pedY) * 0.5 - (isPedaling ? 5 : 2);
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(hipX, hipY + 2);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(pedX, pedY);
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.strokeStyle = "#1E293B";
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();

    // Jacket torso & arm (isolated lineCap)
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(shoulderX, shoulderY);
    ctx.stroke();

    ctx.strokeStyle = "#18181B";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(shoulderX, shoulderY);
    ctx.stroke();

    // Arm reaching to handlebars
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY + 2);
    ctx.lineTo(10, -64);
    ctx.stroke();
    ctx.strokeStyle = "#27272A";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

    // Helmet (PCA Gold + dark visor)
    ctx.fillStyle = "#FFD700";
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(headX, headY, 10.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Visor
    ctx.fillStyle = "#09090B";
    ctx.beginPath();
    ctx.roundRect(headX + 2, headY - 4, 9, 6, 2);
    ctx.fill();
  }

  private updateAndDrawSmoke(
    ctx: CanvasRenderingContext2D,
    dt: number,
    tipX: number,
    tipY: number,
    snap: RideTelemetrySnapshot,
    metersPerSec: number,
    gradeRad: number,
  ): void {
    const density = snap.smoke.density;
    if (snap.engineRunning && !snap.stalled && density > 0.04) {
      const emitRate = 8 + density * 58; // particles per second
      this.smokeAccum += emitRate * dt;
      while (this.smokeAccum >= 1) {
        this.smokeAccum -= 1;
        this.spawnSmokeParticle(
          tipX,
          tipY,
          snap.smoke.tint,
          density,
          metersPerSec,
          gradeRad,
        );
      }
    }

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i]!;
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }

      const progress = p.life / p.maxLife;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 14 * dt; // warm exhaust rises straight up in world space
      p.vx *= Math.pow(0.45, dt);
      p.radius = p.radius + (p.maxRadius - p.radius) * Math.min(1, dt * 4);

      const alpha = (1 - progress) * (p.tint === "clear" ? 0.14 : 0.72);
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);

      if (p.tint === "thick-blue-grey") {
        ctx.fillStyle = "#94A3B8";
      } else if (p.tint === "light-blue") {
        ctx.fillStyle = "#93C5FD";
      } else if (p.tint === "white-steam") {
        ctx.fillStyle = "#F8FAFC";
      } else {
        ctx.fillStyle = "#E2E8F0";
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();

      if (p.outlined && p.radius > 7) {
        ctx.strokeStyle = "#09090B";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private spawnSmokeParticle(
    x: number,
    y: number,
    tint: SmokeTint,
    density: number,
    metersPerSec: number,
    gradeRad: number,
  ): void {
    const p = this.particles[this.particleCursor]!;
    this.particleCursor = (this.particleCursor + 1) % MAX_PARTICLES;

    const ejectSpeed = 65 + Math.random() * 25;
    const cosG = Math.cos(gradeRad);
    const sinG = Math.sin(gradeRad);

    p.active = true;
    p.x = x - Math.random() * 4;
    p.y = y + (Math.random() * 2 - 1) * 3;
    p.vx = -ejectSpeed * cosG - (metersPerSec * 14 + Math.random() * 20);
    p.vy = -ejectSpeed * sinG - 12 + (Math.random() * 2 - 1) * 14;
    p.radius = 3.5 + density * 3;
    p.maxRadius =
      tint === "thick-blue-grey"
        ? 16 + density * 14
        : tint === "white-steam"
          ? 14 + density * 10
          : 9 + density * 7;
    p.life = 0;
    p.maxLife = tint === "thick-blue-grey" ? 1.15 : 0.75;
    p.tint = tint;
    p.outlined = tint === "thick-blue-grey" && density > 0.45;
  }

  private drawHeatShimmer(
    ctx: CanvasRenderingContext2D,
    chtC: number,
    bounce: number,
  ): void {
    const intensity = Math.min(1, (chtC - 180) / 55);
    const waveCount = 4;

    ctx.save();
    ctx.lineCap = "round";

    for (let i = 0; i < waveCount; i++) {
      const baseX = 7 + i * 5;
      const baseY = -32 + bounce;
      ctx.beginPath();
      for (let step = 0; step <= 5; step++) {
        const py = baseY - step * 6;
        const px =
          baseX +
          Math.sin(this.elapsedRenderSec * 14 + i * 1.4 + step * 1.1) *
            (2.2 + intensity * 2.2);
        if (step === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      // Subtle dark halo so heat waves pop against bright Oakland sky
      ctx.strokeStyle = `rgba(9, 9, 11, ${0.42 + intensity * 0.25})`;
      ctx.lineWidth = 4.5;
      ctx.stroke();

      // High-contrast orange/red wavy heat lines
      ctx.strokeStyle =
        chtC > 215
          ? `rgba(239, 68, 68, ${0.72 + intensity * 0.28})`
          : `rgba(249, 115, 22, ${0.65 + intensity * 0.3})`;
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawSpeedLines(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    speedMph: number,
    powerbandActive: boolean,
  ): void {
    const intensity = Math.min(1, (speedMph - 25) / 25);
    const count = Math.floor(4 + intensity * 8);

    ctx.save();
    ctx.strokeStyle = powerbandActive
      ? "rgba(255, 215, 0, 0.52)"
      : "rgba(255, 255, 255, 0.38)";
    ctx.lineWidth = powerbandActive ? 2.5 : 1.8;

    for (let i = 0; i < count; i++) {
      const phase = (this.elapsedRenderSec * (1.8 + i * 0.13) + i * 0.37) % 1;
      const lx = w * (1 - phase);
      const ly = h * (0.14 + ((i * 73) % 72) / 100);
      const len = 38 + intensity * 74;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx - len, ly);
      ctx.stroke();
    }
    ctx.restore();
  }
}
