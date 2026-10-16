import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const login = readFileSync("components/admin/AdminLoginForm.tsx", "utf8");
const configuration = readFileSync("app/admin/(protected)/configuracion/page.tsx", "utf8");

test("el login administrativo usa contraseÃ±a y recuperaciÃ³n, sin Magic Link", () => {
  assert.match(login, /signInWithPassword/);
  assert.match(login, /resetPasswordForEmail/);
  assert.equal(login.includes("signInWithOtp"), false);
  assert.equal(login.includes("Recibir enlace de acceso por correo"), false);
});

test("ConfiguraciÃ³n muestra Mi cuenta a todos y Usuarios y accesos solo al owner", () => {
  assert.match(configuration, /<AdminAccountSecurity/);
  assert.match(configuration, /context\.role === "owner"[\s\S]*<AdminAccessManagement/);
});

