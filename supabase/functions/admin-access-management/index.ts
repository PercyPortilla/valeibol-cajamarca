import { createClient } from "npm:@supabase/supabase-js@2.117.3";

type AdminRole = "owner" | "admin" | "staff";

type ListRequest = { action: "list" };
type InviteRequest = {
  action: "invite";
  email: string;
  role: AdminRole;
  displayName: string | null;
};
type UpdateRequest = {
  action: "update";
  userId: string;
  role?: AdminRole;
  displayName?: string | null;
  isActive?: boolean;
};
type RequestBody = ListRequest | InviteRequest | UpdateRequest;

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

function isRole(value: unknown): value is AdminRole {
  return value === "owner" || value === "admin" || value === "staff";
}

function normalizedDisplayName(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (normalized.length > 120) return undefined;
  return normalized || null;
}

function hasOnlyKeys(record: Record<string, unknown>, allowed: Set<string>) {
  return Object.keys(record).every((key) => allowed.has(key));
}

function parseBody(value: unknown): RequestBody | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;

  if (record.action === "list") {
    return hasOnlyKeys(record, new Set(["action"])) ? { action: "list" } : null;
  }

  if (record.action === "invite") {
    if (!hasOnlyKeys(record, new Set(["action", "email", "role", "displayName"]))) return null;
    if (typeof record.email !== "string" || !isRole(record.role)) return null;
    const email = record.email.trim().toLowerCase();
    const displayName = normalizedDisplayName(record.displayName);
    if (!email || email.length > 254 || !EMAIL_RE.test(email) || displayName === undefined) return null;
    return { action: "invite", email, role: record.role, displayName };
  }

  if (record.action === "update") {
    if (!hasOnlyKeys(record, new Set(["action", "userId", "role", "displayName", "isActive"]))) return null;
    if (typeof record.userId !== "string" || !UUID_RE.test(record.userId)) return null;
    if (record.role !== undefined && !isRole(record.role)) return null;
    if (record.isActive !== undefined && typeof record.isActive !== "boolean") return null;
    const displayName = normalizedDisplayName(record.displayName);
    if (record.displayName !== undefined && displayName === undefined) return null;
    if (record.role === undefined && record.displayName === undefined && record.isActive === undefined) return null;
    return {
      action: "update",
      userId: record.userId,
      ...(record.role !== undefined ? { role: record.role } : {}),
      ...(record.displayName !== undefined ? { displayName } : {}),
      ...(record.isActive !== undefined ? { isActive: record.isActive } : {}),
    };
  }

  return null;
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function mapError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("admin_owner_required")) return { code: "owner_required", status: 403 };
  if (normalized.includes("user_not_in_business")) return { code: "user_not_found", status: 404 };
  if (normalized.includes("user_assigned_elsewhere")) return { code: "user_assigned_elsewhere", status: 409 };
  if (normalized.includes("cannot_change_own_access")) return { code: "cannot_change_own_access", status: 409 };
  if (normalized.includes("active_owner_required")) return { code: "active_owner_required", status: 409 };
  if (normalized.includes("invalid_display_name") || normalized.includes("invalid_admin_access_input")) {
    return { code: "invalid_payload", status: 400 };
  }
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

