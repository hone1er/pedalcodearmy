"use client";

import type { RideTelemetrySnapshot, SimEvent } from "../contract";

export type ArcadeSfxKind =
  | "lane-shift"
  | "wheelie"
  | "wheelie-clear"
  | "close-call"
  | "pickup"
  | "shop-arch"
  | "hit"
  | "car-horn"
  | "dog-bark"
  | "zone-change";

export interface ArcadeSfxOpts {
  strong?: boolean;
  comboStep?: number;
  shop?: string;
}

export type GarageSfxKind =
  | "install"
  | "plug-pull"
  | "carb-spray"
  | "compression-kick"
  | "spark-snap"
  | "jet-click"
  | "switch-flip";

export interface GarageSfxOpts {
  sparkQuality?: "fat-blue" | "weak-orange" | "none";
}

const MUTE_STORAGE_KEY = "pca-rwp-muted";
const SCHEDULER_INTERVAL_MS = 25;
const LOOKAHEAD_SEC = 0.1;
const MASTER_GAIN_LEVEL = 0.42;

export function loadSimMutedPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveSimMutedPreference(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? "1" : "0");
  } catch {
    // Ignore storage restrictions
  }
}

/**
 * Lookahead firing-pulse 2-stroke Web Audio synthesizer for RAN WHEN PARKED.
 *
 * Drives all engine cadence, exhaust resonance, misfire patterns, detonation
 * pings, clutch slip whine, mechanical piston knock (Listen Mode), and
 * one-shot ride SFX strictly from observable `RideTelemetrySnapshot` & `SimEvent`.
 */
