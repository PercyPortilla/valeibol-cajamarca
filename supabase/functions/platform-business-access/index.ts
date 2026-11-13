import { createClient } from "npm:@supabase/supabase-js@2.117.3";

type Role = "owner" | "admin" | "staff";
type RequestBody = {
  businessId: string;
  action: "list" | "invite" | "provision" | "update";
  email?: string;
  displayName?: string | null;
  role?: Role;
  userId?: string;
  isActive?: boolean;
};
type Profile = {
  user_id: string; business_id: string; role: Role;
  display_name: string | null; is_active: boolean; created_at: string;
};
const PROD = "https://caxas-sportcenter.vercel.app";
const LEGACY = "https://valeibol-cajamarca-live.vercel.app";
const ORIGINS = new Set([PROD, LEGACY, "http://localhost:3000", "http://127.0.0.1:3000"]);
// Las versiones actuales de supabase-js / supabase-ssr añaden cabeceras de
// reintentos y trazabilidad. Si OPTIONS no las incluye en Allow-Headers, el
// navegador bloquea el POST antes de que llegue a esta función.
const CORS_REQUEST_HEADERS = [
  "authorization", "apikey", "content-type", "x-client-info",
  "x-retry-count", "traceparent", "tracestate", "baggage",
  "x-supabase-client-platform", "x-supabase-client-platform-version",
  "x-supabase-client-runtime", "x-supabase-client-runtime-version",
].join(", ");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cors(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin || !ORIGINS.has(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-headers": CORS_REQUEST_HEADERS,
    "access-control-allow-methods": "POST, OPTIONS",
    vary: "Origin",
  };
}
function json(req: Request, value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status, headers: { ...cors(req), "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
function secret() {
  const single = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() || Deno.env.get("SUPABASE_SECRET_KEY")?.trim();
  if (single) return single;
  try {
    const all = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string,string>;
    return all.default || Object.values(all).find(Boolean) || null;
  } catch { return null; }
}
function role(value: unknown): value is Role {
  return value === "owner" || value === "admin" || value === "staff";
}
function temporaryPassword() {
  // Se genera en el servidor con 192 bits de entropía. Nunca se guarda en texto
  // plano ni se registra; Auth almacena únicamente su hash.
  const random = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...random))
    .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
function parse(raw: unknown): RequestBody | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  if (Object.keys(data).some((key) => !["businessId","action","email","displayName","role","userId","isActive"].includes(key))) return null;
  if (typeof data.businessId !== "string" || !UUID.test(data.businessId)) return null;
  if (data.action === "list") return Object.keys(data).length === 2 ? { businessId: data.businessId, action: "list" } : null;
  const displayName = data.displayName === undefined || data.displayName === null ? null
    : typeof data.displayName === "string" && data.displayName.trim().length <= 120 ? data.displayName.trim() || null : undefined;
  if (displayName === undefined || !role(data.role)) return null;
  if (data.action === "invite" || data.action === "provision") {
    const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
    if (!EMAIL.test(email) || email.length > 254 || Object.keys(data).some((key) => !["businessId","action","email","displayName","role"].includes(key))) return null;
    return { action: data.action, businessId: data.businessId, email, displayName, role: data.role };
  }
  if (data.action === "update") {
    if (typeof data.userId !== "string" || !UUID.test(data.userId) || typeof data.isActive !== "boolean"
      || Object.keys(data).some((key) => !["businessId","action","userId","displayName","role","isActive"].includes(key))) return null;
    return { action: "update", businessId: data.businessId, userId: data.userId,
      role: data.role, displayName, isActive: data.isActive };
  }
  return null;
}
function code(error: { message: string; status?: number } | null) {
  const message = error?.message.toLowerCase() ?? "";
  for (const name of [
    "existing_account_not_found","existing_account_unconfirmed","existing_account_inactive",
    "user_assigned_elsewhere","user_already_in_business","platform_admin_cannot_join_tenant",
    "primary_owner_transfer_required","active_owner_required","user_not_in_business",
    "pending_password_activation",
    "platform_admin_team_access_denied","team_invalid_input","team_invalid_email",
  ]) if (message.includes(name)) return name;
  if (error?.status === 429) return "rate_limited";
  if (error?.status === 422 || message.includes("already registered") || message.includes("already exists")) return "email_in_use";
  return "service_unavailable";
}
function errorStatus(errorCode: string) {
  if (errorCode === "platform_admin_team_access_denied" || errorCode === "platform_admin_cannot_join_tenant") return 403;
  if (errorCode === "existing_account_not_found" || errorCode === "user_not_in_business") return 404;
  if (errorCode === "team_invalid_input" || errorCode === "team_invalid_email") return 422;
  if (errorCode === "rate_limited") return 429;
  if (errorCode === "service_unavailable") return 503;
  return 409;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(request) });
  if (request.method !== "POST") return json(request, { ok: false, code: "method_not_allowed" }, 405);
  const origin = request.headers.get("origin");
  if (origin && !ORIGINS.has(origin)) return json(request, { ok: false, code: "invalid_origin" }, 403);
  const url = Deno.env.get("SUPABASE_URL")?.trim();
  const key = secret();
  if (!url || !key) return json(request, { ok: false, code: "configuration" }, 503);
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return json(request, { ok: false, code: "authentication_required" }, 401);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data: identity, error: identityError } = await admin.auth.getUser(bearer);
  if (identityError || !identity.user) return json(request, { ok: false, code: "authentication_required" }, 401);
  const { data: account, error: accountError } = await admin.from("user_accounts").select("role,is_active")
    .eq("user_id",identity.user.id).maybeSingle();
  if (accountError) return json(request,{ok:false,code:"service_unavailable"},503);
  if (!account || account.role !== "admin" || !account.is_active) return json(request,{ok:false,code:"platform_admin_team_access_denied"},403);

  let raw: unknown;
  try {
    if (Number(request.headers.get("content-length") || 0) > 10000) return json(request,{ok:false,code:"payload_too_large"},413);
    raw = await request.json();
  } catch { return json(request,{ok:false,code:"invalid_payload"},400); }
  const body = parse(raw);
  if (!body) return json(request,{ok:false,code:"invalid_payload"},422);

  const actorId = identity.user.id;
  const { error: gateError } = await admin.rpc("platform_admin_team_assert",{
    p_actor_id: actorId,p_business_id: body.businessId,
  });
  if (gateError) {
    const mapped = code(gateError);
    return json(request,{ok:false,code:mapped},errorStatus(mapped));
  }
  const { data: business, error: businessError } = await admin.from("businesses").select("id,owner_user_id,name")
    .eq("id",body.businessId).maybeSingle();
  if (businessError || !business) return json(request,{ok:false,code:"service_unavailable"},503);

  async function userView(profile: Profile) {
    const [{ data: authUser, error: authError }, { data: accountRow, error: accountRowError }] = await Promise.all([
      admin.auth.admin.getUserById(profile.user_id),
      admin.from("user_accounts").select("role,is_active").eq("user_id",profile.user_id).maybeSingle(),
    ]);
    if (authError || !authUser.user || accountRowError) throw new Error("unavailable");
    return {
      userId: profile.user_id, email: authUser.user.email || "", displayName: profile.display_name,
      role: profile.role, isActive: profile.is_active && (accountRow?.is_active ?? true),
      emailConfirmed: Boolean(authUser.user.email_confirmed_at),
      pendingActivation: authUser.user.app_metadata?.platform_tenant_temp === body.businessId,
      isPrimaryOwner: business.owner_user_id === profile.user_id,
      lastSignInAt: authUser.user.last_sign_in_at ?? null,
    };
  }
  const currentProfiles = async () => await admin.from("profiles")
    .select("user_id,business_id,role,display_name,is_active,created_at")
    .eq("business_id",body.businessId).order("created_at",{ascending:true}).limit(100);

  if (body.action === "list") {
    const { data: profiles, error } = await currentProfiles();
    if (error) return json(request,{ok:false,code:"service_unavailable"},503);
    try {
      const users = await Promise.all((profiles ?? []).map((p) => userView(p as Profile)));
      return json(request,{ok:true,users,businessName:business.name});
    } catch { return json(request,{ok:false,code:"service_unavailable"},503); }
  }

  if (body.action === "invite") {
    async function linkExisting() {
      return await admin.rpc("platform_admin_team_link_email",{
        p_actor_id:actorId,p_business_id:body.businessId,p_email:body.email,
        p_role:body.role,p_display_name:body.displayName,
      });
    }
    let link = await linkExisting();
    if (link.error && code(link.error) === "existing_account_not_found") {
      const redirectTo = Deno.env.get("ADMIN_INVITE_REDIRECT_URL")?.trim() || `${LEGACY}/admin/activar`;
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(body.email!,{redirectTo});
      if (inviteError || !invited.user) {
        if (code(inviteError) === "email_in_use") {
          link = await linkExisting();
        } else {
          const mapped = code(inviteError);
          return json(request,{ok:false,code:mapped},errorStatus(mapped));
        }
      } else {
        const attach = await admin.rpc("platform_admin_team_attach",{
          p_actor_id:actorId,p_business_id:body.businessId,
          p_target_user_id:invited.user.id,p_role:body.role,p_display_name:body.displayName,
        });
        if (attach.error) {
          const cleanup = await admin.auth.admin.deleteUser(invited.user.id);
          if (cleanup.error) console.error("[platform-business-access] invitation rollback failed", cleanup.error.code);
          const mapped = code(attach.error);
          return json(request,{ok:false,code:mapped},errorStatus(mapped));
        }
        const { data: attachedProfile, error: profileError } = await admin.from("profiles")
          .select("user_id,business_id,role,display_name,is_active,created_at")
          .eq("user_id",invited.user.id).eq("business_id",body.businessId).single();
        if (profileError || !attachedProfile) return json(request,{ok:false,code:"service_unavailable"},503);
        return json(request,{ok:true,accessMode:"invited",user:await userView(attachedProfile as Profile)},201);
      }
    }
    if (link.error) {
      const mapped = code(link.error);
      return json(request,{ok:false,code:mapped},errorStatus(mapped));
    }
    const { data: linkedProfile, error: profileError } = await admin.from("profiles")
      .select("user_id,business_id,role,display_name,is_active,created_at")
      .eq("user_id",(link.data as {userId?: string})?.userId ?? "").eq("business_id",body.businessId).single();
    if (profileError || !linkedProfile) return json(request,{ok:false,code:"service_unavailable"},503);
    return json(request,{ok:true,accessMode:"linked",user:await userView(linkedProfile as Profile)});
  }

  if (body.action === "provision") {
    // El correo puede ser elegido por el administrador global, pero jamás se
    // reemplaza la clave de una cuenta existente: se rechaza y se orienta a
    // recuperar/usar esa misma cuenta por otro flujo autorizado.
    const password = temporaryPassword();
    const { data: created, error: creationError } = await admin.auth.admin.createUser({
      email: body.email!, password, email_confirm: true,
      app_metadata: { platform_tenant_temp: body.businessId },
    });
    if (creationError || !created.user) {
      const mapped = code(creationError);
      return json(request,{ok:false,code:mapped},errorStatus(mapped));
    }
    const attached = await admin.rpc("platform_admin_team_attach_pending",{
      p_actor_id: actorId,p_business_id:body.businessId,
      p_target_user_id:created.user.id,p_role:body.role,p_display_name:body.displayName,
    });
    if (attached.error) {
      const cleanup = await admin.auth.admin.deleteUser(created.user.id);
      if (cleanup.error) console.error("[platform-business-access] pending setup rollback failed",cleanup.error.code);
      const mapped = code(attached.error);
      return json(request,{ok:false,code:mapped},errorStatus(mapped));
    }
    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("user_id,business_id,role,display_name,is_active,created_at")
      .eq("user_id",created.user.id).eq("business_id",body.businessId).single();
    if (profileError || !profile) return json(request,{ok:false,code:"service_unavailable"},503);
    return json(request,{
      ok:true,accessMode:"temporary",temporaryPassword:password,
      user:await userView(profile as Profile),
    },201);
  }

  const update = await admin.rpc("platform_admin_team_update",{
    p_actor_id:actorId,p_business_id:body.businessId,p_target_user_id:body.userId,
    p_role:body.role,p_is_active:body.isActive,p_display_name:body.displayName,
  });
  if (update.error) {
    const mapped = code(update.error);
    return json(request,{ok:false,code:mapped},errorStatus(mapped));
  }
  const { data: updatedProfile, error: profileError } = await admin.from("profiles")
    .select("user_id,business_id,role,display_name,is_active,created_at")
    .eq("user_id",body.userId!).eq("business_id",body.businessId).single();
  if (profileError || !updatedProfile) return json(request,{ok:false,code:"service_unavailable"},503);
  return json(request,{ok:true,user:await userView(updatedProfile as Profile)});
});
