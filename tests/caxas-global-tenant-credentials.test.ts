import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=(name:string)=>readFileSync(name,"utf8");
const sql=read("supabase/migrations/20261113174212_global_team_temporary_credentials_hardening.sql");
const edge=read("supabase/functions/platform-business-access/index.ts");
const activation=read("supabase/functions/platform-temporary-activation/index.ts");
const ui=read("components/platform-admin/GlobalBusinessTeamPanel.tsx");
const activateUi=read("components/admin/AdminInviteActivation.tsx");

test("la RPC de usuarios Auth funciona con definidor pero jamás con grants públicos",()=>{
  assert.match(sql,/alter function public\.platform_admin_team_link_email\(uuid,uuid,text,public\.app_role,text\)\s+security definer/i);
  assert.match(sql,/alter function public\.platform_admin_team_attach\(uuid,uuid,uuid,public\.app_role,text\)\s+security definer/i);
  for(const operation of ["platform_admin_team_attach","platform_admin_team_link_email","platform_admin_team_update","platform_admin_team_attach_pending"]){
    assert.match(sql,new RegExp(`revoke all on function public\\.${operation}\\([\\s\\S]*?\\)\\s+from public, anon, authenticated`));
    assert.match(sql,new RegExp(`grant execute on function public\\.${operation}\\([\\s\\S]*?\\)\\s+to service_role`));
  }
  assert.doesNotMatch(sql,/grant\s+(select|update)\s+on\s+auth\.users/i);
  assert.match(sql,/perform public\.platform_admin_team_assert\(p_actor_id,p_business_id\)/);
});

test("el alta con clave provisional genera contraseña en el servidor, no en el navegador",()=>{
  assert.match(edge,/crypto\.getRandomValues\(new Uint8Array\(24\)\)/);
  assert.match(edge,/auth\.admin\.createUser\(/);
  assert.match(edge,/platform_admin_team_attach_pending/);
  assert.match(edge,/platform_tenant_temp: body\.businessId/);
  assert.match(edge,/temporaryPassword:password/);
  assert.match(edge,/admin\.auth\.admin\.deleteUser\(created\.user\.id\)/);
  assert.doesNotMatch(ui,/createUser\(/);
  assert.doesNotMatch(ui,/service_role/i);
  assert.match(ui,/Crear con clave temporal/);
  assert.match(ui,/Ocultar clave definitivamente/);
  assert.match(ui,/users\.some\(\(user\)=>user\.email\.trim\(\)\.toLowerCase\(\)===normalizedEmail\)/);
});

test("la cuenta queda sin autorización hasta sustituir la clave temporal",()=>{
  assert.match(sql,/values\(p_target_user_id,p_business_id,p_role,v_name,false\)/);
  assert.match(sql,/pending_password_activation/);
  assert.match(activation,/admin\.auth\.getUser\(token\)/);
  assert.match(activation,/app_metadata\?\.platform_tenant_temp/);
  assert.match(activation,/if \(!profile \|\| profile\.is_active/);
  assert.match(activation,/admin\.auth\.admin\.updateUserById\(user\.id,\{\s*password:input\.newPassword/);
  assert.match(activation,/\.update\(\{is_active:true\}\)/);
  assert.match(activation,/delete metadata\.platform_tenant_temp/);
  assert.match(activation,/rollbackError/);
  assert.match(activateUi,/signInWithPassword/);
  assert.match(activateUi,/platform-temporary-activation/);
  assert.match(activateUi,/password === temporaryPassword/);
  assert.match(activateUi,/supabase\.auth\.signOut\(\)/);
});

test("permisos globales están vinculados a roles reales, nunca a checkboxes decorativos",()=>{
  assert.match(ui,/const ROLE_PERMISSIONS: Record<Role,string>/);
  assert.match(ui,/"owner" \| "admin" \| "staff"/);
  assert.match(ui,/action:"update",businessId/);
  assert.match(edge,/account\.role !== "admin"/);
  assert.match(edge,/platform_admin_team_assert/);
  assert.match(sql,/primary_owner_transfer_required/);
  assert.doesNotMatch(ui,/"global_admin"|"super_admin"/);
});

test("ambas Edge Functions permiten la comprobación CORS de Supabase con reintentos y trazas",()=>{
  for (const source of [edge,activation]) {
    assert.match(source,/https:\/\/caxas-sportcenter-jan1diaz-5594\.vercel\.app/);
    assert.match(source,/https:\/\/caxas-sportcenter-git-main-jan1diaz-5594\.vercel\.app/);
    assert.match(source,/"x-retry-count"/);
    assert.match(source,/"traceparent"/);
    assert.match(source,/"tracestate"/);
    assert.match(source,/"baggage"/);
    assert.match(source,/"x-supabase-client-platform"/);
    assert.match(source,/"access-control-allow-headers": CORS_REQUEST_HEADERS/);
    assert.match(source,/access-control-allow-origin/);
    assert.match(source,/!ALLOWED_ORIGINS\.has\(origin\)|!ORIGINS\.has\(origin\)/);
    assert.doesNotMatch(source,/"access-control-allow-origin": "\*"/);
  }
});
