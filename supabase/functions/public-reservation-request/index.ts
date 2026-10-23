import { createClient } from "npm:@supabase/supabase-js@2.117.3";

type PublicRequestBody = {
  businessSlug: string;
  courtId: string;
  date: string;
  start: string;
  end: string;
  netHeightCm: number | null;
  customerName: string;
  phoneE164: string;
  marketingOptIn: boolean;
  requestToken: string;
  authenticatedUserId: string | null;
};

const ALLOWED_KEYS = new Set([
  "businessSlug",
  "courtId",
  "date",
  "start",
  "end",
  "netHeightCm",
  "customerName",
  "phoneE164",
  "marketingOptIn",
  "requestToken",
  "authenticatedUserId",
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

function parseBody(value: unknown): PublicRequestBody | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !ALLOWED_KEYS.has(key))) return null;

  const {
    businessSlug,
    courtId,
    date,
    start,
    end,
    netHeightCm,
    customerName,
    phoneE164,
    marketingOptIn,
    requestToken,
    authenticatedUserId,
  } = record;

  if (
    typeof businessSlug !== "string" ||
    typeof courtId !== "string" ||
    typeof date !== "string" ||
    typeof start !== "string" ||
    typeof end !== "string" ||
    (netHeightCm !== null && (
      typeof netHeightCm !== "number" ||
      !Number.isInteger(netHeightCm) ||
      netHeightCm < 180 ||
      netHeightCm > 250
    )) ||
    typeof customerName !== "string" ||
    typeof phoneE164 !== "string" ||
    typeof marketingOptIn !== "boolean" ||
    typeof requestToken !== "string" ||
    (authenticatedUserId !== null && typeof authenticatedUserId !== "string")
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
    !/^\+[1-9][0-9]{7,14}$/.test(phoneE164.trim()) ||
    !/^[0-9a-f-]{36}$/i.test(requestToken) ||
    (authenticatedUserId !== null && !/^[0-9a-f-]{36}$/i.test(authenticatedUserId))
  ) return null;

  return {
    businessSlug: businessSlug.trim(),
    courtId,
    date,
    start,
    end,
    netHeightCm,
    customerName: customerName.trim(),
    phoneE164: phoneE164.trim(),
    marketingOptIn,
    requestToken,
    authenticatedUserId,
  };
}

function privilegedKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (legacy) return legacy;

  const raw = Deno.env.get("SUPABASE_SECRET_KEYS")?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed.default || Object.values(parsed).find(Boolean) || null;
  } catch {
    return null;
  }
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function mapDatabaseError(message: string, code?: string) {
  const normalized = message.toLowerCase();
  if (code === "23P01" || normalized.includes("slot_unavailable") || normalized.includes("exclusion")) {
    return { code: "slot_unavailable", status: 409 };
  }
  if (normalized.includes("public_customer_rate_limited")) return { code: "rate_limited", status: 429 };
  if (normalized.includes("invalid_customer_name")) return { code: "invalid_customer", status: 400 };
  if (normalized.includes("invalid_phone_e164")) return { code: "invalid_phone", status: 400 };
  if (normalized.includes("reservation_in_past")) return { code: "reservation_in_past", status: 400 };
  if (normalized.includes("court_closed")) return { code: "court_closed", status: 409 };
  if (normalized.includes("outside_operating_hours")) return { code: "outside_operating_hours", status: 400 };
  if (normalized.includes("lighting_cutoff_crossed")) return { code: "lighting_cutoff_crossed", status: 400 };
  if (normalized.includes("invalid_net_height") || normalized.includes("net_height_not_applicable")) {
    return { code: "invalid_net_height", status: 400 };
  }
  if (normalized.includes("invalid_interval") || normalized.includes("invalid_booking_increment")) {
    return { code: "invalid_interval", status: 400 };
  }
  if (normalized.includes("pricing_not_found")) return { code: "pricing_not_found", status: 409 };
  if (normalized.includes("not_found")) return { code: "not_found", status: 404 };
  return { code: "unknown", status: 500 };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ ok: false, code: "method_not_allowed" }, 405);

  const serverToken = request.headers.get("x-valeibol-server-token")?.trim();
  if (!serverToken || serverToken.length < 32) return json({ ok: false, code: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const adminKey = privilegedKey();
  if (!supabaseUrl || !adminKey) return json({ ok: false, code: "configuration" }, 503);

  const admin = createClient(supabaseUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tokenHash = await sha256Hex(serverToken);
  const { data: authorized, error: authError } = await admin.rpc(
    "validate_server_integration_secret",
    { p_name: "public_booking_edge", p_secret_hash: tokenHash },
  );

  if (authError) return json({ ok: false, code: "service_unavailable" }, 503);
  if (authorized !== true) return json({ ok: false, code: "unauthorized" }, 401);

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json({ ok: false, code: "invalid_payload" }, 400);
  }

  const body = parseBody(rawBody);
  if (!body) return json({ ok: false, code: "invalid_payload" }, 400);

  const clientIp = request.headers.get("x-valeibol-client-ip")?.slice(0, 128).trim() || "unknown";
  const userAgent = request.headers.get("x-valeibol-user-agent")?.slice(0, 256).trim() || "unknown";
  const fingerprint = await hmacHex(serverToken, `${clientIp}|${userAgent}`);

  const { data: allowed, error: limitError } = await admin.rpc("consume_public_booking_rate_limit", {
    p_business_slug: body.businessSlug,
    p_fingerprint_hash: fingerprint,
    p_limit: 12,
  });

  if (limitError) return json({ ok: false, code: "service_unavailable" }, 503);
  if (allowed !== true) return json({ ok: false, code: "rate_limited" }, 429);

  const { data, error } = await admin.rpc("create_public_reservation_request", {
    p_business_slug: body.businessSlug,
    p_court_id: body.courtId,
    p_date: body.date,
    p_start_time: body.start,
    p_end_time: body.end,
    p_net_height_cm: body.netHeightCm,
    p_customer_name: body.customerName,
    p_phone_e164: body.phoneE164,
    p_marketing_opt_in: body.marketingOptIn,
    p_request_token: body.requestToken,
  });

  if (error) {
    const mapped = mapDatabaseError(error.message, error.code);
    return json({ ok: false, code: mapped.code }, mapped.status);
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row || typeof row !== "object") return json({ ok: false, code: "unknown" }, 500);

  let accountLinked: boolean | null = null;
  if (body.authenticatedUserId) {
    const { data: linked, error: linkError } = await admin.rpc("link_public_reservation_user", {
      p_reservation_id: row.request_id,
      p_user_id: body.authenticatedUserId,
    });
    accountLinked = !linkError && linked === true;
  }

  return json({
    ok: true,
    requestId: row.request_id,
    status: row.request_status,
    courtId: row.court_id,
    startAt: row.start_at,
    endAt: row.end_at,
    lighting: row.lighting,
    netHeightCm: row.net_height_cm,
    hourlyRate: row.hourly_rate,
    totalAmount: row.total_amount,
    currency: row.currency,
    accountLinked,
  }, 201);
});