type ProfileRow = {
  user_id: string;
  business_id: string;
  role: AdminRole;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function sanitizeUser(profile: ProfileRow, user: {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  created_at?: string;
}) {
  return {
    userId: profile.user_id,
    email: user.email ?? "",
    role: profile.role,
    displayName: profile.display_name,
    isActive: profile.is_active,
    emailConfirmed: Boolean(user.email_confirmed_at),
    lastSignInAt: user.last_sign_in_at ?? null,
    createdAt: user.created_at ?? profile.created_at,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (request.method !== "POST") return json(request, { ok: false, code: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const adminKey = privilegedKey();
  if (!supabaseUrl || !adminKey) return json(request, { ok: false, code: "configuration" }, 503);

  const token = bearerToken(request);
  if (!token) return json(request, { ok: false, code: "authentication_required" }, 401);

  const admin = createClient(supabaseUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: callerData, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !callerData.user) return json(request, { ok: false, code: "authentication_required" }, 401);

  const callerUserId = callerData.user.id;
  const { data: callerProfile, error: callerProfileError } = await admin
    .from("profiles")
    .select("user_id,business_id,role,is_active")
    .eq("user_id", callerUserId)
    .eq("role", "owner")
    .eq("is_active", true)
    .maybeSingle();

  if (callerProfileError) return json(request, { ok: false, code: "service_unavailable" }, 503);
  if (!callerProfile) return json(request, { ok: false, code: "owner_required" }, 403);

  const { data: business, error: businessError } = await admin
    .from("businesses")
    .select("id")
    .eq("id", callerProfile.business_id)
    .eq("is_active", true)
    .maybeSingle();
  if (businessError) return json(request, { ok: false, code: "service_unavailable" }, 503);
  if (!business) return json(request, { ok: false, code: "owner_required" }, 403);

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json(request, { ok: false, code: "invalid_payload" }, 400);
  }
  const body = parseBody(rawBody);
  if (!body) return json(request, { ok: false, code: "invalid_payload" }, 400);

  if (body.action === "list") {
    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("user_id,business_id,role,display_name,is_active,created_at,updated_at")
      .eq("business_id", callerProfile.business_id)
      .order("created_at", { ascending: true });
    if (profilesError) return json(request, { ok: false, code: "service_unavailable" }, 503);

    const users = await Promise.all((profiles ?? []).map(async (profile) => {
      const { data, error } = await admin.auth.admin.getUserById(profile.user_id);
      if (error || !data.user) throw error ?? new Error("auth_user_missing");
      return sanitizeUser(profile as ProfileRow, data.user);
    })).catch(() => null);

    if (!users) return json(request, { ok: false, code: "service_unavailable" }, 503);
    return json(request, { ok: true, users });
  }

  if (body.action === "invite") {
    const redirectTo = Deno.env.get("ADMIN_INVITE_REDIRECT_URL")?.trim() || DEFAULT_INVITE_REDIRECT;
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(body.email, { redirectTo });
    if (inviteError || !inviteData.user) {
      const mapped = authInviteError(inviteError?.message ?? "invite_failed", inviteError?.status);
      return json(request, { ok: false, code: mapped.code }, mapped.status);
    }

    const invitedUser = inviteData.user;
    const { data: profileRows, error: profileError } = await admin.rpc("admin_access_create_invited_profile", {
      p_actor_user_id: callerUserId,
      p_invited_user_id: invitedUser.id,
      p_role: body.role,
      p_display_name: body.displayName,
    });

    const profile = Array.isArray(profileRows) ? profileRows[0] as ProfileRow | undefined : undefined;
    if (profileError || !profile) {
      const cleanup = await admin.auth.admin.deleteUser(invitedUser.id);
      if (cleanup.error) {
        console.error("[admin-access-management] failed to rollback invited auth user", cleanup.error.message);
      }
      const mapped = mapError(profileError?.message ?? "profile_create_failed");
      return json(request, { ok: false, code: mapped.code }, mapped.status);
    }

    return json(request, { ok: true, user: sanitizeUser(profile, invitedUser) }, 201);
  }

  const { data: profileRows, error: updateError } = await admin.rpc("admin_access_update_profile", {
    p_actor_user_id: callerUserId,
    p_target_user_id: body.userId,
    p_role: body.role ?? null,
    p_display_name: body.displayName ?? null,
    p_display_name_provided: body.displayName !== undefined,
    p_is_active: body.isActive ?? null,
  });

  if (updateError) {
    const mapped = mapError(updateError.message);
    return json(request, { ok: false, code: mapped.code }, mapped.status);
  }

  const profile = Array.isArray(profileRows) ? profileRows[0] as ProfileRow | undefined : undefined;
  if (!profile) return json(request, { ok: false, code: "service_unavailable" }, 503);

  const { data: targetData, error: targetError } = await admin.auth.admin.getUserById(body.userId);
  if (targetError || !targetData.user) return json(request, { ok: false, code: "service_unavailable" }, 503);

  return json(request, { ok: true, user: sanitizeUser(profile, targetData.user) });
});



