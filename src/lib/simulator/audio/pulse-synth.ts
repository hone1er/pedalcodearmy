"use client";

import type { RideTelemetrySnapshot, SimEvent } from "../contract";

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

  private popBuffers: AudioBuffer[] = [];
  private knockBuffer: AudioBuffer | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private schedulerTimer: number | null = null;
  private nextPulseTime = 0;
  private pulseIndex = 0;
  private lastDetonationAtMs = 0;

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
      return;
    }

    const now = this.ctx.currentTime;

    if (this.paused || !snapshot?.active) {
      this.windGain.gain.setTargetAtTime(0, now, 0.06);
      this.whineGain.gain.setTargetAtTime(0, now, 0.05);
      return;
    }

    const listenActive = snapshot.listenMode && snapshot.hasStethoscope;
    const isRaceOrPerf = snapshot.exhaustVisual !== "stock";

    // Resonant exhaust bandpass/lowpass character
    const rpmRatio = Math.max(
      0,
      Math.min(1.15, snapshot.rpm / Math.max(1000, snapshot.maxRpm)),
    );
    const leanShift = snapshot.leanTone > 0.2 ? snapshot.leanTone * 620 : 0;

    const nextFilterType: BiquadFilterType = isRaceOrPerf ? "bandpass" : "lowpass";
    if (this.exhaustFilter.type !== nextFilterType) {
      this.exhaustFilter.type = nextFilterType;
    }

    if (isRaceOrPerf) {
      const baseFreq = snapshot.exhaustVisual === "race" ? 1180 : 1080;
      const targetFreq = Math.min(
        2800,
        baseFreq + rpmRatio * 480 + (snapshot.powerbandActive ? 260 : 0) + leanShift,
      );
      const q = snapshot.powerbandActive ? 4.2 : 2.8;
      this.exhaustFilter.frequency.setTargetAtTime(targetFreq, now, 0.04);
      this.exhaustFilter.Q.setTargetAtTime(q, now, 0.04);
    } else {
      const targetFreq = Math.min(
        2200,
        580 + rpmRatio * 360 + snapshot.throttle * 140 + leanShift,
      );
      this.exhaustFilter.frequency.setTargetAtTime(targetFreq, now, 0.04);
      this.exhaustFilter.Q.setTargetAtTime(1.9, now, 0.04);
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
      case "caption":
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
    if (
      this.paused ||
      !snap ||
      !snap.active ||
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
    src.playbackRate.value =
      rpmPitch * pipePitch * (0.97 + Math.random() * 0.06);

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
    if (compressionFeel === "strong") {
      // Heavy piston compression chuff + thump
      this.playToneSweep(now, 140, 62, 0.14, "sine", 0.34);
      this.playNoiseBurst(now + 0.02, 0.13, 380, 1.2, 0.24);
    } else {
      // Weak airy fast spin
      this.playToneSweep(now, 210, 150, 0.09, "triangle", 0.14);
      this.playNoiseBurst(now, 0.12, 950, 0.9, 0.18);
    }

    if (started) {
      this.playToneSweep(now + 0.14, 180, 320, 0.11, "sawtooth", 0.22);
      this.playNoiseBurst(now + 0.15, 0.14, 850, 1.8, 0.2);
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
}
