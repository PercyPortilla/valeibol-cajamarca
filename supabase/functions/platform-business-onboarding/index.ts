import { createClient } from "npm:@supabase/supabase-js@2.117.3";

type OnboardingRequest = {
  slug: string;
  name: string;
  ownerEmail: string;
  city: string | null;
  country: string | null;
  address: string | null;
  phone: string | null;
  currency: string;
  timezone: string;
};

type CreatedBusiness = {
  business_id: string;
  business_slug: string;
  business_name: string;
  owner_user_id: string;
};

const PROD_ORIGIN = "https://valeibol-cajamarca-live.vercel.app";
const DEFAULT_INVITE_REDIRECT = `${PROD_ORIGIN}/admin/activar`;
const ALLOWED_ORIGINS = new Set([
  PROD_ORIGIN,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);
const ALLOWED_KEYS = new Set([
  "slug",
  "name",
  "ownerEmail",
  "city",
  "country",
  "address",
  "phone",
  "currency",
  "timezone",
]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin")?.trim();
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-retry-count, traceparent, tracestate, baggage",
    "access-control-allow-methods": "POST, OPTIONS",
    vary: "Origin",
  };
}

const json = (request: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

function privilegedKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (legacy) return legacy;

  const single = Deno.env.get("SUPABASE_SECRET_KEY")?.trim();
  if (single) return single;

  const raw = Deno.env.get("SUPABASE_SECRET_KEYS")?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed.default || Object.values(parsed).find(Boolean) || null;
  } catch {
    return null;
  }
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function normalizeOptional(value: unknown, maxLength: number) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) return undefined;
  return normalized;
}

function parseBody(value: unknown): OnboardingRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !ALLOWED_KEYS.has(key))) return null;

  const slug = typeof record.slug === "string" ? record.slug.trim().toLowerCase() : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const ownerEmail = typeof record.ownerEmail === "string" ? record.ownerEmail.trim().toLowerCase() : "";
  const currency = typeof record.currency === "string" ? record.currency.trim().toUpperCase() : "";
  const timezone = typeof record.timezone === "string" ? record.timezone.trim() : "";
  const city = normalizeOptional(record.city, 120);
  const country = normalizeOptional(record.country, 120);
  const address = normalizeOptional(record.address, 240);
  const phone = normalizeOptional(record.phone, 16);

  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
    slug.length > 80 ||
    name.length < 2 ||
    name.length > 120 ||
    ownerEmail.length > 254 ||
    !EMAIL_RE.test(ownerEmail) ||
    !/^[A-Z]{3}$/.test(currency) ||
    !timezone ||
    timezone.length > 100 ||
    city === undefined ||
    country === undefined ||
    address === undefined ||
    phone === undefined ||
    (phone !== null && !/^\+[1-9][0-9]{7,14}$/.test(phone))
  ) return null;

  return { slug, name, ownerEmail, city, country, address, phone, currency, timezone };
}

function mapRpcError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("owner_account_not_found")) return { code: "owner_account_not_found", status: 404 };
  if (normalized.includes("owner_already_assigned")) return { code: "owner_already_assigned", status: 409 };
  if (normalized.includes("platform_admin_cannot_be_tenant_owner")) return { code: "platform_admin_cannot_be_tenant_owner", status: 409 };
  if (normalized.includes("platform_admin_access_denied")) return { code: "platform_admin_access_denied", status: 403 };
  if (normalized.includes("duplicate") || normalized.includes("unique")) return { code: "business_slug_taken", status: 409 };
  if (normalized.includes("invalid_")) return { code: "invalid_payload", status: 400 };
  return { code: "service_unavailable", status: 503 };
}

