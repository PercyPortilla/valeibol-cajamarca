import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (file: string) => readFileSync(file, "utf8");
const structure = read("components/admin/AdminBusinessStructureManager.tsx");
const pricing = read("components/admin/AdminPricingForm.tsx");
const hours = read("components/admin/AdminCourtHoursEditor.tsx");
const sports = read("components/admin/AdminCourtSportSettings.tsx");
const adminPage = read("app/admin/(protected)/configuracion/estructura/page.tsx");
const adminPricing = read("app/admin/(protected)/precios/page.tsx");

test("acceso a panel y mutaciones dependen de sesión/rol, no de la página pública", () => {
  assert.match(adminPage, /requireAdminContext\(\)/);
  assert.match(adminPage, /context\.role === "owner" \|\| context\.role === "admin"/);
  assert.match(adminPricing, /requireAdminContext\(\)/);
  assert.match(structure, /if \(!canManage \|\| localMode \|\| businessBusy\) return/);
  assert.match(structure, /if \(!canManage \|\| busy\) return/);
  assert.match(pricing, /canPerformPhase7Operation\(role, "manage_pricing"\)/);
  assert.match(sports, /loadedCourtId !== courtId/);
  assert.match(sports, /admin_update_court_sport_settings/);
});

test("errores de red dejan recuperar operaciones sin duplicar acciones", () => {
  assert.match(pricing, /catch \{/);
  assert.match(pricing, /code: "network"/);
  assert.match(hours, /Se interrumpió la conexión al guardar/);
  assert.match(hours, /finally \{\s*setBusy\(false\)/);
  for (const marker of ["setBusinessBusy(false)", "setVenueCreateBusy(false)", "setCourtCreateBusy(false)", "setBookingBusy(false)", "setPublicationBusy(false)", "setStructureBusy(false)"]) {
    assert.ok(structure.includes(marker), marker);
  }
  assert.match(structure, /Verifica los datos de la cancha antes de reintentar/);
  assert.match(structure, /No se pudo confirmar la creación/);
});

test("admin expone distinción de direcciones y sincroniza formularios tras refrescar", () => {
  assert.match(structure, /La ficha del negocio y cada sede tienen direcciones independientes/);
  assert.match(structure, /La dirección del negocio no coincide con la sede/);
  assert.match(structure, /role="alert"/);
  assert.match(structure, /setAddress\(venue\.address \?\? ""\)/);
  assert.match(structure, /setActive\(venue\.isActive\)/);
  assert.match(structure, /setName\(court\.name\)/);
  assert.match(structure, /key=\{`\$\{structure\.name\}/);
});
