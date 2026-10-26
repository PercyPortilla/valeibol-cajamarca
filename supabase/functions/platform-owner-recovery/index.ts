import { createClient } from "npm:@supabase/supabase-js@2.117.3";

type RecoveryRequest = {
  businessId: string;
  ownerEmail: string;
};

type RecoveryRow = {
  business_id: string;
  previous_owner_user_id: string | null;
  owner_user_id: string;
};

const PROD_ORIGIN = "https://valeibol-cajamarca-live.vercel.app";
const DEFAULT_INVITE_REDIRECT = `${PROD_ORIGIN}/admin/activar`;
const ALLOWED_ORIGINS = new Set([
  PROD_ORIGIN,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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

function parseBody(value: unknown): RecoveryRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== "businessId" && key !== "ownerEmail")) return null;

  const businessId = typeof record.businessId === "string" ? record.businessId.trim() : "";
  const ownerEmail = typeof record.ownerEmail === "string" ? record.ownerEmail.trim().toLowerCase() : "";
  if (!UUID_RE.test(businessId) || ownerEmail.length > 254 || !EMAIL_RE.test(ownerEmail)) return null;
  return { businessId, ownerEmail };
}

function mapRpcError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("owner_account_not_found")) return { code: "owner_account_not_found", status: 404 };
  if (normalized.includes("owner_account_unconfirmed")) return { code: "owner_account_unconfirmed", status: 409 };
  if (normalized.includes("owner_account_inactive")) return { code: "owner_account_inactive", status: 409 };
  if (normalized.includes("owner_already_assigned")) return { code: "owner_already_assigned", status: 409 };
  if (normalized.includes("platform_admin_cannot_be_tenant_owner")) return { code: "platform_admin_cannot_be_tenant_owner", status: 409 };
  if (normalized.includes("platform_admin_access_denied")) return { code: "platform_admin_access_denied", status: 403 };
  if (normalized.includes("business_not_found")) return { code: "business_not_found", status: 404 };
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

  const { data: callerAccount, error: callerAccountError } = await admin
    .from("user_accounts")
    .select("role,is_active")
    .eq("user_id", callerData.user.id)
    .maybeSingle();
  if (callerAccountError) return json(request, { ok: false, code: "service_unavailable" }, 503);
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

  async function recoverOwner() {
    return await caller.rpc("platform_admin_recover_primary_owner", {
      p_business_id: body.businessId,
      p_owner_email: body.ownerEmail,
    });
  }

  let recovery = await recoverOwner();
  if (!recovery.error) {
    const row = (recovery.data as RecoveryRow[] | null)?.[0];
    if (!row) return json(request, { ok: false, code: "service_unavailable" }, 503);
    return json(request, { ok: true, businessId: row.business_id, ownerInvited: false });
  }

  const initialError = mapRpcError(recovery.error.message);
  if (initialError.code !== "owner_account_not_found") {
    return json(request, { ok: false, code: initialError.code }, initialError.status);
  }

  const redirectTo = Deno.env.get("ADMIN_INVITE_REDIRECT_URL")?.trim() || DEFAULT_INVITE_REDIRECT;
  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(body.ownerEmail, { redirectTo });

  if (inviteError || !inviteData.user) {
    const mappedInvite = authInviteError(inviteError?.message ?? "invite_failed", inviteError?.status);
    if (mappedInvite.code === "email_in_use") {
      recovery = await recoverOwner();
      if (!recovery.error) {
        const row = (recovery.data as RecoveryRow[] | null)?.[0];
        if (row) return json(request, { ok: true, businessId: row.business_id, ownerInvited: false });
      }
      const retryError = mapRpcError(recovery.error?.message ?? "service_unavailable");
      return json(request, { ok: false, code: retryError.code }, retryError.status);
    }
    return json(request, { ok: false, code: mappedInvite.code }, mappedInvite.status);
  }

  const invitedUserId = inviteData.user.id;
  recovery = await recoverOwner();
  if (recovery.error) {
    const cleanup = await admin.auth.admin.deleteUser(invitedUserId);
    if (cleanup.error) console.error("[platform-owner-recovery] failed to rollback invited auth user", cleanup.error.message);
    const retryError = mapRpcError(recovery.error.message);
    return json(request, { ok: false, code: retryError.code }, retryError.status);
  }

  const row = (recovery.data as RecoveryRow[] | null)?.[0];
  if (!row) {
    const cleanup = await admin.auth.admin.deleteUser(invitedUserId);
    if (cleanup.error) console.error("[platform-owner-recovery] failed to rollback empty recovery", cleanup.error.message);
    return json(request, { ok: false, code: "service_unavailable" }, 503);
  }

  return json(request, { ok: true, businessId: row.business_id, ownerInvited: true });
});