function authInviteError(message: string, status?: number) {
  const normalized = message.toLowerCase();
  if (status === 422 || normalized.includes("already") || normalized.includes("registered") || normalized.includes("exists")) {
    return { code: "email_in_use", status: 409 };
  }
  if (status === 429) return { code: "rate_limited", status: 429 };
  return { code: "invite_failed", status: 503 };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { ok: false, code: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim();
  const adminKey = privilegedKey();
  if (!supabaseUrl || !publicKey || !adminKey) return json(request, { ok: false, code: "configuration" }, 503);

  const token = bearerToken(request);
  if (!token) return json(request, { ok: false, code: "authentication_required" }, 401);

  const admin = createClient(supabaseUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const caller = createClient(supabaseUrl, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: callerData, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !callerData.user) return json(request, { ok: false, code: "authentication_required" }, 401);

  const { data: callerAccount, error: accountError } = await admin
    .from("user_accounts")
    .select("role,is_active")
    .eq("user_id", callerData.user.id)
    .maybeSingle();
  if (accountError) return json(request, { ok: false, code: "service_unavailable" }, 503);
  if (!callerAccount || callerAccount.role !== "admin" || !callerAccount.is_active) {
    return json(request, { ok: false, code: "platform_admin_access_denied" }, 403);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json(request, { ok: false, code: "invalid_payload" }, 400);
  }
  const body = parseBody(rawBody);
  if (!body) return json(request, { ok: false, code: "invalid_payload" }, 400);

  const rpcInput = {
    p_slug: body.slug,
    p_name: body.name,
    p_owner_email: body.ownerEmail,
    p_city: body.city,
    p_country: body.country,
    p_address: body.address,
    p_phone: body.phone,
    p_currency: body.currency,
    p_timezone: body.timezone,
  };

  async function createBusiness() {
    return await caller.rpc("platform_admin_create_business", rpcInput);
  }

  let creation = await createBusiness();
  if (!creation.error) {
    const created = (creation.data as CreatedBusiness[] | null)?.[0];
    if (!created) return json(request, { ok: false, code: "service_unavailable" }, 503);
    return json(request, { ok: true, business: created, ownerInvited: false }, 201);
  }

  const initialError = mapRpcError(creation.error.message);
  if (initialError.code !== "owner_account_not_found") {
    return json(request, { ok: false, code: initialError.code }, initialError.status);
  }

  const redirectTo = Deno.env.get("ADMIN_INVITE_REDIRECT_URL")?.trim() || DEFAULT_INVITE_REDIRECT;
  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(body.ownerEmail, { redirectTo });

  if (inviteError || !inviteData.user) {
    const mappedInvite = authInviteError(inviteError?.message ?? "invite_failed", inviteError?.status);
    if (mappedInvite.code === "email_in_use") {
      // Una alta concurrente pudo crear la cuenta entre la primera RPC y la invitación.
      // Reintentamos con la identidad autoritativa del ADMIN antes de reportar conflicto.
      creation = await createBusiness();
      if (!creation.error) {
        const created = (creation.data as CreatedBusiness[] | null)?.[0];
        if (created) return json(request, { ok: true, business: created, ownerInvited: false }, 201);
      }
      const retryError = mapRpcError(creation.error?.message ?? "service_unavailable");
      return json(request, { ok: false, code: retryError.code }, retryError.status);
    }
    return json(request, { ok: false, code: mappedInvite.code }, mappedInvite.status);
  }

  const invitedUserId = inviteData.user.id;
  creation = await createBusiness();
  if (creation.error) {
    const cleanup = await admin.auth.admin.deleteUser(invitedUserId);
    if (cleanup.error) {
      console.error("[platform-business-onboarding] failed to rollback invited auth user", cleanup.error.message);
    }
    const retryError = mapRpcError(creation.error.message);
    return json(request, { ok: false, code: retryError.code }, retryError.status);
  }

  const created = (creation.data as CreatedBusiness[] | null)?.[0];
  if (!created) {
    const cleanup = await admin.auth.admin.deleteUser(invitedUserId);
    if (cleanup.error) {
      console.error("[platform-business-onboarding] failed to rollback invited auth user after empty RPC result", cleanup.error.message);
    }
    return json(request, { ok: false, code: "service_unavailable" }, 503);
  }

  return json(request, { ok: true, business: created, ownerInvited: true }, 201);
});
