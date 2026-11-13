import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=(path:string)=>readFileSync(path,"utf8");
const edge=read("supabase/functions/platform-business-access/index.ts");
const sql=read("supabase/migrations/20261113215912_platform_team_access_audit.sql");
const ui=read("components/platform-admin/GlobalBusinessTeamPanel.tsx");
const login=read("components/admin/AdminLoginForm.tsx");

test("B: un fallo de Auth individual no elimina la lista ni permite altas con datos incompletos",()=>{
  assert.match(edge,/Promise\.allSettled\(/);
  assert.match(edge,/partial:unavailableCount>0/);
  assert.match(edge,/totalProfiles:results\.length/);
  assert.match(ui,/setPartialCount\(result\.partial/);
  assert.match(ui,/partialCount>0/);
  assert.match(ui,/No crees accesos nuevos mientras esta lista sea parcial/);
  assert.match(ui,/users\.some\(\(user\)=>user\.email\.trim\(\)\.toLowerCase\(\)===normalizedEmail\)/);
  assert.match(ui,/client\.auth\.getSession\(\)/);
  assert.match(ui,/ctx\.status===401 \? "authentication_required"/);
  assert.match(ui,/Volver a iniciar sesión/);
});

test("B: se distingue verificación de correo, autorización y sesión real",()=>{
  assert.match(ui,/Correo verificado · perfil habilitado/);
  assert.match(ui,/Correo verificado · perfil suspendido/);
  assert.match(ui,/Invitación pendiente · correo aún no verificado/);
  assert.match(ui,/Último inicio registrado/);
  assert.doesNotMatch(ui,/"Cuenta registrada"/);
  assert.match(login,/correo electrónico autorizado/);
  assert.match(login,/resetPasswordForEmail/);
  assert.doesNotMatch(login,/window\.location\.hostname === "caxas-sportcenter\.vercel\.app"/);
});

test("C: restauración administrativa exige rol global, pertenencia al negocio y doble verificación",()=>{
  assert.match(edge,/account\.role !== "admin"/);
  assert.match(edge,/platform_admin_team_assert/);
  assert.match(edge,/\.eq\("business_id",body\.businessId\)\.eq\("user_id",body\.userId!\)/);
  assert.match(edge,/admin\.auth\.admin\.getUserById\(body\.userId!\)/);
  assert.match(edge,/if \(body\.action === "recover" && !profile\.is_active\)/);
  assert.match(edge,/platform_tenant_temp/);
  assert.match(edge,/auth\.resetPasswordForEmail\(/);
  assert.doesNotMatch(edge,/auth\.admin\.updateUserById\(body\.userId!/);
});

test("C: reemisión envía el correo al titular, nunca da un token de inicio al administrador",()=>{
  assert.match(edge,/body\.action === "invitation_link"/);
  assert.match(edge,/auth\.signInWithOtp\(/);
  assert.match(edge,/shouldCreateUser:false/);
  assert.match(ui,/Reenviar activación por correo/);
  assert.match(ui,/window\.confirm\("¿Solicitar otro correo de activación/);
  assert.doesNotMatch(edge,/auth\.admin\.generateLink\(/);
  assert.doesNotMatch(edge,/actionLink|temporaryLink|magicLink/);
});

test("C: auditoría por tenant sin credenciales expuestas y anti-abuso atómico",()=>{
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/revoke all on table public\.platform_team_access_audit from public, anon, authenticated/i);
  assert.match(sql,/grant select, insert, update on table public\.platform_team_access_audit to service_role/i);
  assert.match(sql,/create unique index if not exists platform_team_access_audit_cooldown/i);
  assert.match(sql,/cooldown_slot is not null/i);
  assert.match(edge,/\.eq\("business_id",body\.businessId\)/);
  assert.match(edge,/\.limit\(40\)/);
  assert.match(edge,/eventError\?\.code==="23505"/);
  assert.match(edge,/recordEvent\("update",body\.userId!,"success"\)/);
  assert.doesNotMatch(sql,/\b(password|access_token|refresh_token|action_link)\b\s+(text|varchar)/i);
});
