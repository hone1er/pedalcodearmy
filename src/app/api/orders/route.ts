import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createOrder, getOrders, initializeDatabase, type OrderInput } from "@/lib/db";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const GENERIC_ERROR = "Unable to process order right now. Please try again later.";
const SUCCESS_MESSAGE = "Order submitted successfully";

const ORDER_RATE_LIMIT = { limit: 5, windowMs: 10 * 60 * 1000 };

const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 100;

// ---------------------------------------------------------------------------
// Database initialization (deduplicated across concurrent cold-start requests)
// ---------------------------------------------------------------------------

let initPromise: Promise<void> | null = null;

function ensureDbInitialized(): Promise<void> {
  initPromise ??= initializeDatabase().catch((error: unknown) => {
    // Reset so the next request retries instead of caching the failure forever.
    initPromise = null;
    throw error;
  });
  return initPromise;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Optional string: accepts undefined/null, trims, caps length, and normalizes "" to undefined. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value === null || value === "" ? undefined : value));

const orderSchema = z.object({
  product: z.string().trim().min(1).max(100),
  customerName: z.string().trim().min(1).max(255),
  customerEmail: z.string().trim().max(255).email(),
  quantity: z.number().int().min(1).max(10).default(1),
  sideOption: z
    .enum(["left", "right", "both"])
    .nullish()
    .transform((value) => value ?? undefined),
  leftText: optionalText(50),
  rightText: optionalText(50),
  font: optionalText(100),
  textSize: optionalText(20),
  letterSpacing: optionalText(20),
  textCase: optionalText(20),
  isCustom: z
    .boolean()
    .nullish()
    .transform((value) => value ?? false),
  estimatedPrice: optionalText(20),
  notes: optionalText(1000),
  // Honeypots: real users never see or fill these fields. `hpCheck` is the
  // current field; `website` is still accepted from older clients.
  hpCheck: z.string().nullish(),
  website: z.string().nullish(),
});

// ---------------------------------------------------------------------------
// Pricing (server-authoritative for side-cover orders)
// ---------------------------------------------------------------------------

const PLAIN_SIDE_PRICE = 50;
const CUSTOM_SIDE_PRICE = 60;

function sidePrice(text: string | undefined): number {
  return text ? CUSTOM_SIDE_PRICE : PLAIN_SIDE_PRICE;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isJsonRequest(request: Request): boolean {
  return (request.headers.get("content-type") ?? "").toLowerCase().includes("application/json");
}

const HONEYPOT_FIELDS = ["hpCheck", "website"] as const;

/** True when any honeypot field was filled in (only bots see these inputs). */
function isHoneypotTripped(body: unknown): boolean {
  if (body === null || typeof body !== "object") return false;
  const record = body as Record<string, unknown>;
  return HONEYPOT_FIELDS.some((field) => {
    const value = record[field];
    return typeof value === "string" && value.trim() !== "";
  });
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Constant-time comparison; hashing first guarantees equal-length buffers. */
function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}

function parseBoundedInt(raw: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

// ---------------------------------------------------------------------------
// POST /api/orders — public waitlist / custom order submission
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  if (!isJsonRequest(request)) {
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 415 },
    );
  }

  const limit = rateLimit(`orders:${getClientIp(request)}`, ORDER_RATE_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many order submissions. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Honeypot check runs before full validation so bots always get a silent "success".
  if (isHoneypotTripped(body)) {
    return NextResponse.json({ success: true, message: SUCCESS_MESSAGE }, { status: 201 });
  }

  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid order details",
        details: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const data = parsed.data;

  let { leftText, rightText, isCustom, estimatedPrice } = data;

  if (data.sideOption) {
    // Strip text for a side that isn't being ordered.
    if (data.sideOption === "right") leftText = undefined;
    if (data.sideOption === "left") rightText = undefined;

    const unitPrice =
      data.sideOption === "left"
        ? sidePrice(leftText)
        : data.sideOption === "right"
          ? sidePrice(rightText)
          : sidePrice(leftText) + sidePrice(rightText);

    estimatedPrice = `$${unitPrice * data.quantity}`;
    isCustom = Boolean(leftText ?? rightText);
  }

  const orderInput: OrderInput = {
    product: data.product,
    customerName: data.customerName,
    customerEmail: data.customerEmail,
    quantity: data.quantity,
    sideOption: data.sideOption,
    leftText,
    rightText,
    font: data.font,
    textSize: data.textSize,
    letterSpacing: data.letterSpacing,
    textCase: data.textCase,
    isCustom,
    estimatedPrice,
    notes: data.notes,
  };

  try {
    await ensureDbInitialized();
    const result = await createOrder(orderInput);

    return NextResponse.json(
      {
        success: true,
        message: SUCCESS_MESSAGE,
        orderId: result?.id,
        createdAt: result?.created_at,
        estimatedPrice,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[api/orders] Failed to create order:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// GET /api/orders — admin only (contains customer PII)
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    // Endpoint is disabled entirely when no admin key is configured.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  const token = match?.[1]?.trim();
  if (!token || !safeEqual(token, adminKey)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    );
  }

  const url = new URL(request.url);
  const limit = parseBoundedInt(url.searchParams.get("limit"), DEFAULT_PAGE_LIMIT, 1, MAX_PAGE_LIMIT);
  const offset = parseBoundedInt(url.searchParams.get("offset"), 0, 0, 1_000_000);

  try {
    await ensureDbInitialized();
    const orders = await getOrders({ limit, offset });
    return NextResponse.json(
      { orders, pagination: { limit, offset, count: orders.length } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[api/orders] Failed to fetch orders:", error);
    return NextResponse.json(
      { error: "Unable to fetch orders right now." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