export class PulseSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private exhaustFilter: BiquadFilterNode | null = null;
  private exhaustBus: GainNode | null = null;
  private leanFilter: BiquadFilterNode | null = null;
  private leanBus: GainNode | null = null;
  private knockBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;

  private windSource: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;

  private whineOsc: OscillatorNode | null = null;
  private whineFilter: BiquadFilterNode | null = null;
  private whineGain: GainNode | null = null;

  private intakeSource: AudioBufferSourceNode | null = null;
  private intakeFilter: BiquadFilterNode | null = null;
  private intakeGain: GainNode | null = null;

  private cvtOsc: OscillatorNode | null = null;
  private cvtFilter: BiquadFilterNode | null = null;
  private cvtGain: GainNode | null = null;

  private popBuffers: AudioBuffer[] = [];
  private knockBuffer: AudioBuffer | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private schedulerTimer: number | null = null;
  private nextPulseTime = 0;
  private pulseIndex = 0;
  private lastDetonationAtMs = 0;

  // 2-stroke acoustic soul & cooldown state
  private prevThrottle = 0;
  private prevPowerbandActive = false;
  private overrunUntilTime = 0;
  private nextOverrunPopTime = 0;
  private powerbandSweepUntilTime = 0;
  private nextCooldownTickTime = 0;
  private cooldownTickCount = 0;

  private latestSnapshot: RideTelemetrySnapshot | null = null;
  private muted: boolean;
  private paused = false;
  private disposed = false;

  constructor(initialMuted?: boolean) {
    this.muted = initialMuted ?? loadSimMutedPreference();
  }

  isMuted(): boolean {
    return this.muted;
  }

  setPaused(paused: boolean): void {
    if (this.disposed) return;
    this.paused = paused;
    if (!this.ctx) return;

    if (paused) {
      this.nextPulseTime = 0;
      if (this.ctx.state === "running") {
        void this.ctx.suspend().catch(() => {
          /* ignore */
        });
      }
    } else if (!this.muted) {
      this.nextPulseTime = this.ctx.currentTime + 0.03;
      if (this.ctx.state === "suspended") {
        void this.ctx.resume().catch(() => {
          /* autoplay blocked until gesture */
        });
      }
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    saveSimMutedPreference(muted);
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(
        muted ? 0 : MASTER_GAIN_LEVEL,
        now,
        0.025,
      );
    }
    if (!muted && !this.paused && this.ctx?.state === "suspended") {
      void this.ctx.resume().catch(() => {
        /* autoplay blocked until gesture */
      });
    }
  }

  toggleMute(): boolean {
    const next = !this.muted;
    this.setMuted(next);
    return next;
  }

  unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === "suspended" && !this.muted && !this.paused) {
      void ctx.resume().catch(() => {
        /* ignore */
      });
    }
  }

  update(snapshot: RideTelemetrySnapshot | null): void {
    if (this.disposed) return;
    this.latestSnapshot = snapshot;

    if (!this.ctx || !this.exhaustFilter || !this.windGain || !this.whineGain) {
      if (snapshot) {
        this.prevThrottle = snapshot.throttle;
        this.prevPowerbandActive = snapshot.powerbandActive;
      }
      return;
    }

    const now = this.ctx.currentTime;

    if (this.paused || !snapshot?.active) {
      this.windGain.gain.setTargetAtTime(0, now, 0.06);
      this.whineGain.gain.setTargetAtTime(0, now, 0.05);
      this.intakeGain?.gain.setTargetAtTime(0, now, 0.05);
      this.cvtGain?.gain.setTargetAtTime(0, now, 0.05);
      this.prevThrottle = snapshot?.throttle ?? 0;
      this.prevPowerbandActive = snapshot?.powerbandActive ?? false;
      return;
    }

    const listenActive = snapshot.listenMode && snapshot.hasStethoscope;
    const isRaceOrPerf = snapshot.exhaustVisual !== "stock";

    // A3: Detect sharp throttle-chop overrun "ring-ding" & pipe coming on
    if (
      this.prevThrottle > 0.6 &&
      snapshot.throttle < 0.15 &&
      snapshot.rpm > 3800 &&
      snapshot.engineRunning &&
      !snapshot.stalled &&
      !snapshot.seizedHard
    ) {
      this.overrunUntilTime = now + 0.55;
      this.nextOverrunPopTime = Math.min(this.nextOverrunPopTime || now, now + 0.03);
    } else if (snapshot.throttle >= 0.25 || !snapshot.engineRunning || snapshot.stalled) {
      this.overrunUntilTime = 0;
    }

    if (
      snapshot.engineRunning &&
      !snapshot.stalled &&
      snapshot.powerbandActive &&
      !this.prevPowerbandActive
    ) {
      this.powerbandSweepUntilTime = now + 0.3;
      this.playPowerbandComeOnSweep(now);
    }

    this.prevThrottle = snapshot.throttle;
    this.prevPowerbandActive = snapshot.powerbandActive;

    // A5: Per-make pitch/filter shift
    const makeFilterMult =
      snapshot.bikeMake === "tomos-a35"
        ? 1.12
        : snapshot.bikeMake === "puch-maxi"
          ? 0.92
          : 1.0;

    // Resonant exhaust bandpass/lowpass character
    const rpmRatio = Math.max(
      0,
      Math.min(1.15, snapshot.rpm / Math.max(1000, snapshot.maxRpm)),
    );
    const leanShift = snapshot.leanTone > 0.2 ? snapshot.leanTone * 620 : 0;
    const sweepRemain = Math.max(0, this.powerbandSweepUntilTime - now) / 0.3;
    const pipeSweepHz = sweepRemain > 0 ? sweepRemain * 340 : 0;
    const pipeSweepQ = sweepRemain > 0 ? sweepRemain * 2.2 : 0;

    const nextFilterType: BiquadFilterType = isRaceOrPerf ? "bandpass" : "lowpass";
    if (this.exhaustFilter.type !== nextFilterType) {
      this.exhaustFilter.type = nextFilterType;
    }

    if (isRaceOrPerf) {
      const baseFreq = snapshot.exhaustVisual === "race" ? 1180 : 1080;
      const targetFreq = Math.min(
        2900,
        (baseFreq + rpmRatio * 480 + (snapshot.powerbandActive ? 260 : 0) + pipeSweepHz) *
          makeFilterMult +
          leanShift,
      );
      const q = (snapshot.powerbandActive ? 4.2 : 2.8) + pipeSweepQ;
      this.exhaustFilter.frequency.setTargetAtTime(targetFreq, now, 0.04);
      this.exhaustFilter.Q.setTargetAtTime(q, now, 0.04);
    } else {
      const targetFreq = Math.min(
        2350,
        (580 + rpmRatio * 360 + snapshot.throttle * 140 + pipeSweepHz) *
          makeFilterMult +
          leanShift,
      );
      this.exhaustFilter.frequency.setTargetAtTime(targetFreq, now, 0.04);
      this.exhaustFilter.Q.setTargetAtTime(1.9 + pipeSweepQ * 0.7, now, 0.04);
    }

    // Duck exhaust slightly in stethoscope Listen Mode so top-end knock stands out
    if (this.exhaustBus) {
      this.exhaustBus.gain.setTargetAtTime(listenActive ? 0.55 : 1.0, now, 0.05);
    }
    if (this.leanBus) {
      const leanLevel =
        snapshot.leanTone > 0.2 ? (snapshot.leanTone - 0.2) * 0.95 : 0;
      this.leanBus.gain.setTargetAtTime(leanLevel, now, 0.04);
    }
    if (this.knockBus) {
      const knockLevel = listenActive
        ? 0.6 + snapshot.pistonKnock * 1.15
        : snapshot.pistonKnock * 0.28;
      this.knockBus.gain.setTargetAtTime(knockLevel, now, 0.04);
    }

    // A3: Intake honk (~400Hz band-passed noise scaled by throttle, +60% for perf/race filter)
    if (this.intakeGain && this.intakeFilter) {
      if (snapshot.engineRunning && !snapshot.stalled && !snapshot.seizedHard) {
        const filterMult =
          snapshot.airFilterVisual === "performance" ||
          snapshot.airFilterVisual === "race"
            ? 1.6
            : 1.0;
        const listenDuck = listenActive ? 0.45 : 1.0;
        const intakeLevel =
          Math.pow(Math.max(0, snapshot.throttle), 1.1) *
          0.075 *
          filterMult *
          listenDuck;
        this.intakeFilter.frequency.setTargetAtTime(
          370 + rpmRatio * 90 + snapshot.throttle * 40,
          now,
          0.05,
        );
        this.intakeGain.gain.setTargetAtTime(intakeLevel, now, 0.045);
      } else {
        this.intakeGain.gain.setTargetAtTime(0, now, 0.04);
      }
    }

    // Wind / road rush proportional to speed, ducked when Listen Mode is active
    const speedRatio = Math.min(1, Math.max(0, snapshot.speedMph / 48));
    const windVol = listenActive
      ? speedRatio * 0.025
      : speedRatio * speedRatio * 0.16;
    this.windGain.gain.setTargetAtTime(windVol, now, 0.08);
    if (this.windFilter) {
      this.windFilter.frequency.setTargetAtTime(
        260 + speedRatio * 1100,
        now,
        0.08,
      );
    }

    // A5: Subtle road-speed-tracked CVT belt hum for Honda Hobbit & Derbi Variant
    if (this.cvtGain && this.cvtOsc && this.cvtFilter) {
      const hasCvt =
        snapshot.bikeMake === "honda-hobbit" ||
        snapshot.bikeMake === "derbi-variant";
      if (hasCvt && snapshot.speedMph > 2 && !snapshot.seizedHard) {
        const cvtFreq = 135 + speedRatio * 230 + rpmRatio * 45;
        this.cvtOsc.frequency.setTargetAtTime(cvtFreq, now, 0.05);
        this.cvtFilter.frequency.setTargetAtTime(cvtFreq * 1.15, now, 0.05);
        const cvtVol =
          Math.min(0.042, speedRatio * 0.038) * (listenActive ? 0.4 : 1.0);
        this.cvtGain.gain.setTargetAtTime(cvtVol, now, 0.06);
      } else {
        this.cvtGain.gain.setTargetAtTime(0, now, 0.05);
      }
    }

    // Clutch slip whine when slip > 0.15
    if (
      snapshot.engineRunning &&
      !snapshot.stalled &&
      snapshot.clutchSlip > 0.15
    ) {
      const slipAmount = Math.min(1, (snapshot.clutchSlip - 0.15) / 0.85);
      const whineFreq = 780 + rpmRatio * 1150;
      if (this.whineOsc) {
        this.whineOsc.frequency.setTargetAtTime(whineFreq, now, 0.05);
      }
      if (this.whineFilter) {
        this.whineFilter.frequency.setTargetAtTime(whineFreq * 1.1, now, 0.05);
      }
      this.whineGain.gain.setTargetAtTime(slipAmount * 0.11, now, 0.05);
    } else {
      this.whineGain.gain.setTargetAtTime(0, now, 0.05);
    }
  }

  playEvent(ev: SimEvent): void {
    if (
      this.disposed ||
      this.paused ||
      this.ctx?.state !== "running" ||
      this.muted ||
      !this.sfxBus
    ) {
      return;
    }

    const now = this.ctx.currentTime;

    switch (ev.type) {
      case "detonation":
        this.triggerDetonationPing();
        break;
      case "kickstart":
        this.playKickstart(now, ev.started, ev.compressionFeel);
        break;
      case "seize-warning":
        this.playToneSweep(now, 1450, 1180, 0.12, "triangle", 0.14);
        break;
      case "seize-start":
        this.playSeizeScreech(now);
        break;
      case "seize-saved":
        this.playSeizeSaved(now);
        break;
      case "seize-crash":
        this.playSeizeCrash(now);
        break;
      case "pothole-bump":
        this.playPotholeBump(now);
        break;
      case "lane-swerve":
        this.playArcade("lane-shift");
        break;
      case "pothole-dodge":
        this.playToneSweep(now, 587.33, 783.99, 0.08, "triangle", 0.09);
        this.playToneSweep(now + 0.05, 783.99, 1046.5, 0.1, "sine", 0.08);
        break;
      case "stalled":
        this.playNoiseBurst(now, 0.22, 420, 1.4, 0.18);
        break;
      case "mission-complete":
        this.playVictoryChord(now);
        break;
      case "badge-earned":
        this.playToneSweep(now, 660, 660, 0.09, "triangle", 0.14);
        this.playToneSweep(now + 0.08, 990, 990, 0.16, "triangle", 0.14);
        break;
      case "gear-shift":
        this.playGearShift(now, ev.gear);
        break;
      case "caption":
        this.playToneSweep(now, 490, 740, 0.045, "sine", 0.022);
        break;
    }
  }

  /**
   * A2: Arcade SFX routed through unified `sfxBus` (Street Runner / HUD).
   */
  playArcade(kind: ArcadeSfxKind, opts?: ArcadeSfxOpts): void {
    if (
      this.disposed ||
      this.paused ||
      this.ctx?.state !== "running" ||
      this.muted ||
      !this.sfxBus
    ) {
      return;
    }

    const now = this.ctx.currentTime;

    switch (kind) {
      case "pickup": {
        const step = Math.max(0, Math.min(12, Math.floor(opts?.comboStep ?? 0)));
        const mult = Math.pow(2, step / 12);
        this.playToneSweep(now, 587.33 * mult, 880 * mult, 0.075, "triangle", 0.14);
        this.playToneSweep(now + 0.055, 880 * mult, 1174.66 * mult, 0.09, "sine", 0.11);
        break;
      }
      case "wheelie": {
        const strong = opts?.strong !== false;
        if (strong) {
          this.playToneSweep(now, 240, 590, 0.14, "sawtooth", 0.13);
          this.playToneSweep(now + 0.02, 360, 720, 0.12, "triangle", 0.1);
        } else {
          this.playToneSweep(now, 145, 235, 0.15, "triangle", 0.13);
          this.playNoiseBurst(now, 0.1, 320, 1.4, 0.09);
        }
        break;
      }
      case "wheelie-clear":
        this.playToneSweep(now, 523.25, 523.25, 0.09, "triangle", 0.14);
        this.playToneSweep(now + 0.07, 783.99, 783.99, 0.15, "triangle", 0.15);
        break;
      case "close-call":
        this.playNoiseSweep(now, 0.17, 1650, 310, 2.8, 0.18);
        this.playToneSweep(now, 740, 320, 0.14, "sine", 0.07);
        break;
      case "shop-arch": {
        const fanfare = [523.25, 659.25, 1046.5];
        fanfare.forEach((freq, i) => {
          this.playToneSweep(now + i * 0.07, freq, freq, 0.16, "triangle", 0.14);
        });
        break;
      }
      case "hit":
        this.playToneSweep(now, 155, 42, 0.18, "sine", 0.34);
        this.playNoiseBurst(now, 0.22, 720, 0.9, 0.28);
        break;
      case "car-horn":
        this.playDualToneHorn(now, 420, 520, 0.17, 0.13);
        break;
      case "dog-bark":
        this.playDogBarkPulse(now);
        this.playDogBarkPulse(now + 0.12);
        break;
      case "lane-shift":
        this.playNoiseSweep(now, 0.065, 920, 480, 1.8, 0.07);
        this.playToneSweep(now, 310, 210, 0.04, "triangle", 0.055);
        break;
      case "zone-change": {
        const chord = [392.0, 493.88, 587.33, 783.99];
        chord.forEach((freq, idx) => {
          this.playToneSweep(
            now + idx * 0.025,
            freq,
            freq * 1.005,
            0.34,
            idx % 2 === 0 ? "sine" : "triangle",
            0.065,
          );
        });
        break;
      }
    }
  }

  /**
   * A7: Garage workbench & diagnostic tool foley routed through unified `sfxBus`.
   */
  playGarage(kind: GarageSfxKind, opts?: GarageSfxOpts): void {
    if (
      this.disposed ||
      this.paused ||
      this.ctx?.state !== "running" ||
      this.muted ||
      !this.sfxBus
    ) {
      return;
    }

    const now = this.ctx.currentTime;

    switch (kind) {
      case "install":
        // Crisp double ratchet-wrench clicks
        this.playNoiseBurst(now, 0.03, 2800, 3.8, 0.16);
        this.playToneSweep(now, 1850, 1250, 0.032, "triangle", 0.12);
        this.playNoiseBurst(now + 0.08, 0.03, 3100, 4.0, 0.18);
        this.playToneSweep(now + 0.08, 2200, 1480, 0.036, "triangle", 0.13);
        break;
      case "plug-pull":
        // Metallic squeak + hollow cork pop
        this.playNoiseSweep(now, 0.075, 1950, 2500, 5.2, 0.09);
        this.playToneSweep(now + 0.075, 145, 340, 0.065, "sine", 0.22);
        this.playNoiseBurst(now + 0.08, 0.04, 620, 1.5, 0.11);
        break;
      case "carb-spray":
        // Pressurized aerosol hiss burst
        this.playNoiseBurst(now, 0.28, 3400, 1.4, 0.17);
        break;
      case "compression-kick":
        // 3 rhythmic puff/gauge ticks
        for (let i = 0; i < 3; i++) {
          const t = now + i * 0.12;
          this.playToneSweep(t, 135, 68, 0.08, "sine", 0.2);
          this.playNoiseBurst(t + 0.01, 0.06, 520, 1.3, 0.12);
          this.playToneSweep(t + 0.02, 1650, 1350, 0.02, "triangle", 0.07);
        }
        break;
      case "spark-snap": {
        const quality = opts?.sparkQuality ?? "fat-blue";
        if (quality === "fat-blue") {
          this.playNoiseBurst(now, 0.038, 3900, 2.4, 0.25);
          this.playToneSweep(now, 2650, 920, 0.032, "triangle", 0.18);
        } else if (quality === "weak-orange") {
          this.playNoiseBurst(now, 0.026, 1550, 2.0, 0.09);
          this.playToneSweep(now, 1350, 680, 0.024, "triangle", 0.09);
        } else {
          this.playToneSweep(now, 460, 260, 0.022, "triangle", 0.065);
        }
        break;
      }
      case "jet-click":
        this.playToneSweep(now, 2400, 1420, 0.018, "triangle", 0.11);
        this.playNoiseBurst(now, 0.016, 3200, 3.5, 0.08);
        break;
      case "switch-flip":
        this.playToneSweep(now, 960, 410, 0.026, "triangle", 0.14);
        this.playNoiseBurst(now, 0.02, 1950, 2.8, 0.1);
        break;
    }
  }

  destroy(): void {
    this.disposed = true;
    this.paused = true;
    if (this.schedulerTimer !== null && typeof window !== "undefined") {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    try {
      this.windSource?.stop();
    } catch {
      /* already stopped */
    }
    try {
      this.windSource?.disconnect();
      this.windFilter?.disconnect();
      this.windGain?.disconnect();
    } catch {
      /* already disconnected */
    }
    try {
      this.whineOsc?.stop();
    } catch {
      /* already stopped */
    }
    try {
      this.whineOsc?.disconnect();
      this.whineFilter?.disconnect();
      this.whineGain?.disconnect();
    } catch {
      /* already disconnected */
    }
    try {
      this.intakeSource?.stop();
    } catch {
      /* already stopped */
    }
    try {
      this.intakeSource?.disconnect();
      this.intakeFilter?.disconnect();
      this.intakeGain?.disconnect();
    } catch {
      /* already disconnected */
    }
    try {
      this.cvtOsc?.stop();
    } catch {
      /* already stopped */
    }
    try {
      this.cvtOsc?.disconnect();
      this.cvtFilter?.disconnect();
      this.cvtGain?.disconnect();
    } catch {
      /* already disconnected */
    }
    if (this.ctx) {
      void this.ctx.close().catch(() => {
        /* ignore */
      });
      this.ctx = null;
    }
    this.popBuffers = [];
    this.knockBuffer = null;
    this.noiseBuffer = null;
    this.masterGain = null;
    this.exhaustFilter = null;
    this.exhaustBus = null;
    this.leanFilter = null;
    this.leanBus = null;
    this.knockBus = null;
    this.sfxBus = null;
    this.windSource = null;
    this.windFilter = null;
    this.windGain = null;
    this.whineOsc = null;
    this.whineFilter = null;
    this.whineGain = null;
    this.intakeSource = null;
    this.intakeFilter = null;
    this.intakeGain = null;
    this.cvtOsc = null;
    this.cvtFilter = null;
    this.cvtGain = null;
  }

  private ensureContext(): AudioContext | null {
    if (this.disposed || typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;

      try {
        const ctx = new AudioCtx();
        const master = ctx.createGain();
        master.gain.value = this.muted ? 0 : MASTER_GAIN_LEVEL;
        master.connect(ctx.destination);

        // Soft clipper / compressor for punch without digital clipping
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -14;
        compressor.knee.value = 12;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.12;
        compressor.connect(master);

        const exhaustFilter = ctx.createBiquadFilter();
        exhaustFilter.type = "lowpass";
        exhaustFilter.frequency.value = 650;
        exhaustFilter.Q.value = 1.8;

        const exhaustBus = ctx.createGain();
        exhaustBus.gain.value = 1.0;
        exhaustFilter.connect(exhaustBus);
        exhaustBus.connect(compressor);

        const leanFilter = ctx.createBiquadFilter();
        leanFilter.type = "highpass";
        leanFilter.frequency.value = 1650;
        leanFilter.Q.value = 2.1;

        const leanBus = ctx.createGain();
        leanBus.gain.value = 0;
        leanFilter.connect(leanBus);
        leanBus.connect(compressor);

        const knockBus = ctx.createGain();
        knockBus.gain.value = 0;
        knockBus.connect(compressor);

        const sfxBus = ctx.createGain();
        sfxBus.gain.value = 1.0;
        sfxBus.connect(compressor);

        this.ctx = ctx;
        this.masterGain = master;
        this.exhaustFilter = exhaustFilter;
        this.exhaustBus = exhaustBus;
        this.leanFilter = leanFilter;
        this.leanBus = leanBus;
        this.knockBus = knockBus;
        this.sfxBus = sfxBus;

        this.buildBuffers(ctx);
        this.startContinuousBeds(ctx, compressor);
        this.startScheduler(ctx);
      } catch {
        return null;
      }
    }
    return this.ctx;
  }

  private buildBuffers(ctx: AudioContext): void {
    // 4 subtle variations of a 2-stroke pop impulse (~26ms each)
    const sampleRate = ctx.sampleRate;
    const popLength = Math.floor(sampleRate * 0.026);
    const popFadeIn = Math.min(16, Math.floor(popLength * 0.08));
    const popFadeOut = Math.min(64, Math.floor(popLength * 0.2));
    this.popBuffers = [];

    for (let v = 0; v < 4; v++) {
      const buf = ctx.createBuffer(1, popLength, sampleRate);
      const data = buf.getChannelData(0);
      const freqBase = 165 + v * 14;
      for (let i = 0; i < popLength; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 175) * (1 - Math.exp(-t * 1800));
        const thump = Math.sin(2 * Math.PI * freqBase * t) * 0.65;
        const harmonic = Math.sin(2 * Math.PI * (freqBase * 2.4) * t) * 0.35;
        const barkNoise = (Math.random() * 2 - 1) * Math.exp(-t * 240) * 0.55;
        let sample = Math.tanh((thump + harmonic + barkNoise) * env * 1.8);
        if (i < popFadeIn) {
          sample *= i / popFadeIn;
        }
        const rem = popLength - 1 - i;
        if (rem < popFadeOut) {
          sample *= rem / popFadeOut;
        }
        data[i] = sample;
      }
      this.popBuffers.push(buf);
    }

    // Crisp mechanical knock impulse (~15ms) for piston knock & Listen Mode
    const knockLen = Math.floor(sampleRate * 0.015);
    const knockFadeIn = Math.min(12, Math.floor(knockLen * 0.08));
    const knockFadeOut = Math.min(48, Math.floor(knockLen * 0.2));
    const knockBuf = ctx.createBuffer(1, knockLen, sampleRate);
    const kData = knockBuf.getChannelData(0);
    for (let i = 0; i < knockLen; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 320);
      const ping = Math.sin(2 * Math.PI * 1950 * t) * 0.6;
      const tap = Math.sin(2 * Math.PI * 760 * t) * 0.5;
      let sample = (ping + tap + (Math.random() * 2 - 1) * 0.25) * env;
      if (i < knockFadeIn) {
        sample *= i / knockFadeIn;
      }
      const rem = knockLen - 1 - i;
      if (rem < knockFadeOut) {
        sample *= rem / knockFadeOut;
      }
      kData[i] = sample;
    }
    this.knockBuffer = knockBuf;

    // 1.5s reusable white/pink noise loop with seamless crossfade at loop seam
    const noiseLen = Math.floor(sampleRate * 1.5);
    const noiseFadeLen = Math.min(
      Math.floor(sampleRate * 0.04),
      Math.floor(noiseLen / 4),
    );
    const noiseBuf = ctx.createBuffer(1, noiseLen, sampleRate);
    const nData = noiseBuf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    const nextPink = () => {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.95 * b2 + white * 0.048;
      return Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.18) * 1.4));
    };
    for (let i = 0; i < noiseLen; i++) {
      nData[i] = nextPink();
    }
    for (let i = 0; i < noiseFadeLen; i++) {
      const alpha = i / noiseFadeLen;
      const tailSample = nextPink();
      nData[i] = tailSample * (1 - alpha) + nData[i]! * alpha;
    }
    this.noiseBuffer = noiseBuf;
  }

  private startContinuousBeds(
    ctx: AudioContext,
    destination: AudioNode,
  ): void {
    if (this.noiseBuffer) {
      const windSrc = ctx.createBufferSource();
      windSrc.buffer = this.noiseBuffer;
      windSrc.loop = true;

      const windFilter = ctx.createBiquadFilter();
      windFilter.type = "bandpass";
      windFilter.frequency.value = 420;
      windFilter.Q.value = 0.7;

      const windGain = ctx.createGain();
      windGain.gain.value = 0;

      windSrc.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(destination);
      windSrc.start();

      this.windSource = windSrc;
      this.windFilter = windFilter;
      this.windGain = windGain;

      // A3: Continuous ~400Hz intake honk noise bed
      const intakeSrc = ctx.createBufferSource();
      intakeSrc.buffer = this.noiseBuffer;
      intakeSrc.loop = true;

      const intakeFilter = ctx.createBiquadFilter();
      intakeFilter.type = "bandpass";
      intakeFilter.frequency.value = 400;
      intakeFilter.Q.value = 2.6;

      const intakeGain = ctx.createGain();
      intakeGain.gain.value = 0;

      intakeSrc.connect(intakeFilter);
      intakeFilter.connect(intakeGain);
      intakeGain.connect(destination);
      intakeSrc.start();

      this.intakeSource = intakeSrc;
      this.intakeFilter = intakeFilter;
      this.intakeGain = intakeGain;
    }

    const whineOsc = ctx.createOscillator();
    whineOsc.type = "sawtooth";
    whineOsc.frequency.value = 950;

    const whineFilter = ctx.createBiquadFilter();
    whineFilter.type = "bandpass";
    whineFilter.frequency.value = 1100;
    whineFilter.Q.value = 3.5;

    const whineGain = ctx.createGain();
    whineGain.gain.value = 0;

    whineOsc.connect(whineFilter);
    whineFilter.connect(whineGain);
    whineGain.connect(destination);
    whineOsc.start();

    this.whineOsc = whineOsc;
    this.whineFilter = whineFilter;
    this.whineGain = whineGain;

    // A5: Subtle CVT belt hum bed (Honda Hobbit / Derbi Variant)
    const cvtOsc = ctx.createOscillator();
    cvtOsc.type = "triangle";
    cvtOsc.frequency.value = 180;

    const cvtFilter = ctx.createBiquadFilter();
    cvtFilter.type = "bandpass";
    cvtFilter.frequency.value = 220;
    cvtFilter.Q.value = 2.2;

    const cvtGain = ctx.createGain();
    cvtGain.gain.value = 0;

    cvtOsc.connect(cvtFilter);
    cvtFilter.connect(cvtGain);
    cvtGain.connect(destination);
    cvtOsc.start();

    this.cvtOsc = cvtOsc;
    this.cvtFilter = cvtFilter;
    this.cvtGain = cvtGain;
  }

  private startScheduler(ctx: AudioContext): void {
    if (typeof window === "undefined") return;
    this.nextPulseTime = ctx.currentTime + 0.03;

    this.schedulerTimer = window.setInterval(() => {
      if (this.disposed || !this.ctx) return;
      if (this.paused || this.ctx.state !== "running" || this.muted) {
        this.nextPulseTime = 0;
        return;
      }
      this.scheduleLookahead(this.ctx);
    }, SCHEDULER_INTERVAL_MS);
  }

  private scheduleLookahead(ctx: AudioContext): void {
    const snap = this.latestSnapshot;
    if (!snap?.active) {
      this.nextPulseTime = ctx.currentTime + 0.03;
      return;
    }

    // A8: Hot cylinder cooldown metallic tick-tick pings + faint steam hiss
    if (snap.seizeCooldownHot && !snap.engineRunning) {
      if (ctx.currentTime >= this.nextCooldownTickTime) {
        this.scheduleCooldownTick(ctx.currentTime + 0.01);
        this.nextCooldownTickTime =
          ctx.currentTime + 0.36 + Math.random() * 0.55;
      }
      this.nextPulseTime = ctx.currentTime + 0.03;
      return;
    }

    if (
      this.paused ||
      !snap.engineRunning ||
      snap.stalled ||
      snap.seizedHard ||
      snap.rpm < 250
    ) {
      this.nextPulseTime = ctx.currentTime + 0.03;
      return;
    }

    // Catch up cleanly if tab was backgrounded
    if (this.nextPulseTime < ctx.currentTime - 0.08) {
      this.nextPulseTime = ctx.currentTime + 0.02;
    }
    this.nextPulseTime = Math.max(this.nextPulseTime, ctx.currentTime + 0.005);

    const firingHz = Math.max(12, Math.min(185, snap.rpm / 60));
    const basePeriod = 1 / firingHz;
    const horizon = ctx.currentTime + LOOKAHEAD_SEC;

    while (this.nextPulseTime < horizon) {
      this.scheduleSinglePulse(ctx, snap, this.nextPulseTime);

      // A3: Sparse bright overrun "ring-ding" pops on sharp throttle chop
      if (
        this.nextPulseTime < this.overrunUntilTime &&
        snap.throttle < 0.2 &&
        this.nextPulseTime >= this.nextOverrunPopTime
      ) {
        this.scheduleOverrunPop(snap, this.nextPulseTime);
        this.nextOverrunPopTime =
          this.nextPulseTime + 0.065 + Math.random() * 0.055;
      }

      const jitterPct =
        snap.misfirePattern === "none"
          ? 0.03
          : 0.08 + snap.misfireRate * 0.08;
      const jitter = 1 + (Math.random() * 2 - 1) * jitterPct;
      this.nextPulseTime += Math.max(0.0045, basePeriod * jitter);
    }
  }

  private scheduleSinglePulse(
    ctx: AudioContext,
    snap: RideTelemetrySnapshot,
    time: number,
  ): void {
    this.pulseIndex += 1;
    const shouldFire = this.shouldPulseFire(snap, this.pulseIndex);

    // Mechanical piston knock still ticks on compression even if spark drops
    if (
      this.knockBuffer &&
      this.knockBus &&
      (snap.pistonKnock > 0.12 || (snap.listenMode && snap.hasStethoscope))
    ) {
      const kSrc = ctx.createBufferSource();
      kSrc.buffer = this.knockBuffer;
      kSrc.playbackRate.value = 0.92 + Math.random() * 0.16;
      const kGain = ctx.createGain();
      kGain.gain.setValueAtTime(0.32, time);
      kSrc.connect(kGain);
      kGain.connect(this.knockBus);
      kSrc.onended = () => {
        kSrc.disconnect();
        kGain.disconnect();
      };
      kSrc.start(time);
    }

    if (!shouldFire || this.popBuffers.length === 0 || !this.exhaustFilter) {
      return;
    }

    const buf =
      this.popBuffers[this.pulseIndex % this.popBuffers.length] ??
      this.popBuffers[0]!;
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const rpmPitch = 0.86 + Math.min(0.45, (snap.rpm / 9500) * 0.42);
    const pipePitch = snap.exhaustVisual !== "stock" ? 1.08 : 0.96;
    const makePitch =
      snap.bikeMake === "tomos-a35"
        ? 1.12
        : snap.bikeMake === "puch-maxi"
          ? 0.92
          : 1.0;
    src.playbackRate.value =
      rpmPitch * pipePitch * makePitch * (0.97 + Math.random() * 0.06);

    const amp =
      (0.38 + snap.throttle * 0.48) *
      (snap.powerbandActive ? 1.22 : 1.0) *
      (snap.exhaustVisual === "race" ? 1.15 : 1.0);

    const pulseGain = ctx.createGain();
    pulseGain.gain.setValueAtTime(Math.min(1.1, amp), time);

    src.connect(pulseGain);
    pulseGain.connect(this.exhaustFilter);
    if (this.leanFilter && snap.leanTone > 0.2) {
      pulseGain.connect(this.leanFilter);
    }

    src.onended = () => {
      src.disconnect();
      pulseGain.disconnect();
    };
    src.start(time);
  }

  private shouldPulseFire(snap: RideTelemetrySnapshot, idx: number): boolean {
    switch (snap.misfirePattern) {
      case "dead":
        return Math.random() < 0.06;
      case "alternate": {
        // Rich four-stroking: unmistakable blub-blub-blub alternating drop
        if (snap.misfireRate >= 0.32) {
          return idx % 2 === 0;
        }
        return idx % 2 === 0 || Math.random() > snap.misfireRate * 1.8;
      }
      case "random": {
        const dropChance = Math.min(0.82, Math.max(0.18, snap.misfireRate));
        return Math.random() > dropChance;
      }
      case "high-rpm": {
        if (snap.rpm < 4500) return true;
        const rpmFactor = Math.min(1, (snap.rpm - 4500) / 4200);
        const dropChance =
          rpmFactor * Math.min(0.82, Math.max(0.35, snap.misfireRate));
        return Math.random() > dropChance;
      }
      case "none":
      default:
        return true;
    }
  }

  private triggerDetonationPing(): void {
    if (
      this.disposed ||
      this.paused ||
      this.ctx?.state !== "running" ||
      this.muted ||
      !this.sfxBus
    ) {
      return;
    }
    const nowMs =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    if (nowMs - this.lastDetonationAtMs < 75) return;
    this.lastDetonationAtMs = nowMs;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    const pingFreq = 4500 + Math.random() * 1300;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(pingFreq, t);
    osc.frequency.exponentialRampToValueAtTime(pingFreq * 0.88, t + 0.042);

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = pingFreq;
    bp.Q.value = 6.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.32, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.048);

    osc.connect(bp);
    bp.connect(gain);
    gain.connect(this.sfxBus);
    osc.onended = () => {
      osc.disconnect();
      bp.disconnect();
      gain.disconnect();
    };
    osc.start(t);
    osc.stop(t + 0.055);
  }

  private playKickstart(
    now: number,
    started: boolean,
    compressionFeel: "strong" | "weak",
  ): void {
    // A4: Kickstart lever ratchet + compression chuff/whoosh
    for (let i = 0; i < 3; i++) {
      this.playToneSweep(
        now + i * 0.024,
        1750 - i * 160,
        1080 - i * 90,
        0.022,
        "triangle",
        0.095,
      );
    }

    if (compressionFeel === "strong") {
      // Heavy piston compression chuff + thump
      this.playToneSweep(now + 0.02, 145, 60, 0.14, "sine", 0.34);
      this.playNoiseBurst(now + 0.03, 0.13, 390, 1.2, 0.24);
    } else {
      // Weak airy fast spin
      this.playToneSweep(now + 0.02, 220, 155, 0.09, "triangle", 0.14);
      this.playNoiseBurst(now + 0.02, 0.13, 980, 0.9, 0.19);
    }

    if (started) {
      // A4: 2-3 pulse stumbling catch + brief rev flare before smooth idle
      const catchOffsets = [0.11, 0.2, 0.28];
      catchOffsets.forEach((offset, idx) => {
        const t = now + offset;
        if (this.popBuffers.length > 0 && this.exhaustFilter) {
          this.playExhaustPopAt(
            t,
            0.78 + idx * 0.14,
            0.55 + idx * 0.15,
          );
        } else {
          this.playToneSweep(
            t,
            135 + idx * 35,
            95 + idx * 25,
            0.055,
            "sawtooth",
            0.14,
          );
        }
      });

      // Brief rev flare up then settle down to idle
      this.playToneSweep(now + 0.29, 190, 480, 0.13, "sawtooth", 0.17);
      this.playToneSweep(now + 0.42, 480, 230, 0.16, "sawtooth", 0.12);
      this.playNoiseBurst(now + 0.3, 0.18, 920, 1.8, 0.16);
    }
  }

  private playSeizeScreech(now: number): void {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = "sawtooth";
    osc2.type = "square";

    osc1.frequency.setValueAtTime(2450, now);
    osc1.frequency.exponentialRampToValueAtTime(860, now + 0.42);
    osc2.frequency.setValueAtTime(2580, now);
    osc2.frequency.exponentialRampToValueAtTime(910, now + 0.42);

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(2100, now);
    bp.frequency.exponentialRampToValueAtTime(950, now + 0.42);
    bp.Q.value = 5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.38, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.46);

    osc1.connect(bp);
    osc2.connect(bp);
    bp.connect(gain);
    gain.connect(this.sfxBus);

    let remaining = 2;
    const handleOscEnd = (osc: OscillatorNode) => {
      osc.disconnect();
      remaining -= 1;
      if (remaining === 0) {
        bp.disconnect();
        gain.disconnect();
      }
    };
    osc1.onended = () => handleOscEnd(osc1);
    osc2.onended = () => handleOscEnd(osc2);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.48);
    osc2.stop(now + 0.48);
  }

  private playSeizeSaved(now: number): void {
    this.playNoiseBurst(now, 0.26, 780, 1.1, 0.24);
    this.playToneSweep(now, 520, 220, 0.18, "triangle", 0.22);
    this.playToneSweep(now + 0.12, 523.25, 783.99, 0.22, "triangle", 0.18);
  }

  private playSeizeCrash(now: number): void {
    this.playNoiseBurst(now, 0.45, 1100, 0.8, 0.38);
    this.playToneSweep(now + 0.08, 170, 38, 0.36, "sawtooth", 0.35);
  }

  private playPotholeBump(now: number): void {
    this.playToneSweep(now, 135, 42, 0.14, "sine", 0.36);
    this.playNoiseBurst(now, 0.08, 320, 1.0, 0.2);
  }

  private playVictoryChord(now: number): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const start = now + i * 0.075;
      this.playToneSweep(start, freq, freq, 0.38, "triangle", 0.2);
    });
  }

  private playToneSweep(
    start: number,
    startFreq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    peakGain: number,
  ): void {
    if (!this.ctx || !this.sfxBus) return;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, start);
    if (startFreq !== endFreq) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, endFreq),
        start + duration,
      );
    }
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(peakGain, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0008, start + duration);

    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private playNoiseBurst(
    start: number,
    duration: number,
    centerFreq: number,
    q: number,
    peakGain: number,
  ): void {
    if (!this.ctx || !this.sfxBus || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = centerFreq;
    filter.Q.value = q;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(peakGain, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0008, start + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    src.start(start);
    src.stop(start + duration + 0.02);
  }

  private playNoiseSweep(
    start: number,
    duration: number,
    startFreq: number,
    endFreq: number,
    q: number,
    peakGain: number,
  ): void {
    if (!this.ctx || !this.sfxBus || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(startFreq, start);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(40, endFreq),
      start + duration,
    );
    filter.Q.value = q;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(peakGain, start + Math.min(0.02, duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0008, start + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    src.start(start);
    src.stop(start + duration + 0.02);
  }

  private playDualToneHorn(
    start: number,
    freqA: number,
    freqB: number,
    duration: number,
    peakGain: number,
  ): void {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;

    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    oscA.type = "sawtooth";
    oscB.type = "sawtooth";
    oscA.frequency.setValueAtTime(freqA, start);
    oscB.frequency.setValueAtTime(freqB, start);

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1550;
    lp.Q.value = 1.6;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(peakGain, start + 0.012);
    gain.gain.setValueAtTime(peakGain * 0.9, start + duration * 0.72);
    gain.gain.exponentialRampToValueAtTime(0.0008, start + duration);

    oscA.connect(lp);
    oscB.connect(lp);
    lp.connect(gain);
    gain.connect(this.sfxBus);

    let remaining = 2;
    const handleEnd = (osc: OscillatorNode) => {
      osc.disconnect();
      remaining -= 1;
      if (remaining === 0) {
        lp.disconnect();
        gain.disconnect();
      }
    };
    oscA.onended = () => handleEnd(oscA);
    oscB.onended = () => handleEnd(oscB);

    oscA.start(start);
    oscB.start(start);
    oscA.stop(start + duration + 0.02);
    oscB.stop(start + duration + 0.02);
  }

  private playDogBarkPulse(start: number): void {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    const dur = 0.078;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(240, start);
    osc.frequency.exponentialRampToValueAtTime(470, start + 0.022);
    osc.frequency.exponentialRampToValueAtTime(185, start + dur);

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(680, start);
    bp.Q.value = 2.1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(0.19, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0008, start + dur);

    osc.connect(bp);
    bp.connect(gain);
    gain.connect(this.sfxBus);
    osc.onended = () => {
      osc.disconnect();
      bp.disconnect();
      gain.disconnect();
    };
    osc.start(start);
    osc.stop(start + dur + 0.02);

    this.playNoiseBurst(start + 0.005, 0.06, 760, 1.5, 0.11);
  }

  private playGearShift(now: number, gear: 1 | 2): void {
    const pitchMult = gear === 2 ? 1.15 : 0.92;
    this.playToneSweep(now, 195 * pitchMult, 75 * pitchMult, 0.06, "triangle", 0.24);
    this.playToneSweep(now + 0.012, 1450 * pitchMult, 680 * pitchMult, 0.032, "triangle", 0.15);
    this.playNoiseBurst(now, 0.048, 540 * pitchMult, 1.6, 0.13);
  }

  private playPowerbandComeOnSweep(now: number): void {
    if (!this.ctx || !this.exhaustBus || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(480, now);
    bp.frequency.exponentialRampToValueAtTime(1450, now + 0.22);
    bp.Q.value = 5.0;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.24);

    src.connect(bp);
    bp.connect(gain);
    gain.connect(this.exhaustBus);
    src.onended = () => {
      src.disconnect();
      bp.disconnect();
      gain.disconnect();
    };
    src.start(now);
    src.stop(now + 0.26);
  }

  private playExhaustPopAt(
    time: number,
    playbackRate: number,
    gainLevel: number,
  ): void {
    if (!this.ctx || !this.exhaustFilter || this.popBuffers.length === 0) return;
    const buf =
      this.popBuffers[Math.floor(Math.random() * this.popBuffers.length)] ??
      this.popBuffers[0]!;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = playbackRate;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainLevel, time);

    src.connect(gain);
    gain.connect(this.exhaustFilter);
    src.onended = () => {
      src.disconnect();
      gain.disconnect();
    };
    src.start(time);
  }

  private scheduleOverrunPop(
    snap: RideTelemetrySnapshot,
    time: number,
  ): void {
    if (!this.ctx || !this.exhaustFilter || this.popBuffers.length === 0) return;
    const buf =
      this.popBuffers[(this.pulseIndex + 1) % this.popBuffers.length] ??
      this.popBuffers[0]!;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const makePitch =
      snap.bikeMake === "tomos-a35"
        ? 1.12
        : snap.bikeMake === "puch-maxi"
          ? 0.92
          : 1.0;
    src.playbackRate.value =
      (1.24 + Math.random() * 0.28) * makePitch;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.42 + Math.random() * 0.16, time);

    src.connect(gain);
    gain.connect(this.exhaustFilter);
    if (this.leanFilter) {
      gain.connect(this.leanFilter);
    }
    src.onended = () => {
      src.disconnect();
      gain.disconnect();
    };
    src.start(time);
  }

  private scheduleCooldownTick(time: number): void {
    if (!this.sfxBus) return;
    this.cooldownTickCount += 1;
    const freq = 2600 + Math.random() * 1100;
    this.playToneSweep(time, freq, freq * 0.86, 0.028, "sine", 0.042);

    // Occasional double tick-tick ping
    if (this.cooldownTickCount % 2 === 0) {
      this.playToneSweep(time + 0.085, freq * 1.08, freq * 0.92, 0.025, "sine", 0.032);
    }
    // Faint steam hiss every few ticks
    if (this.cooldownTickCount % 3 === 0) {
      this.playNoiseBurst(time + 0.03, 0.2, 3600, 1.3, 0.022);
    }
  }
}
