import { createClient } from "npm:@supabase/supabase-js@2.117.3";

type Role = "owner" | "admin" | "staff";
type RequestBody = {
  businessId: string;
  action: "list" | "invite" | "provision" | "update" | "audit" | "recover" | "invitation_link";
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
const ORIGINS = new Set([
  PROD, LEGACY,
  // Aliases estables de producción que Vercel asigna a este mismo proyecto.
  "https://caxas-sportcenter-jan1diaz-5594.vercel.app",
  "https://caxas-sportcenter-git-main-jan1diaz-5594.vercel.app",
  "http://localhost:3000", "http://127.0.0.1:3000",
]);
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
  if (data.action === "list" || data.action === "audit") {
    return Object.keys(data).length === 2 ? { businessId: data.businessId, action: data.action } : null;
  }
  if (data.action === "recover" || data.action === "invitation_link") {
    if (Object.keys(data).some((key) => !["businessId","action","userId"].includes(key))
      || typeof data.userId !== "string" || !UUID.test(data.userId)) return null;
    return { businessId: data.businessId, action: data.action, userId: data.userId };
  }
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
    "invitation_not_pending","account_not_active","mail_delivery_failed",
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
  if (errorCode === "mail_delivery_failed") return 503;
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

  // Nunca guardar correos, contraseñas, JWT ni enlaces de recuperación en auditoría.
  async function recordEvent(eventType: "invite" | "provision" | "update",
    targetId: string | null, result: "success" | "failed", errorCode: string | null = null) {
    const { error } = await admin.from("platform_team_access_audit").insert({
      business_id: body.businessId, actor_user_id: actorId, target_user_id: targetId,
      event_type: eventType, result, error_code: errorCode,
    });
    if (error) console.error("[platform-business-access] audit_write_failed", error.code);
  }

  if (body.action === "audit") {
    const { data, error } = await admin.from("platform_team_access_audit")
      .select("id,target_user_id,event_type,result,error_code,created_at")
      .eq("business_id",body.businessId)
      .order("created_at",{ascending:false}).limit(40);
    if (error) return json(request,{ok:false,code:"service_unavailable"},503);
    return json(request,{ok:true,events:(data ?? []).map((event)=>({
      id:event.id,targetUserId:event.target_user_id,
      eventType:event.event_type,result:event.result,
      errorCode:event.error_code,createdAt:event.created_at,
    }))});
  }

  if (body.action === "list") {
    const { data: profiles, error } = await currentProfiles();
    if (error) return json(request,{ok:false,code:"service_unavailable"},503);
    // Un error de Auth al consultar un miembro no puede ocultar todo el equipo.
    const results = await Promise.allSettled((profiles ?? []).map((p)=>userView(p as Profile)));
    const users = results.flatMap((result)=>result.status==="fulfilled" ? [result.value] : []);
    const unavailableCount = results.length-users.length;
    if (unavailableCount>0) console.warn("[platform-business-access] partial_team_list",{
      unavailableCount, totalProfiles: results.length,
    });
    return json(request,{ok:true,users,businessName:business.name,
      partial:unavailableCount>0,unavailableCount,totalProfiles:results.length});
  }

  if (body.action === "recover" || body.action === "invitation_link") {
    // La identidad llega del usuario seleccionado de ESTE tenant, nunca del correo
    // que el navegador pueda inventar. Este flujo no modifica contraseñas.
    const { data: profile, error: memberError } = await admin.from("profiles")
      .select("user_id,business_id,role,display_name,is_active,created_at")
      .eq("business_id",body.businessId).eq("user_id",body.userId!).maybeSingle();
    if (memberError) return json(request,{ok:false,code:"service_unavailable"},503);
    if (!profile) return json(request,{ok:false,code:"user_not_in_business"},404);
    const { data: identityRecord, error: identityFetchError } = await admin.auth.admin.getUserById(body.userId!);
    if (identityFetchError || !identityRecord.user?.email) return json(request,{ok:false,code:"service_unavailable"},503);
    const authUser = identityRecord.user;
    if (authUser.app_metadata?.platform_tenant_temp === body.businessId) {
      return json(request,{ok:false,code:"pending_password_activation"},409);
    }
    if (body.action === "recover" && !authUser.email_confirmed_at) {
      return json(request,{ok:false,code:"invitation_not_pending"},409);
    }
    if (body.action === "recover" && !profile.is_active) {
      return json(request,{ok:false,code:"account_not_active"},409);
    }
    if (body.action === "invitation_link" && authUser.email_confirmed_at) {
      return json(request,{ok:false,code:"invitation_not_pending"},409);
    }
    // Anti-abuso atómico en PostgreSQL. No crear invitaciones duplicadas.
    const eventType = body.action === "recover" ? "recovery" : "invitation_link";
    const cooldownSlot = Math.floor(Date.now()/(15*60*1000));
    const { data: event, error: eventError } = await admin.from("platform_team_access_audit")
      .insert({ business_id: body.businessId, actor_user_id: actorId,
        target_user_id: body.userId, event_type: eventType, result: "pending",
        cooldown_slot: cooldownSlot })
      .select("id").single();
    if (eventError || !event) {
      return json(request,{ok:false,code:eventError?.code==="23505" ? "rate_limited" : "service_unavailable"},
        eventError?.code==="23505" ? 429 : 503);
    }
    let deliveryError: string | null = null;
    if (body.action === "recover") {
      // Edge usa auth flow implícito (sin PKCE/verificador de navegador):
      // el token llega en el fragmento y debe recibirlo el CLIENTE de /activar,
      // nunca /auth/callback que solo acepta ?code= de PKCE.
      // Debe estar en Auth -> URL Configuration -> Redirect URLs.
      const redirectTo = Deno.env.get("ADMIN_RECOVERY_REDIRECT_URL")?.trim()
        || `${PROD}/admin/activar?recovery=1`;
      const { error } = await admin.auth.resetPasswordForEmail(authUser.email,{redirectTo});
      if (error) deliveryError = error.status===429 ? "rate_limited" : "mail_delivery_failed";
    } else {
      const redirectTo = Deno.env.get("ADMIN_INVITE_REDIRECT_URL")?.trim() || `${LEGACY}/admin/activar`;
      // Supabase envía el enlace SOLO al correo del titular. No entregar una
      // credencial passwordless al administrador ni crear usuarios duplicados.
      const { error } = await admin.auth.signInWithOtp({
        email:authUser.email,
        options:{shouldCreateUser:false,emailRedirectTo:redirectTo},
      });
      if (error) deliveryError = error.status===429 ? "rate_limited" : "mail_delivery_failed";
    }
    const { error: auditError } = await admin.from("platform_team_access_audit")
      .update({result:deliveryError?"failed":"success",error_code:deliveryError})
      .eq("id",event.id).eq("business_id",body.businessId);
    if (auditError) console.error("[platform-business-access] audit_finalize_failed",auditError.code);
    if (deliveryError) return json(request,{ok:false,code:deliveryError},errorStatus(deliveryError));
    return json(request,{ok:true,delivery:"email_requested"});
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
          await recordEvent("invite",null,"failed",mapped);
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
          await recordEvent("invite",null,"failed",mapped);
          return json(request,{ok:false,code:mapped},errorStatus(mapped));
        }
        const { data: attachedProfile, error: profileError } = await admin.from("profiles")
          .select("user_id,business_id,role,display_name,is_active,created_at")
          .eq("user_id",invited.user.id).eq("business_id",body.businessId).single();
        if (profileError || !attachedProfile) return json(request,{ok:false,code:"service_unavailable"},503);
        await recordEvent("invite",invited.user.id,"success");
        return json(request,{ok:true,accessMode:"invited",user:await userView(attachedProfile as Profile)},201);
      }
    }
    if (link.error) {
      const mapped = code(link.error);
      await recordEvent("invite",null,"failed",mapped);
      return json(request,{ok:false,code:mapped},errorStatus(mapped));
    }
    const { data: linkedProfile, error: profileError } = await admin.from("profiles")
      .select("user_id,business_id,role,display_name,is_active,created_at")
      .eq("user_id",(link.data as {userId?: string})?.userId ?? "").eq("business_id",body.businessId).single();
    if (profileError || !linkedProfile) return json(request,{ok:false,code:"service_unavailable"},503);
    await recordEvent("invite",linkedProfile.user_id,"success");
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
      await recordEvent("provision",null,"failed",mapped);
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
      await recordEvent("provision",null,"failed",mapped);
      return json(request,{ok:false,code:mapped},errorStatus(mapped));
    }
    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("user_id,business_id,role,display_name,is_active,created_at")
      .eq("user_id",created.user.id).eq("business_id",body.businessId).single();
    if (profileError || !profile) return json(request,{ok:false,code:"service_unavailable"},503);
    await recordEvent("provision",created.user.id,"success");
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
    await recordEvent("update",body.userId!,"failed",mapped);
    return json(request,{ok:false,code:mapped},errorStatus(mapped));
  }
  const { data: updatedProfile, error: profileError } = await admin.from("profiles")
    .select("user_id,business_id,role,display_name,is_active,created_at")
    .eq("user_id",body.userId!).eq("business_id",body.businessId).single();
  if (profileError || !updatedProfile) return json(request,{ok:false,code:"service_unavailable"},503);
  await recordEvent("update",body.userId!,"success");
  return json(request,{ok:true,user:await userView(updatedProfile as Profile)});
});
