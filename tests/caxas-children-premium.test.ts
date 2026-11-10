import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const childStyles = readFileSync("app/styles/caxas-children-premium-2026.css", "utf8");
const globalStyles = readFileSync("app/globals.css", "utf8");
const valeibol = readFileSync("components/site/ValeibolLanding.tsx", "utf8");
const header = readFileSync("components/site/Header.tsx", "utf8");
const footer = readFileSync("components/site/Footer.tsx", "utf8");
const calendar = readFileSync("components/availability/AvailabilityCalendar.tsx", "utf8");
const complex = readFileSync("app/complejo/[slug]/page.tsx", "utf8");
const reservation = readFileSync("app/reservar/page.tsx", "utf8");
const tenantAdmin = readFileSync("components/admin/AdminShell.tsx", "utf8");

test("Caxas hijas utiliza hoja aislada después de la portada, sin editar lógica 3D", () => {
  assert.match(globalStyles, /caxas-premium-2026\.css";\s*@import "\.\/styles\/caxas-children-premium-2026\.css"/);
  for (const scope of [
    ".platform-public-premium--complex",
    ".platform-public-premium--reservation",
    ".site-theme--caxas-child",
    ".global-admin-page",
    ".auth-page--caxas",
    ".admin-shell",
  ]) {
    assert.ok(childStyles.includes(scope), `Falta scope de estilo: ${scope}`);
  }
  assert.doesNotMatch(childStyles, /\.platform-sport-diorama|\.platform-home\s*\{/);
});

test("Valeibol respeta servicios y galería ocultos y unifica contacto público", () => {
  assert.match(valeibol, /siteContent\.source === "default" \? \[/);
  assert.match(valeibol, /\] : configuredGalleryItems/);
  assert.match(valeibol, /\{services\.length > 0 \? <section/);
  assert.match(valeibol, /\{galleryItems\.length > 0 \? <section/);
  assert.match(header, /showGallery \? <a href="#galeria">/);
  assert.match(footer, /showGallery \? <a href="#galeria">/);
  assert.match(valeibol, /const phoneE164 = publicContact\.phoneE164/);
  assert.match(footer, /buildWhatsAppChatHref\(phoneE164/);
  assert.doesNotMatch(footer, /businessConfig\.phone/);
  assert.doesNotMatch(valeibol, /businessConfig\.phone/);
});

test("Navegación de agenda evita semanas pasadas y tabs sin panel vinculado", () => {
  assert.match(calendar, /if \(startOfWeekMonday\(nextReference\) < startOfWeekMonday\(today\)\) return/);
  assert.match(calendar, /disabled=\{!canGoToPreviousWeek\}/);
  assert.match(calendar, /aria-controls=\{isSelected \? dayPanelId\(day\.date\) : undefined\}/);
});

test("Fichas y consultas explican que WhatsApp no crea una reserva", () => {
  assert.match(complex, /Contactar por WhatsApp/);
  assert.match(complex, /Consultar horarios/);
  assert.match(complex, /id="canchas"/);
  assert.match(reservation, /Abrir WhatsApp inicia una conversación, no crea una reserva automáticamente/);
  assert.match(reservation, /El negocio confirma horario y tarifa por WhatsApp/);
  assert.match(reservation, /AvailabilityCalendar/);
});

test("Consola tenant sigue usando su configuración de marca dinámica", () => {
  assert.match(tenantAdmin, /themeCssVariables\(theme\)/);
  assert.match(childStyles, /\.admin-shell \.admin-status-card/);
  assert.match(childStyles, /var\(--brand-border\)/);
  assert.doesNotMatch(childStyles, /\.admin-shell\s*\{\s*--brand-(?:blue|navy)/);
});
