import { createClient } from "npm:@supabase/supabase-js@2.117.3";

// Se usa únicamente para sustituir una clave temporal antes de habilitar un
// perfil tenant. No acepta businessId ni userId del cliente: ambos se derivan
// del JWT validado y de app_metadata creada por el ADMIN global.
const ALLOWED_ORIGINS = new Set([
  "https://caxas-sportcenter.vercel.app",
  "https://valeibol-cajamarca-live.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);
const CORS_REQUEST_HEADERS = [
  "authorization", "apikey", "content-type", "x-client-info",
  "x-retry-count", "traceparent", "tracestate", "baggage",
  "x-supabase-client-platform", "x-supabase-client-platform-version",
  "x-supabase-client-runtime", "x-supabase-client-runtime-version",
].join(", ");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function cors(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return { "access-control-allow-origin": origin,
    "access-control-allow-headers": CORS_REQUEST_HEADERS,
    "access-control-allow-methods": "POST, OPTIONS", vary: "Origin" };
}
function json(req: Request, value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: {
    ...cors(req), "content-type": "application/json; charset=utf-8", "cache-control": "no-store",
  }});
}
function secret() {
  const single = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim()
    || Deno.env.get("SUPABASE_SECRET_KEY")?.trim();
  if (single) return single;
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string,string>;
    return keys.default || Object.values(keys).find(Boolean) || null;
  } catch { return null; }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null,{status:204,headers:cors(request)});
  if (request.method !== "POST") return json(request,{ok:false,code:"method_not_allowed"},405);
  const origin = request.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(request,{ok:false,code:"invalid_origin"},403);
  const url = Deno.env.get("SUPABASE_URL")?.trim(),key = secret();
  if (!url || !key) return json(request,{ok:false,code:"configuration"},503);
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json(request,{ok:false,code:"authentication_required"},401);

  let value: unknown;
  try {
    if (Number(request.headers.get("content-length") ?? 0)>1000) {
      return json(request,{ok:false,code:"payload_too_large"},413);
    }
    value = await request.json();
  } catch { return json(request,{ok:false,code:"invalid_payload"},400); }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return json(request,{ok:false,code:"invalid_payload"},400);
  }
  const input = value as Record<string,unknown>;
  if (Object.keys(input).some((k)=>k!=="newPassword")
    || typeof input.newPassword!=="string"
    || input.newPassword.length<12 || input.newPassword.length>128
    || !/[A-Za-z]/.test(input.newPassword) || !/[0-9]/.test(input.newPassword)) {
    return json(request,{ok:false,code:"weak_password"},422);
  }

  const admin = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {data:verified,error:verifyError}=await admin.auth.getUser(token);
  if (verifyError || !verified.user) return json(request,{ok:false,code:"authentication_required"},401);
  const user=verified.user;
  const businessId=user.app_metadata?.platform_tenant_temp;
  if (typeof businessId!=="string" || !UUID.test(businessId)) {
    return json(request,{ok:false,code:"temporary_access_not_pending"},403);
  }
  const {data:profile,error:profileError}=await admin.from("profiles")
    .select("user_id,business_id,role,is_active")
    .eq("user_id",user.id).eq("business_id",businessId).maybeSingle();
  if (profileError) return json(request,{ok:false,code:"service_unavailable"},503);
  if (!profile || profile.is_active || !["owner","admin","staff"].includes(profile.role)) {
    return json(request,{ok:false,code:"temporary_access_not_pending"},403);
  }
  const {data:account,error:accountError}=await admin.from("user_accounts")
    .select("role,is_active").eq("user_id",user.id).maybeSingle();
  if (accountError) return json(request,{ok:false,code:"service_unavailable"},503);
  if (!account || !account.is_active || account.role==="admin") {
    return json(request,{ok:false,code:"temporary_access_not_pending"},403);
  }

  // Después del cambio de contraseña, y solo después, se habilita el perfil.
  // Si el UPDATE de perfil falla, la marca temporal continúa y podrá reintentar
  // iniciando sesión con su nueva contraseña.
  const {error:passwordError}=await admin.auth.admin.updateUserById(user.id,{
    password:input.newPassword,
  });
  if (passwordError) return json(request,{ok:false,code:"password_rejected"},422);

  const {data:activated,error:activationError}=await admin.from("profiles")
    .update({is_active:true}).eq("user_id",user.id).eq("business_id",businessId)
    .eq("is_active",false).select("user_id").maybeSingle();
  if (activationError || !activated) return json(request,{ok:false,code:"activation_retry"},503);

  const metadata={...user.app_metadata};
  delete metadata.platform_tenant_temp;
  const {error:metadataError}=await admin.auth.admin.updateUserById(user.id,{app_metadata:metadata});
  if (metadataError) {
    // No dejar el usuario activo si no se puede retirar la marca temporal.
    const {error:rollbackError}=await admin.from("profiles").update({is_active:false})
      .eq("user_id",user.id).eq("business_id",businessId);
    if (rollbackError) console.error("[platform-temporary-activation] rollback failed",rollbackError.code);
    return json(request,{ok:false,code:"activation_retry"},503);
  }
  return json(request,{ok:true,code:"activated"});
});
