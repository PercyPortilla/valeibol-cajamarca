import assert from "node:assert/strict";
import test from "node:test";
import {
  adminRoleLabel,
  decideAdminAccess,
  isAdminRole,
  safeAdminRedirectPath,
  safeAuthRedirectPath,
} from "../lib/auth.ts";
import {
  hostnameFromHostHeader,
  isLocalDevAdminAllowed,
  isLocalDevHostname,
  validateLocalDevAdminCredentials,
} from "../lib/auth/localDev.ts";
import {
  ADMIN_RESERVATION_STATUSES,
  canReadAdminReservations,
  formatAdminDateTime,
  lightingLabel,
  reservationStatusLabel,
  reservationStatusTone,
} from "../lib/admin/reservations.ts";

test("rechaza acceso admin cuando Supabase no está configurado", () => {
  assert.equal(decideAdminAccess({ hasSupabaseConfig: false, userId: null }), "unconfigured");
});

test("rechaza visitante anónimo o sesión expirada", () => {
  assert.equal(decideAdminAccess({ hasSupabaseConfig: true, userId: null }), "unauthenticated");
});

test("rechaza usuario autenticado sin perfil/rol válido", () => {
  assert.equal(decideAdminAccess({ hasSupabaseConfig: true, userId: "u1", role: null, isProfileActive: false }), "unauthorized");
  assert.equal(decideAdminAccess({ hasSupabaseConfig: true, userId: "u1", role: "viewer", isProfileActive: true }), "unauthorized");
});

test("owner, admin y staff activos son roles de lectura autorizados", () => {
  for (const role of ["owner", "admin", "staff"] as const) {
    assert.equal(isAdminRole(role), true);
    assert.equal(decideAdminAccess({ hasSupabaseConfig: true, userId: "u1", role, isProfileActive: true }), "authorized");
    assert.equal(canReadAdminReservations(role), true);
  }
  assert.equal(adminRoleLabel("owner"), "Propietario");
});

test("next de login evita open redirects y rutas de bucle", () => {
  assert.equal(safeAdminRedirectPath("/admin/reservas"), "/admin/reservas");
  assert.equal(safeAdminRedirectPath("https://evil.example/admin"), "/admin");
  assert.equal(safeAdminRedirectPath("//evil.example/admin"), "/admin");
  assert.equal(safeAdminRedirectPath("/public"), "/admin");
  assert.equal(safeAdminRedirectPath("/admin/login"), "/admin");
});

test("callback de auth permite mi-cuenta sin abrir redirects externos", () => {
  assert.equal(safeAuthRedirectPath("/mi-cuenta"), "/mi-cuenta");
  assert.equal(safeAuthRedirectPath("/mi-cuenta?tab=reservas"), "/mi-cuenta?tab=reservas");
  assert.equal(safeAuthRedirectPath("//evil.example/mi-cuenta"), "/admin");
  assert.equal(safeAuthRedirectPath("https://evil.example/mi-cuenta"), "/admin");
});

test("el acceso admin local solo funciona en desarrollo y localhost", () => {
  assert.equal(isLocalDevHostname("localhost"), true);
  assert.equal(isLocalDevHostname("127.0.0.1"), true);
  assert.equal(isLocalDevHostname("192.168.1.10"), false);
  assert.equal(hostnameFromHostHeader("localhost:3000"), "localhost");
  assert.equal(isLocalDevAdminAllowed({ nodeEnv: "development", hostname: "localhost" }), true);
  assert.equal(isLocalDevAdminAllowed({ nodeEnv: "production", hostname: "localhost" }), false);
  assert.equal(isLocalDevAdminAllowed({ nodeEnv: "development", hostname: "example.com" }), false);
});

test("las credenciales locales admin/12345 no habilitan producción", () => {
  assert.equal(validateLocalDevAdminCredentials({ nodeEnv: "development", hostname: "localhost", username: "admin", password: "12345" }), true);
  assert.equal(validateLocalDevAdminCredentials({ nodeEnv: "development", hostname: "localhost", username: "admin", password: "incorrecta" }), false);
  assert.equal(validateLocalDevAdminCredentials({ nodeEnv: "production", hostname: "localhost", username: "admin", password: "12345" }), false);
});

test("mapea los cuatro estados del modelo sin inventar estados nuevos", () => {
  assert.deepEqual(ADMIN_RESERVATION_STATUSES, ["pending", "confirmed", "cancelled", "completed"]);
  assert.equal(reservationStatusLabel("pending"), "Pendiente");
  assert.equal(reservationStatusLabel("confirmed"), "Confirmada");
  assert.equal(reservationStatusLabel("cancelled"), "Cancelada");
  assert.equal(reservationStatusLabel("completed"), "Completada");
  assert.equal(reservationStatusTone("cancelled"), "danger");
});

test("formatea reservas usando America/Lima", () => {
  const formatted = formatAdminDateTime("2026-10-20T23:00:00.000Z", "America/Lima");
  assert.match(formatted.toLowerCase(), /20/);
  assert.match(formatted.toLowerCase(), /06:00|6:00/);
});

test("etiqueta modalidad sin alterar la tarifa autoritativa", () => {
  assert.equal(lightingLabel("without_lights"), "Sin luz");
  assert.equal(lightingLabel("with_lights"), "Con luz");
});

