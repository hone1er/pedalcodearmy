/**
 * Dependency-free, in-memory sliding-window rate limiter.
 *
 * NOTE: State lives in module memory, so limits are enforced per server instance
 * (per serverless lambda / edge isolate). That is good enough to blunt casual abuse
 * and scripted spam; use a shared store (e.g. Redis/KV) for strict global limits.
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export type RateLimitOptions = {
  /** Maximum number of requests permitted inside the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

/** Timestamps (ms) of accepted requests per key, oldest first. */
const buckets = new Map<string, number[]>();

/** How often expired buckets are swept (lazily, on calls). */
const CLEANUP_INTERVAL_MS = 60_000;
/**
 * Hard cap on tracked keys so a flood of distinct (e.g. spoofed) client IPs
 * cannot grow memory without bound.
 */
const MAX_BUCKETS = 10_000;
/** Longest window seen so far; buckets idle longer than this are always expired. */
let maxWindowMs = 0;
let lastCleanup = Date.now();

function pruneTimestamps(timestamps: number[], cutoff: number): number[] {
  // Timestamps are pushed in order, so find the first one still inside the window.
  let firstValid = 0;
  while (firstValid < timestamps.length && timestamps[firstValid]! <= cutoff) {
    firstValid++;
  }
  return firstValid === 0 ? timestamps : timestamps.slice(firstValid);
}

function sweepExpired(now: number): void {
  lastCleanup = now;
  const cutoff = now - maxWindowMs;
  for (const [key, timestamps] of buckets) {
    const newest = timestamps[timestamps.length - 1];
    if (newest === undefined || newest <= cutoff) {
      buckets.delete(key);
    }
  }
}

function cleanupExpired(now: number): void {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  sweepExpired(now);
}

/**
 * Make room for a new key when at capacity: sweep expired buckets first, then
 * evict the least-recently-inserted keys (Map preserves insertion order).
 */
function ensureCapacity(now: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  sweepExpired(now);
  if (buckets.size < MAX_BUCKETS) return;
  const excess = buckets.size - MAX_BUCKETS + 1;
  let evicted = 0;
  for (const key of buckets.keys()) {
    if (evicted >= excess) break;
    buckets.delete(key);
    evicted++;
  }
}

/**
 * Record a request for `key` and report whether it is allowed.
 * Namespace keys per endpoint (e.g. `orders:${ip}`) so limits don't share buckets.
 */
export function rateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  if (windowMs > maxWindowMs) maxWindowMs = windowMs;
  cleanupExpired(now);

  const cutoff = now - windowMs;
  const existing = buckets.get(key);
  if (existing === undefined) ensureCapacity(now);
  const timestamps = pruneTimestamps(existing ?? [], cutoff);

  if (timestamps.length >= limit) {
    buckets.set(key, timestamps);
    const oldest = timestamps[0] ?? now;
    const retryAfterMs = Math.max(0, oldest + windowMs - now);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  timestamps.push(now);
  buckets.set(key, timestamps);
  return {
    allowed: true,
    remaining: Math.max(0, limit - timestamps.length),
    retryAfterSeconds: 0,
  };
}

/**
 * Best-effort client IP extraction from proxy headers.
 *
 * Prefers headers set by the hosting platform (which clients cannot forge):
 * `x-vercel-forwarded-for`, then `x-real-ip`. Only then falls back to
 * `x-forwarded-for`, using its rightmost hop (appended by the nearest trusted
 * proxy) because the leftmost entries are client-controlled and spoofable.
 */
export function getClientIp(request: Request): string {
  const vercelForwardedFor = firstHop(request.headers.get("x-vercel-forwarded-for"));
  if (vercelForwardedFor) return vercelForwardedFor;

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const hops = forwardedFor
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    const rightmost = hops[hops.length - 1];
    if (rightmost) return rightmost;
  }
  return "unknown";
}

function firstHop(value: string | null): string | undefined {
  const first = value?.split(",")[0]?.trim();
  if (!first) return undefined;
  return first;
}
