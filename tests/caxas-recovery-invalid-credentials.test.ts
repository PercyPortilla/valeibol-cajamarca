import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const login=readFileSync("components/admin/AdminLoginForm.tsx","utf8");
const activation=readFileSync("components/admin/AdminInviteActivation.tsx","utf8");
const browser=readFileSync("lib/data/supabase/browser.ts","utf8");
const activationPage=readFileSync("app/admin/activar/page.tsx","utf8");
const proxy=readFileSync("proxy.ts","utf8");

test("login distingue credenciales inválidas de problemas de autorización sin revelar existencia de cuentas",()=>{
  assert.match(login,/error\.code === "invalid_credentials"/);
  assert.match(login,/El correo o la contraseña no coinciden/);
  assert.match(login,/Olvidé mi contraseña/);
  assert.doesNotMatch(login,/auth\.admin\.updateUserById/);
});

test("recuperación usa enlace de activación en origen actual y mantiene tenant validado",()=>{
  assert.match(login,/new URL\("\/admin\/activar", window\.location\.origin\)/);
  assert.match(login,/recoveryPage\.searchParams\.set\("recovery",\s*"1"\)/);
  assert.match(login,/safeTenantAdminRedirectPath\(requested\)/);
  assert.match(login,/resetPasswordForEmail\(normalizedEmail/);
  assert.match(login,/redirectTo: recoveryPage\.toString\(\)/);
  assert.doesNotMatch(login,/valeibol-cajamarca-live\.vercel\.app/);
});

test("el enlace de recuperación exige prueba del correo y no autoriza por una sesión anterior",()=>{
  assert.match(activation,/recoveryFlow && !code && !\(accessToken && refreshToken\)/);
  assert.match(activation,/auth\.exchangeCodeForSession\(code\)/);
  assert.match(activation,/auth\.setSession\(/);
  assert.match(activation,/auth\.getUser\(\)/);
  assert.match(activation,/data\.user\.id !== linkUserId/);
  assert.match(activation,/createPublicBrowserSupabaseClient\(\{manualLinkExchange:true\}\)/);
  assert.match(browser,/isSingleton: false, auth: \{ detectSessionInUrl: false \}/);
  assert.match(proxy,/\/admin\/activar/);
});

test("solo un updateUser exitoso confirma contraseña cambiada y lleva a nuevo login",()=>{
  assert.match(activation,/if \(password\.length < \(isRecovery \? 12 : 8\)\)/);
  assert.match(activation,/auth\.updateUser\(\{ password \}\)/);
  assert.match(activation,/if \(error\) \{/);
  assert.match(activation,/if \(isRecovery\) \{/);
  assert.match(activation,/await supabase\.auth\.signOut\(\{scope:"local"\}\)/);
  assert.match(activation,/login\.searchParams\.set\("reason","password-updated"\)/);
  assert.match(login,/Contraseña actualizada\. Entra con tu correo/);
  assert.match(activationPage,/Configura o recupera tu contraseña/);
});
