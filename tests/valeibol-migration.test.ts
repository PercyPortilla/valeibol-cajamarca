import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = readFileSync("app/page.tsx", "utf8");
const complex = readFileSync("app/complejo/[slug]/page.tsx", "utf8");
const legacy = readFileSync("components/site/ValeibolLanding.tsx", "utf8");

test("la raíz ahora es marketplace global y no la landing exclusiva de Valeibol", () => {
  assert.match(root, /PlatformSearchForm/);
  assert.match(root, /getPublicPlatformCatalog/);
  assert.match(root, /PARA PROPIETARIOS/);
  assert.doesNotMatch(root, /CourtVisual/);
});

test("landing histórica de Valeibol se conserva en su slug", () => {
  assert.match(complex, /slug === businessConfig\.slug/);
  assert.match(complex, /<ValeibolLanding/);
  for (const legacySection of ["#disponibilidad", "Servicios incluidos", "Tarifas por hora", "Conoce nuestras instalaciones", "Encuéntranos en Cajamarca"]) {
    assert.ok(legacy.includes(legacySection), `Falta contenido heredado: ${legacySection}`);
  }
});

test("la landing Valeibol conserva disponibilidad y contacto existentes", () => {
  assert.match(legacy, /<AvailabilityCalendar/);
  assert.match(legacy, /businessConfig\.phone/);
  assert.match(legacy, /businessConfig\.address/);
});
