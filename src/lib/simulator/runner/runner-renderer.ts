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

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not initialize 2D context for Street Runner");
    }
    this.ctx = ctx;
    this.resize(canvas.clientWidth || 960, canvas.clientHeight || 430);
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

  render(state: RunnerState, dt: number): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const zone = RUNNER_ZONES[state.zoneIndex] ?? RUNNER_ZONES[0]!;

    // Road geometry: top 42% is Oakland sky/skyline, bottom 58% is 3-lane boulevard
    const horizonY = Math.round(h * 0.44);
    const roadH = h - horizonY;
    const curbH = 12;
    const laneTop = horizonY + curbH + 10;
    const laneAreaH = roadH - curbH - 22;
    const laneH = laneAreaH / 3;
    const laneY = (laneFloat: number) => laneTop + (laneFloat + 0.5) * laneH;

    // Player screen anchor
    const playerScreenX = Math.round(w * 0.2);
    const pxPerMeter = Math.max(11, Math.min(18, w / 58));

    // Wheel spin & particles
    if (!state.engine.wheelLocked) {
      this.wheelAngle += state.speedMps * dt * 2.4;
    }
    this.updateParticles(state, dt, playerScreenX, laneY(state.lanePos));

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // Camera shake on hit/seize
    if (state.cameraShakeSec > 0) {
      const mag = Math.min(8, state.cameraShakeSec * 18);
      ctx.translate((Math.random() - 0.5) * mag * 2, (Math.random() - 0.5) * mag * 2);
    }

    // 1. Sky + Sun/Moon
    this.drawSky(ctx, w, horizonY, zone, state.distanceM);

    // 2. Parallax Oakland Hills, Port Cranes, Fox Theater & Palms
    this.drawSkyline(ctx, w, horizonY, zone, state.distanceM);

    // 3. 3-Lane Asphalt Boulevard
    this.drawRoad(ctx, w, h, horizonY, curbH, laneTop, laneH, state, pxPerMeter);

    // 4. Depth-sorted draw list (by lanePos so foreground lanes overlap background lanes)
    type DrawItem = { sortY: number; draw: () => void };
    const drawList: DrawItem[] = [];

    for (const ent of state.entities) {
      const ex = playerScreenX + (ent.xM - state.distanceM) * pxPerMeter;
      if (ex < -140 || ex > w + 160) continue;
      const ey = laneY(ent.lanePos);
      drawList.push({
        sortY: ent.kind === "shop" ? horizonY + roadH + 20 : ey,
        draw: () => this.drawEntity(ctx, ent, ex, ey, laneTop, laneH, state.elapsedSec),
      });
    }

    const playerY = laneY(state.lanePos);
    drawList.push({
      sortY: playerY + 1,
      draw: () => this.drawMopedAndRider(ctx, state, playerScreenX, playerY, zone.isNight),
    });

    drawList.sort((a, b) => a.sortY - b.sortY);
    for (const item of drawList) item.draw();

    // 5. Exhaust Smoke & Burst Sparks
    this.drawParticles(ctx);

    // 6. Speed lines on Powerband / Treatland Turbo
    if ((state.engine.powerbandActive || state.turboSec > 0) && state.speedMps > 9) {
      this.drawSpeedLines(ctx, w, h, state.turboSec > 0 ? "#FFD700" : "#38BDF8", state.elapsedSec);
    }

    // 7. Hit flash overlay
    if (state.hitFlashSec > 0) {
      ctx.fillStyle = `rgba(239, 68, 68, ${Math.min(0.45, state.hitFlashSec * 1.1)})`;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.restore();
  }

  private drawSky(
    ctx: CanvasRenderingContext2D,
    w: number,
    horizonY: number,
    zone: RunnerZone,
    distanceM: number,
  ): void {
    const grad = ctx.createLinearGradient(0, 0, 0, horizonY);
    grad.addColorStop(0, zone.skyTop);
    grad.addColorStop(0.62, zone.skyMid);
    grad.addColorStop(1, zone.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, horizonY + 4);

    // Sun / Moon
    const sunX = w * 0.78;
    const sunY = horizonY * 0.38;
    const sunR = zone.isNight ? 20 : 28;
    ctx.save();
    ctx.fillStyle = zone.sunColor;
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

    // Night stars
    if (zone.isNight) {
      ctx.fillStyle = "#FEF08A";
      for (let i = 0; i < 24; i++) {
        const sx = ((i * 137 + 43 - distanceM * 0.4) % w + w) % w;
        const sy = 12 + ((i * 59) % Math.max(20, horizonY - 50));
        ctx.fillRect(sx, sy, i % 3 === 0 ? 2.5 : 1.5, i % 3 === 0 ? 2.5 : 1.5);
      }
    }
  }

  private drawSkyline(
    ctx: CanvasRenderingContext2D,
    w: number,
    horizonY: number,
    zone: RunnerZone,
    distanceM: number,
  ): void {
    // Far East Bay Hills
    const hillScroll = distanceM * 1.8;
    ctx.fillStyle = zone.farHill;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    for (let x = 0; x <= w + 20; x += 20) {
      const worldX = x + hillScroll;
      const y =
        horizonY -
        34 -
        Math.sin(worldX * 0.0055) * 20 -
        Math.cos(worldX * 0.012) * 10;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, horizonY);
    ctx.closePath();
    ctx.fill();

    // Midground Oakland skyline (Port cranes, Fox sign, buildings) repeating every 720px
    const tile = 720;
    const midScroll = (distanceM * 5.2) % tile;
    for (let base = -midScroll; base < w + tile; base += tile) {
      // Port of Oakland crane
      const cx = base + 120;
      ctx.strokeStyle = "#EA580C";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, horizonY);
      ctx.lineTo(cx + 12, horizonY - 68);
      ctx.lineTo(cx + 28, horizonY);
      ctx.moveTo(cx - 28, horizonY - 52);
      ctx.lineTo(cx + 58, horizonY - 52);
      ctx.stroke();

      // City blocks
      const blocks = [
        { x: 220, bw: 54, bh: 64 },
        { x: 282, bw: 44, bh: 92 },
        { x: 334, bw: 62, bh: 56 },
        { x: 510, bw: 52, bh: 74 },
        { x: 572, bw: 68, bh: 52 },
      ];
      ctx.fillStyle = zone.midBuilding;
      ctx.strokeStyle = "#09090B";
      ctx.lineWidth = 2;
      for (const b of blocks) {
        ctx.fillRect(base + b.x, horizonY - b.bh, b.bw, b.bh);
        ctx.strokeRect(base + b.x, horizonY - b.bh, b.bw, b.bh);
        // Lit windows
        ctx.fillStyle = zone.isNight ? "#FDE047" : "#BAE6FD";
        for (let wy = horizonY - b.bh + 10; wy < horizonY - 12; wy += 14) {
          for (let wx = base + b.x + 8; wx < base + b.x + b.bw - 10; wx += 14) {
            ctx.fillRect(wx, wy, 6, 7);
          }
        }
        ctx.fillStyle = zone.midBuilding;
      }

      // Fox Oakland marquee tower
      const fx = base + 422;
      ctx.fillStyle = "#7C2D12";
      ctx.fillRect(fx, horizonY - 76, 62, 76);
      ctx.strokeRect(fx, horizonY - 76, 62, 76);
      ctx.fillStyle = "#DC2626";
      ctx.fillRect(fx + 20, horizonY - 112, 22, 42);
      ctx.strokeRect(fx + 20, horizonY - 112, 22, 42);
      ctx.fillStyle = "#FFD700";
      ctx.font = "900 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("FOX", fx + 31, horizonY - 87);
    }

    // Near Palm Trees & Streetlights
    const palmTile = 340;
    const nearScroll = (distanceM * 10.5) % palmTile;
    for (let px = -nearScroll; px < w + palmTile; px += palmTile) {
      // Palm trunk
      ctx.strokeStyle = "#09090B";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(px + 40, horizonY);
      ctx.quadraticCurveTo(px + 46, horizonY - 40, px + 54, horizonY - 78);
      ctx.stroke();
      ctx.strokeStyle = "#92400E";
      ctx.lineWidth = 3;
      ctx.stroke();
      // Fronds
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
    // Sidewalk / Curb
    ctx.fillStyle = "#A1A1AA";
    ctx.fillRect(0, horizonY, w, curbH);
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(w, horizonY);
    ctx.moveTo(0, horizonY + curbH);
    ctx.lineTo(w, horizonY + curbH);
    ctx.stroke();

    // Asphalt
    ctx.fillStyle = "#1F2026";
    ctx.fillRect(0, horizonY + curbH, w, h - horizonY - curbH);

    // Subtle highlight on active target lane so lane position is unmistakably clear
    ctx.fillStyle = "rgba(255, 215, 0, 0.055)";
    ctx.fillRect(0, laneTop + state.targetLane * laneH, w, laneH);

    // Dashed lane dividers between Lane 0/1 and Lane 1/2
    const dashStep = 110;
    const offset = (state.distanceM * pxPerMeter) % dashStep;
    ctx.fillStyle = "#FFD700";
    for (const dividerIdx of [1, 2]) {
      const y = laneTop + dividerIdx * laneH - 2;
      for (let x = -offset; x < w + dashStep; x += dashStep) {
        ctx.fillRect(x, y, 52, 4);
      }
    }

    // Bottom solid street border
    ctx.fillStyle = "#09090B";
    ctx.fillRect(0, h - 8, w, 8);
  }

  private drawEntity(
    ctx: CanvasRenderingContext2D,
    ent: RunnerEntity,
    x: number,
    y: number,
    laneTop: number,
    laneH: number,
    elapsedSec: number,
  ): void {
    if (ent.kind === "shop") {
      this.drawShopArch(ctx, ent.subKind as RunnerShopKind, x, laneTop, laneH * 3, elapsedSec);
      return;
    }

    if (ent.kind === "collectible") {
      this.drawCollectible(ctx, ent.subKind as RunnerCollectibleKind, x, y, elapsedSec);
      return;
    }

    // Obstacles
    switch (ent.subKind) {
      case "car":
        this.drawCar(ctx, x, y, ent.carVariant ?? "sedan", ent.carColor ?? "#EF4444");
        break;
      case "pothole":
        ctx.save();
        ctx.translate(x, y + 8);
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
        ctx.translate(x, y + 8);
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
        ctx.translate(x, y + 6);
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
        ctx.save();
        ctx.translate(x, y + 4);
        const hop = Math.abs(Math.sin(elapsedSec * 12)) * 4;
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(0, 6, 16, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.translate(0, -hop);
        ctx.fillStyle = "#D97706";
        ctx.strokeStyle = "#09090B";
        ctx.lineWidth = 2.5;
        // Body
        ctx.fillRect(-14, -14, 24, 13);
        ctx.strokeRect(-14, -14, 24, 13);
        // Head
        ctx.fillRect(6, -22, 12, 11);
        ctx.strokeRect(6, -22, 12, 11);
        // Ears & tail
        ctx.fillStyle = "#78350F";
        ctx.fillRect(10, -24, 4, 6);
        ctx.fillRect(-19, -16, 6, 4);
        // Legs
        ctx.fillStyle = "#D97706";
        ctx.fillRect(-12, -2, 4, 7);
        ctx.fillRect(4, -2, 4, 7);
        ctx.restore();
        break;
    }
  }

  private drawCar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    variant: "sedan" | "hatchback" | "van",
    color: string,
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
    ctx.fillStyle = "#93C5FD";
    ctx.fillRect(-cabW / 2, -bodyH - cabH, cabW - 8, cabH - 4);

    // Taillights (left = rear facing overtaking player!) & headlights (right)
    ctx.fillStyle = "#EF4444";
    ctx.fillRect(-bodyW / 2, -bodyH, 5, 8);
    ctx.fillStyle = "#FEF08A";
    ctx.fillRect(bodyW / 2 - 5, -bodyH, 5, 8);

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
    ctx.font = "900 8px sans-serif";
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
    ctx.font = "900 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(c.title, x, laneTop - 84);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "800 9px sans-serif";
    ctx.fillText(c.sub, x, laneTop - 71);
    ctx.restore();
  }

  private drawMopedAndRider(
    ctx: CanvasRenderingContext2D,
    state: RunnerState,
    x: number,
    y: number,
    isNight: boolean,
  ): void {
    // Blink during post-hit invincibility
    if (state.invincibleSec > 0 && Math.floor(state.elapsedSec * 18) % 2 === 0) {
      return;
    }

    const eng = state.engine;
    const p = state.profile;
    const wheelieLift = state.wheelieHeightFrac * 18;
    const wheeliePitch = -state.wheelieHeightFrac * 0.48; // nose up!
    const vib = eng.running ? Math.sin(state.elapsedSec * 65) * 0.9 : 0;

    ctx.save();
    ctx.translate(x, y + 8);

    // Ground shadow stays on asphalt
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.beginPath();
    ctx.ellipse(0, 4, 42 - state.wheelieHeightFrac * 8, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pivot around rear wheel contact patch for wheelies!
    ctx.translate(-22, -wheelieLift * 0.35);
    ctx.rotate(wheeliePitch + state.leanAngle * 0.08);
    ctx.translate(22, 0);

    // Turbo aura
    if (state.turboSec > 0) {
      ctx.fillStyle = "rgba(255, 215, 0, 0.22)";
      ctx.beginPath();
      ctx.ellipse(-6, -24, 52, 26, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Wheels
    this.drawWheel(ctx, -24, -12, 13, this.wheelAngle);
    this.drawWheel(ctx, 26, -12, 13, this.wheelAngle);

    // Frame by make
    this.drawFrame(ctx, state.bike.make, state.bike.colorHex, state.bike.accentHex, isNight);

    // Cylinder (glows orange-red if overheating!)
    ctx.save();
    ctx.translate(4, -22 + vib);
    const hot = eng.chtC > 185;
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

    // Rider
    ctx.save();
    ctx.lineCap = "round";
    // Leg (black outline first, then slate fill)
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-14, -29);
    ctx.lineTo(-2, -20);
    ctx.lineTo(-6, -10);
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

    // Arm to bars
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-2, -46);
    ctx.lineTo(14, -39);
    ctx.stroke();
    ctx.strokeStyle = "#27272A";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Helmet
    ctx.fillStyle = state.bike.colorHex;
    ctx.strokeStyle = "#09090B";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(1, -56, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Visor
    ctx.fillStyle = "#09090B";
    ctx.fillRect(4, -59, 6, 4);
    ctx.restore();

    // High-contrast heat shimmer when hot
    if (eng.chtC > 180) {
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
    // Emit smoke based on real 2-stroke smokeDensity & tint!
    if (eng.running && eng.smokeDensity > 0.04) {
      this.smokeTimer += dt * (8 + eng.smokeDensity * 26);
      while (this.smokeTimer >= 1) {
        this.smokeTimer -= 1;
        this.smokePuffs.push({
          x: px - 38,
          y: py - 8 - state.wheelieHeightFrac * 8 + (Math.random() - 0.5) * 4,
          vx: -80 - state.speedMps * 8 - Math.random() * 40,
          vy: -14 - Math.random() * 18,
          radius: 5 + eng.smokeDensity * 8,
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
      if (p.tint === "thick-blue-grey") {
        ctx.strokeStyle = `rgba(9, 9, 11, ${0.35 * frac})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    for (const sp of this.sparks) {
      ctx.fillStyle = sp.color;
      ctx.fillRect(sp.x - 2, sp.y - 2, 4, 4);
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
}
