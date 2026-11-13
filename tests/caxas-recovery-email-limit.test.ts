import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { passwordRecoveryFailure } from "../lib/auth/passwordRecoveryFeedback.ts";

const login = readFileSync("components/admin/AdminLoginForm.tsx", "utf8");

test("Supabase 429 over_email_send_rate_limit se explica y no se confunde con correo inválido", () => {
  const feedback = passwordRecoveryFailure({
    code: "over_email_send_rate_limit",
    status: 429,
  });
  assert.equal(feedback.kind, "email_rate_limit");
  assert.match(feedback.message, /límite de envíos/);
  assert.match(feedback.message, /No se generó un nuevo correo/);
  assert.match(feedback.message, /SMTP propio/);
  assert.doesNotMatch(feedback.message, /contraseña incorrecta/i);
});

test("la recuperación controla otros límites 429 y restricciones del SMTP predeterminado", () => {
  assert.equal(passwordRecoveryFailure({status:429}).kind, "email_rate_limit");
  assert.equal(passwordRecoveryFailure({code:"over_request_rate_limit"}).kind, "email_rate_limit");
  const restricted = passwordRecoveryFailure({code:"email_address_not_authorized",status:403});
  assert.equal(restricted.kind, "email_recipient_restricted");
  assert.match(restricted.message,/proveedor SMTP propio/);
});

test("errores no clasificados no exponen existencia de cuentas", () => {
  const feedback=passwordRecoveryFailure({code:"unknown_auth_error",status:500});
  assert.equal(feedback.kind,"other");
  assert.doesNotMatch(feedback.message,/registrada|existe la cuenta/i);
});

test("el login muestra el motivo real que devuelve Supabase en vez del aviso genérico", () => {
  assert.match(login,/passwordRecoveryFailure\(error\)/);
  assert.match(login,/setMessage\(feedback\.message\)/);
  assert.match(login,/resetPasswordForEmail\(normalizedEmail/);
});
