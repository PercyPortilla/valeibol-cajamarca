import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const authForm = readFileSync("components/account/CustomerAuthForm.tsx", "utf8");
const recoveryForm = readFileSync("components/account/CustomerPasswordRecoveryForm.tsx", "utf8");
const recoveryPage = readFileSync("app/mi-cuenta/recuperar/page.tsx", "utf8");
const callback = readFileSync("app/auth/callback/route.ts", "utf8");
const auth = readFileSync("lib/auth.ts", "utf8");
const proxy = readFileSync("proxy.ts", "utf8");

test("B35 permite solicitar recuperación sin revelar si el correo existe", () => {
  assert.match(authForm, /resetPasswordForEmail/);
  assert.match(authForm, /callback\.searchParams\.set\("next", "\/mi-cuenta\/recuperar"\)/);
  assert.match(authForm, /Si el correo corresponde a una cuenta habilitada/);
  assert.match(authForm, /Olvidé mi contraseña/);
  assert.doesNotMatch(authForm, /correo no existe|cuenta no encontrada/i);
});

test("B35 actualiza solo la contraseña de la sesión recuperada", () => {
  assert.match(recoveryForm, /updateUser\(\{ password \}\)/);
  assert.match(recoveryForm, /password\.length < 8/);
  assert.match(recoveryForm, /password !== confirmPassword/);
  assert.match(recoveryForm, /Contraseña actualizada correctamente/);
  assert.doesNotMatch(recoveryForm, /userId|businessId|service_role/i);
});

test("la ruta de recuperación exige una sesión Auth válida antes de mostrar el formulario", () => {
  assert.match(recoveryPage, /createServerSupabaseClient/);
  assert.match(recoveryPage, /supabase\.auth\.getUser\(\)/);
  assert.match(recoveryPage, /hasRecoverySession/);
  assert.match(recoveryPage, /no es válido, ya expiró/i);
  assert.match(recoveryPage, /robots: \{ index: false, follow: false \}/);
});

test("callback y redirects mantienen la recuperación dentro de Mi cuenta", () => {
  assert.match(callback, /safeAuthRedirectPath/);
  assert.match(auth, /normalized\.pathname\.startsWith\("\/mi-cuenta\/"\)/);
  assert.match(auth, /!candidate\.startsWith\("\/\/"\)/);
  assert.match(auth, /!candidate\.includes\(":\/\/"\)/);
  assert.match(proxy, /\/mi-cuenta\/:path\*/);
});

