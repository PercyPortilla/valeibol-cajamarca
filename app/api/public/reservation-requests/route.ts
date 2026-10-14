import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/data/supabase/service";

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

function fingerprintFor(request: NextRequest) {
  const secret = process.env.PUBLIC_BOOKING_RATE_LIMIT_SECRET?.trim();
  if (!secret) throw new Error("PUBLIC_BOOKING_RATE_LIMIT_SECRET is missing.");

  // La IP no se persiste: solo enviamos un HMAC irreversible a PostgreSQL.
  const raw = [
    readClientAddress(request),
    request.headers.get("user-agent")?.slice(0, 256) || "unknown",
  ].join("|");

  return createHmac("sha256", secret).update(raw).digest("hex");
}

function parseBody(value: unknown): PublicRequestBody | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  // Rechaza payloads que intenten imponer business_id, precio, total, status, rol, etc.
  if (Object.keys(record).some((key) => !ALLOWED_KEYS.has(key))) return null;

  const {
    businessSlug,
    courtId,
    date,
    start,
    end,
    lighting,
    customerName,
    phoneE164,
    marketingOptIn,
    requestToken,
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
    businessSlug.length < 2 || businessSlug.length > 120 ||
    courtId.length > 80 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^\d{2}:\d{2}$/.test(start) ||
    !/^\d{2}:\d{2}$/.test(end) ||
    customerName.trim().length < 2 || customerName.trim().length > 120 ||
    phoneE164.length > 20 ||
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

function mapDatabaseError(message: string, code?: string) {
  const normalized = message.toLowerCase();

  if (code === "23P01" || normalized.includes("slot_unavailable") || normalized.includes("exclusion")) {
    return { code: "slot_unavailable", status: 409 };
  }
  if (normalized.includes("public_customer_rate_limited")) {
    return { code: "rate_limited", status: 429 };
  }
  if (normalized.includes("invalid_customer_name")) return { code: "invalid_customer", status: 400 };
  if (normalized.includes("invalid_phone_e164")) return { code: "invalid_phone", status: 400 };
  if (normalized.includes("reservation_in_past")) return { code: "reservation_in_past", status: 400 };
  if (normalized.includes("court_closed")) return { code: "court_closed", status: 409 };
  if (normalized.includes("outside_operating_hours")) return { code: "outside_operating_hours", status: 400 };
  if (normalized.includes("invalid_interval") || normalized.includes("invalid_booking_increment")) {
    return { code: "invalid_interval", status: 400 };
  }
  if (normalized.includes("pricing_not_found")) return { code: "pricing_not_found", status: 409 };
  if (normalized.includes("not_found")) return { code: "not_found", status: 404 };

  return { code: "unknown", status: 500 };
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

  let fingerprint: string;
  try {
    fingerprint = fingerprintFor(request);
  } catch {
    // En producción no permitimos reservar si el rate limit server-side está sin configurar.
    return jsonError("configuration", 503);
  }

  let supabase;
  try {
    supabase = createServiceRoleSupabaseClient();
  } catch {
    return jsonError("configuration", 503);
  }

  const { data: allowed, error: limitError } = await supabase.rpc(
    "consume_public_booking_rate_limit",
    {
      p_business_slug: parsed.businessSlug,
      p_fingerprint_hash: fingerprint,
      p_limit: 12,
    },
  );

  if (limitError) {
    return jsonError("service_unavailable", 503);
  }
  if (allowed !== true) {
    return jsonError("rate_limited", 429);
  }

  const { data, error } = await supabase.rpc("create_public_reservation_request", {
    p_business_slug: parsed.businessSlug,
    p_court_id: parsed.courtId,
    p_date: parsed.date,
    p_start_time: parsed.start,
    p_end_time: parsed.end,
    p_lighting: parsed.lighting,
    p_customer_name: parsed.customerName,
    p_phone_e164: parsed.phoneE164,
    p_marketing_opt_in: parsed.marketingOptIn,
    p_request_token: parsed.requestToken,
  });

  if (error) {
    const mapped = mapDatabaseError(error.message, error.code);
    return jsonError(mapped.code, mapped.status);
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row || typeof row !== "object") return jsonError("unknown", 500);

  // Respuesta explícitamente sanitizada. No devolvemos customer_id, teléfono, nombre ni notas.
  return NextResponse.json({
    ok: true,
    requestId: row.request_id,
    status: row.request_status,
    courtId: row.court_id,
    startAt: row.start_at,
    endAt: row.end_at,
    lighting: row.lighting,
    hourlyRate: row.hourly_rate,
    totalAmount: row.total_amount,
    currency: row.currency,
  }, { status: 201 });
}
