import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";
import { z } from "zod";

// Initialize runner_scores table
async function ensureTable() {
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

const VALID_MOPEDS = ["puch-maxi", "honda-hobbit", "derbi-variant", "tomos-a35"];

const submitSchema = z.object({
  playerName: z.string().min(1).max(30).trim(),
  mopedMake: z.string().refine((v) => VALID_MOPEDS.includes(v)),
  score: z.number().int().min(0).max(10000000),
  distance: z.number().int().min(0),
  partsCollected: z.number().int().min(0),
});

// GET /api/game/leaderboard?moped=X&limit=20
export async function GET(request: Request) {
  try {
    await ensureTable();

    const url = new URL(request.url);
    const moped = url.searchParams.get("moped");
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 100);

    let result;

    if (moped) {
      result = await sql`
        SELECT id, player_name, moped_make, score, distance,
               parts_collected, created_at
        FROM runner_scores
        WHERE moped_make = ${moped}
        ORDER BY score DESC
        LIMIT ${limit}
      `;
    } else {
      result = await sql`
        SELECT id, player_name, moped_make, score, distance,
               parts_collected, created_at
        FROM runner_scores
        ORDER BY score DESC
        LIMIT ${limit}
      `;
    }

    const scores = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as number,
      playerName: row.player_name as string,
      mopedMake: row.moped_make as string,
      score: row.score as number,
      distance: row.distance as number,
      partsCollected: row.parts_collected as number,
      createdAt: row.created_at as string,
    }));

    return NextResponse.json({ scores });
  } catch (error) {
    console.error("Leaderboard GET error:", error);
    return NextResponse.json({ scores: [] });
  }
}

// POST /api/game/leaderboard
export async function POST(request: Request) {
  try {
    await ensureTable();

    const body: unknown = await request.json();
    const data = submitSchema.parse(body);

    // Insert the score
    const insertResult = await sql`
      INSERT INTO runner_scores (
        player_name, moped_make, score, distance, parts_collected
      ) VALUES (
        ${data.playerName}, ${data.mopedMake}, ${data.score},
        ${data.distance}, ${data.partsCollected}
      )
      RETURNING id
    `;

    const id = (insertResult.rows[0] as Record<string, unknown> | undefined)
      ?.id as number | undefined;

    // Calculate rank
    const rankResult = await sql`
      SELECT COUNT(*) as rank
      FROM runner_scores
      WHERE score >= ${data.score}
    `;

    const rankRow = rankResult.rows[0] as Record<string, unknown> | undefined;
    const rankValue = rankRow?.rank;
    const rank = parseInt(typeof rankValue === "string" || typeof rankValue === "number" ? String(rankValue) : "0");

    return NextResponse.json({ id, rank });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 },
      );
    }
    console.error("Leaderboard POST error:", error);
    return NextResponse.json(
      { error: "Failed to submit score" },
      { status: 500 },
    );
  }
}
