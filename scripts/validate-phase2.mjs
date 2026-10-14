import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const calendar = read("components/availability/AvailabilityCalendar.tsx");
const page = read("app/page.tsx");
const config = read("config/business.ts");
const css = read("app/globals.css");
const preview = read("preview/index.html");
const previewJs = read("preview/app.js");
const publicSource = [calendar, page, preview, previewJs].join("\n");

for (const forbidden of ["Percy Portilla", "Mery", "ACDM", "DOC", "customerName", "cliente_nombre"]) {
  assert.equal(publicSource.includes(forbidden), false, `No debe aparecer dato/nombre privado: ${forbidden}`);
}

assert.match(calendar, /slot\.status === "available" \? <ReservationCta/);
assert.match(calendar, /occupied: "Ocupado"/);
assert.match(calendar, /unavailable: "No disponible"/);
assert.match(calendar, /available: "Disponible"/);
assert.match(config, /withoutLights: 35/);
assert.match(config, /withLights: 60/);
assert.match(config, /scheduleSource: "mock-provisional"/);
assert.match(css, /grid-template-columns: repeat\(7, minmax\(0, 1fr\)\)/);
assert.match(css, /@media \(max-width: 899px\)/);
assert.match(css, /@media \(max-width: 430px\)/);
assert.match(css, /@media \(max-width: 360px\)/);
assert.equal((css.match(/{/g) ?? []).length, (css.match(/}/g) ?? []).length, "CSS desbalanceado");

for (const id of ["disponibilidad", "precios", "servicios", "ubicacion", "contacto", "desktopWeek", "mobileDays", "mobileSlots"]) {
  assert.ok(preview.includes(`id="${id}"`), `Falta ID en preview: ${id}`);
}

console.log("QA Fase 2: PASS");
console.log("- privacidad pública verificada");
console.log("- CTA condicionado a disponible");
console.log("- tarifas 35/60 centralizadas");
console.log("- horario marcado como mock-provisional");
console.log("- desktop 7 columnas + breakpoints mobile detectados");
console.log("- preview contiene secciones e IDs críticos");
