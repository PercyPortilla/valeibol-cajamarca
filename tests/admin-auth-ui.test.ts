import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const login = readFileSync("components/admin/AdminLoginForm.tsx", "utf8");
const configuration = readFileSync("app/admin/(protected)/configuracion/page.tsx", "utf8");
const activation = readFileSync("components/admin/AdminInviteActivation.tsx", "utf8");
const proxy = readFileSync("proxy.ts", "utf8");
const accessEdge = readFileSync("supabase/functions/admin-access-management/index.ts", "utf8");

test("el login administrativo usa contraseña y recuperación, sin Magic Link", () => {
  assert.match(login, /signInWithPassword/);
  assert.match(login, /resetPasswordForEmail/);
  assert.equal(login.includes("signInWithOtp"), false);
  assert.equal(login.includes("Recibir enlace de acceso por correo"), false);
});

test("Configuración muestra Mi cuenta a todos y Usuarios y accesos solo al owner", () => {
  assert.match(configuration, /<AdminAccountSecurity/);
  assert.match(configuration, /context\.role === "owner"[\s\S]*<AdminAccessManagement/);
});

test("las invitaciones usan activación separada y obligan a crear contraseña", () => {
  assert.match(accessEdge, /\/admin\/activar/);
  assert.match(activation, /setSession/);
  assert.match(activation, /exchangeCodeForSession/);
  assert.match(activation, /updateUser\(\{ password \}\)/);
  assert.match(proxy, /\/admin\/activar/);
  assert.match(accessEdge, /auth\.admin\.deleteUser\(invitedUser\.id\)/);
});



