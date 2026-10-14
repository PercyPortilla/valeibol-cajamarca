import assert from "node:assert/strict";
import test from "node:test";
import {
  adminRoleLabel,
  decideAdminAccess,
  isAdminRole,
  safeAdminRedirectPath,
} from "../lib/auth.ts";
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
