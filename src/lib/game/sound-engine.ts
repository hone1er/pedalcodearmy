"use client";

export type GameSoundEvent =
  | { type: "countdown"; step: number } // 3, 2, 1, 0 (GO!)
  | { type: "lane-shift" }
  | { type: "wheelie" }
  | { type: "collect"; combo: number; rare?: boolean }
  | { type: "wheelie-clear"; combo: number }
  | { type: "close-call"; combo: number }
  | { type: "shop" }
  | { type: "hit" }
  | { type: "game-over" }
  | { type: "zone-up" };

const MUTE_STORAGE_KEY = "pca-runner-muted";

export function loadMutedPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveMutedPreference(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? "1" : "0");
  } catch {
    // Ignore storage errors in restricted browsing modes
  }
}

/**
 * Procedural Web Audio synthesizer for East Bay Runner.
 * Zero external audio assets — generates a dynamic 2-stroke moped hum + arcade SFX.
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private muted = false;
  private engineRunning = false;
  private disposed = false;

  constructor(initialMuted = false) {
    this.muted = initialMuted;
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
        master.gain.value = this.muted ? 0 : 0.35;
        master.connect(ctx.destination);
        this.ctx = ctx;
        this.masterGain = master;
      } catch {
        return null;
      }
    }
    if (this.ctx.state === "suspended" && !this.muted) {
      void this.ctx.resume().catch(() => {
        /* autoplay blocked until gesture */
      });
    }
    return this.ctx;
  }

  unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === "suspended" && !this.muted) {
      void ctx.resume().catch(() => {
        /* ignore */
      });
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    saveMutedPreference(muted);
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.35, now, 0.03);
    }
    if (!muted && this.ctx?.state === "suspended") {
      void this.ctx.resume().catch(() => {
        /* ignore */
      });
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Smoothly modulate the 2-stroke moped buzz with speed, wheelie, boost, and pause state */
  updateEngine(
    speed: number,
    active: boolean,
    isWheeling: boolean,
    isBoosted: boolean,
  ): void {
    if (this.disposed) return;

    if (!active || this.muted) {
      if (this.engineGain && this.ctx) {
        this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      }
      return;
    }

    const ctx = this.ctx;
    if (ctx?.state !== "running" || !this.masterGain) return;

    if (!this.engineRunning) {
      this.startEngineNodes(ctx);
    }

    if (
      !this.engineOsc ||
      !this.engineSubOsc ||
      !this.engineFilter ||
      !this.engineGain
    ) {
      return;
    }

    const now = ctx.currentTime;
    const speedRatio = Math.max(0, Math.min(1.5, (speed - 170) / 260));
    const baseFreq =
      58 + speedRatio * 56 + (isWheeling ? 18 : 0) + (isBoosted ? 22 : 0);
    this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.06);
    this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.06);
    this.engineFilter.frequency.setTargetAtTime(
      260 + speedRatio * 420 + (isBoosted ? 250 : 0),
      now,
      0.08,
    );
    const vol = 0.065 + (isBoosted ? 0.025 : 0) + (isWheeling ? 0.015 : 0);
    this.engineGain.gain.setTargetAtTime(vol, now, 0.08);
  }

  private startEngineNodes(ctx: AudioContext): void {
    if (!this.masterGain || this.engineRunning) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 65;

      const subOsc = ctx.createOscillator();
      subOsc.type = "triangle";
      subOsc.frequency.value = 32.5;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 300;
      filter.Q.value = 2.5;

      const gain = ctx.createGain();
      gain.gain.value = 0;

      osc.connect(filter);
      subOsc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      subOsc.start();

      this.engineOsc = osc;
      this.engineSubOsc = subOsc;
      this.engineFilter = filter;
      this.engineGain = gain;
      this.engineRunning = true;
    } catch {
      this.engineRunning = false;
    }
  }

  play(event: GameSoundEvent): void {
    if (this.muted || this.disposed) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || ctx.state !== "running") return;

    const now = ctx.currentTime;

    switch (event.type) {
      case "countdown": {
        const isGo = event.step === 0;
        this.playTone(
          ctx,
          isGo ? "square" : "triangle",
          isGo ? 784 : 392,
          isGo ? 1046.5 : 392,
          isGo ? 0.24 : 0.12,
          isGo ? 0.22 : 0.16,
          now,
        );
        break;
      }

      case "lane-shift": {
        this.playNoiseBurst(ctx, 0.06, 900, 1800, 0.1, now);
        break;
      }

      case "wheelie": {
        this.playTone(ctx, "sawtooth", 140, 320, 0.14, 0.14, now);
        this.playTone(ctx, "triangle", 280, 520, 0.12, 0.08, now + 0.02);
        break;
      }

      case "collect": {
        // Ascending pentatonic chime based on combo
        const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];
        const idx = Math.min(notes.length - 1, Math.max(0, event.combo));
        const freq = notes[idx] ?? 523.25;
        this.playTone(ctx, "triangle", freq, freq * 1.15, 0.11, 0.2, now);
        if (event.rare) {
          this.playTone(ctx, "sine", freq * 1.5, freq * 2, 0.16, 0.18, now + 0.06);
        }
        break;
      }

      case "wheelie-clear": {
        const base = 587.33 + Math.min(event.combo, 6) * 40;
        this.playTone(ctx, "triangle", base, base * 1.25, 0.1, 0.18, now);
        this.playTone(ctx, "sine", base * 1.25, base * 1.5, 0.14, 0.16, now + 0.07);
        break;
      }

      case "close-call": {
        this.playTone(ctx, "sine", 740, 1110, 0.09, 0.15, now);
        this.playNoiseBurst(ctx, 0.07, 1400, 2800, 0.08, now);
        break;
      }

      case "shop": {
        const chord = [523.25, 659.25, 783.99, 1046.5];
        chord.forEach((freq, i) => {
          this.playTone(ctx, "square", freq, freq, 0.12, 0.12, now + i * 0.065);
        });
        break;
      }

      case "zone-up": {
        this.playTone(ctx, "triangle", 440, 659.25, 0.18, 0.14, now);
        this.playTone(ctx, "triangle", 659.25, 880, 0.24, 0.14, now + 0.12);
        break;
      }

      case "hit": {
        this.playTone(ctx, "sawtooth", 150, 42, 0.22, 0.3, now);
        this.playNoiseBurst(ctx, 0.2, 600, 120, 0.26, now);
        break;
      }

      case "game-over": {
        const notes = [392, 349.23, 311.13, 261.63];
        notes.forEach((freq, i) => {
          this.playTone(ctx, "sawtooth", freq, freq * 0.96, 0.18, 0.16, now + i * 0.13);
        });
        break;
      }
    }
  }

  private playTone(
    ctx: AudioContext,
    type: OscillatorType,
    startFreq: number,
    endFreq: number,
    duration: number,
    peakGain: number,
    startTime: number,
  ): void {
    if (!this.masterGain) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, startTime);
    if (endFreq !== startFreq) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, endFreq),
        startTime + duration,
      );
    }
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  private playNoiseBurst(
    ctx: AudioContext,
    duration: number,
    startFreq: number,
    endFreq: number,
    peakGain: number,
    startTime: number,
  ): void {
    if (!this.masterGain) return;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(startFreq, startTime);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(60, endFreq),
      startTime + duration,
    );
    filter.Q.value = 1.4;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peakGain, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(startTime);
    noise.stop(startTime + duration + 0.02);
  }

  destroy(): void {
    this.disposed = true;
    try {
      this.engineOsc?.stop();
      this.engineSubOsc?.stop();
    } catch {
      /* ignore */
    }
    this.engineOsc = null;
    this.engineSubOsc = null;
    this.engineFilter = null;
    this.engineGain = null;
    this.engineRunning = false;
    if (this.ctx) {
      void this.ctx.close().catch(() => {
        /* ignore */
      });
      this.ctx = null;
    }
    this.masterGain = null;
  }
}
