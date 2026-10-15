import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_KEYS = new Set([
  "businessSlug",
  "courtId",
  "date",
  "start",
  "end",
  "lighting",
  "customerName",
  "phoneE164",
  "marketingOptIn",
  "requestToken",
]);

type PublicRequestBody = {
  businessSlug: string;
  courtId: string;
  date: string;
  start: string;
  end: string;
  lighting: "without_lights" | "with_lights";
  customerName: string;
  phoneE164: string;
  marketingOptIn: boolean;
  requestToken: string;
};

function jsonError(code: string, status: number) {
  return NextResponse.json({ ok: false, code }, { status });
}

function readClientAddress(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function parseBody(value: unknown): PublicRequestBody | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !ALLOWED_KEYS.has(key))) return null;

  const {
    businessSlug, courtId, date, start, end, lighting,
    customerName, phoneE164, marketingOptIn, requestToken,
  } = record;

  if (
    typeof businessSlug !== "string" ||
    typeof courtId !== "string" ||
    typeof date !== "string" ||
    typeof start !== "string" ||
    typeof end !== "string" ||
    (lighting !== "without_lights" && lighting !== "with_lights") ||
    typeof customerName !== "string" ||
    typeof phoneE164 !== "string" ||
    typeof marketingOptIn !== "boolean" ||
    typeof requestToken !== "string"
  ) return null;

  if (
    businessSlug.trim().length < 2 ||
    businessSlug.length > 120 ||
    !/^[0-9a-f-]{36}$/i.test(courtId) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^\d{2}:\d{2}$/.test(start) ||
    !/^\d{2}:\d{2}$/.test(end) ||
    customerName.trim().length < 2 ||
    customerName.trim().length > 120 ||
    phoneE164.trim().length > 20 ||
    !/^[0-9a-f-]{36}$/i.test(requestToken)
  ) return null;

  return {
    businessSlug: businessSlug.trim(),
    courtId,
    date,
    start,
    end,
    lighting,
    customerName: customerName.trim(),
    phoneE164: phoneE164.trim(),
    marketingOptIn,
    requestToken,
  };
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid_payload", 400);
  }

  const parsed = parseBody(body);
  if (!parsed) return jsonError("invalid_payload", 400);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serverToken = process.env.PUBLIC_BOOKING_RATE_LIMIT_SECRET?.trim();
  if (!supabaseUrl || !serverToken) return jsonError("configuration", 503);

  const endpoint = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/public-reservation-request`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-valeibol-server-token": serverToken,
        "x-valeibol-client-ip": readClientAddress(request),
        "x-valeibol-user-agent": request.headers.get("user-agent")?.slice(0, 256) || "unknown",
      },
      body: JSON.stringify(parsed),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    return jsonError("service_unavailable", 503);
  }

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!payload || typeof payload !== "object") return jsonError("service_unavailable", 503);

  if (!response.ok) {
    const code = typeof payload.code === "string" ? payload.code : "service_unavailable";
    return jsonError(code, response.status >= 400 && response.status <= 599 ? response.status : 503);
  }

  return NextResponse.json(payload, { status: 201 });
}
