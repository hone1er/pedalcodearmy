// Seeded PRNG for Ran When Parked. Deterministic so rides & fault rolls are
// reproducible from a save seed (and testable headlessly in Node).

/** A seeded random source returning floats in [0, 1). */
export type Rng = () => number;

/** Classic mulberry32 — tiny, fast, good-enough distribution for game logic. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Float in [0, 1). */
export function nextFloat(rng: Rng): number {
  return rng();
}

/** Float in [min, max). */
export function nextRange(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng();
}

/** Integer in [min, max] (inclusive). */
export function nextInt(rng: Rng, min: number, max: number): number {
  return Math.floor(nextRange(rng, min, max + 1));
}

/** True with probability p. */
export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}

/** Pick a random element (throws on empty arrays — callers guard). */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error("pick() on empty array");
  const idx = Math.min(items.length - 1, Math.floor(rng() * items.length));
  return items[idx] as T;
}

/** Weighted pick; weights <= 0 are skipped. Returns undefined if all zero. */
export function pickWeighted<T>(
  rng: Rng,
  entries: readonly { item: T; weight: number }[],
): T | undefined {
  const total = entries.reduce((s, e) => s + Math.max(0, e.weight), 0);
  if (total <= 0) return undefined;
  let roll = rng() * total;
  for (const e of entries) {
    const w = Math.max(0, e.weight);
    if (roll < w) return e.item;
    roll -= w;
  }
  return entries[entries.length - 1]?.item;
}

/** Derive a fresh 32-bit seed from an existing rng (for sub-streams). */
export function deriveSeed(rng: Rng): number {
  return Math.floor(rng() * 0xffffffff) >>> 0;
}
