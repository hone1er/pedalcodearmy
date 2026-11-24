import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const VALID_MOPEDS = ["puch-maxi", "honda-hobbit", "derbi-variant", "tomos-a35"] as const;

const SUBMIT_RATE_LIMIT = { limit: 20, windowMs: 10 * 60 * 1000 };

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// ---------------------------------------------------------------------------
// Table initialization (runs once per instance, retried on failure)
// ---------------------------------------------------------------------------

let tableInitPromise: Promise<void> | null = null;

async function createTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS runner_scores (
      id SERIAL PRIMARY KEY,
      player_name VARCHAR(30) NOT NULL,
      moped_make VARCHAR(30) NOT NULL,
      score INTEGER NOT NULL,
      distance INTEGER NOT NULL,
      parts_collected INTEGER NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_runner_scores_score ON runner_scores(score DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_runner_scores_moped ON runner_scores(moped_make)`;
}

function ensureTable(): Promise<void> {
  tableInitPromise ??= createTable().catch((error: unknown) => {
    tableInitPromise = null;
    throw error;
  });
  return tableInitPromise;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const playerNameSchema = z
  .string()
  // Strip control characters (incl. newlines/tabs) and collapse whitespace before length checks.
  .transform((value) => value.replace(/\p{Cc}/gu, "").replace(/\s+/g, " ").trim())
  .pipe(z.string().min(1).max(30));

const submitSchema = z
  .object({
    playerName: playerNameSchema,
    mopedMake: z.enum(VALID_MOPEDS),
    score: z.number().int().min(0).max(10_000_000),
    distance: z.number().int().min(0).max(1_000_000),
    partsCollected: z.number().int().min(0).max(50_000),
  })
  .refine(
    (data) => data.score <= data.distance * 30 + data.partsCollected * 600 + 10_000,
    { message: "Score is not plausible for this run", path: ["score"] },
  );

function isValidMoped(value: string): value is (typeof VALID_MOPEDS)[number] {
  return (VALID_MOPEDS as readonly string[]).includes(value);
}

type ScoreRow = {
  id: number;
  player_name: string;
  moped_make: string;
  score: number;
  distance: number;
  parts_collected: number;
  created_at: string;
};

// ---------------------------------------------------------------------------
// GET /api/game/leaderboard?moped=X&limit=20
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const url = new URL(request.url);
  const moped = url.searchParams.get("moped");

  if (moped !== null && moped !== "" && !isValidMoped(moped)) {
    return NextResponse.json({ error: "Invalid moped" }, { status: 400 });
  }

  const parsedLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit = Number.isNaN(parsedLimit)
    ? DEFAULT_LIMIT
    : Math.min(Math.max(parsedLimit, 1), MAX_LIMIT);

  try {
    await ensureTable();

    const result = moped
      ? await sql<ScoreRow>`
          SELECT id, player_name, moped_make, score, distance,
                 parts_collected, created_at
          FROM runner_scores
          WHERE moped_make = ${moped}
          ORDER BY score DESC
          LIMIT ${limit}
        `
      : await sql<ScoreRow>`
          SELECT id, player_name, moped_make, score, distance,
                 parts_collected, created_at
          FROM runner_scores
          ORDER BY score DESC
          LIMIT ${limit}
        `;

    const scores = result.rows.map((row) => ({
      id: row.id,
      playerName: row.player_name,
      mopedMake: row.moped_make,
      score: row.score,
      distance: row.distance,
      partsCollected: row.parts_collected,
      createdAt: row.created_at,
    }));

    return NextResponse.json({ scores });
  } catch (error) {
    console.error("Leaderboard GET error:", error);
    return NextResponse.json({ scores: [] });
  }
}

// ---------------------------------------------------------------------------
// POST /api/game/leaderboard
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 415 },
    );
  }

  const limitResult = rateLimit(`leaderboard:${getClientIp(request)}`, SUBMIT_RATE_LIMIT);
  if (!limitResult.allowed) {
    return NextResponse.json(
      { error: "Too many score submissions. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limitResult.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid data",
        details: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }
  const data = parsed.data;

  try {
    await ensureTable();

    const insertResult = await sql<{ id: number }>`
      INSERT INTO runner_scores (
        player_name, moped_make, score, distance, parts_collected
      ) VALUES (
        ${data.playerName}, ${data.mopedMake}, ${data.score},
        ${data.distance}, ${data.partsCollected}
      )
      RETURNING id
    `;
    const id = insertResult.rows[0]?.id;

    const rankResult = await sql<{ rank: string | number }>`
      SELECT COUNT(*) AS rank
      FROM runner_scores
      WHERE score >= ${data.score}
    `;
    const rankValue = rankResult.rows[0]?.rank;
    const rank = Number.parseInt(String(rankValue ?? "0"), 10) || 0;

    return NextResponse.json({ id, rank });
  } catch (error) {
    console.error("Leaderboard POST error:", error);
    return NextResponse.json({ error: "Failed to submit score" }, { status: 500 });
  }
}
