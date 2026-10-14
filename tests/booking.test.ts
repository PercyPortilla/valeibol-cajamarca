import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateBookingPreview,
  getContiguousEndOptions,
  isPastLocalStart,
  normalizePeruWhatsApp,
} from "../lib/booking.ts";
import { zonedLocalDateTimeToUtc, type AvailabilitySlot } from "../lib/availability.ts";

test("calcula S/35 por una hora sin luz", () => {
  const quote = calculateBookingPreview("18:00", "19:00", "without_lights");
  assert.equal(quote.durationMinutes, 60);
  assert.equal(quote.hourlyRate, 35);
  assert.equal(quote.total, 35);
});

test("calcula S/60 por hora con luz y S/120 por dos horas", () => {
  const quote = calculateBookingPreview("19:00", "21:00", "with_lights");
  assert.equal(quote.durationHours, 2);
  assert.equal(quote.hourlyRate, 60);
  assert.equal(quote.total, 120);
});

test("normaliza WhatsApp peruano sin inventar números", () => {
  assert.equal(normalizePeruWhatsApp("935 059 868"), "+51935059868");
  assert.equal(normalizePeruWhatsApp("+51 935 059 868"), "+51935059868");
  assert.equal(normalizePeruWhatsApp("12345"), null);
});

test("solo ofrece horas finales consecutivas realmente disponibles", () => {
  const slots: AvailabilitySlot[] = [
    { id: "a", date: "2026-10-20", start: "18:00", end: "19:00", status: "available" },
    { id: "b", date: "2026-10-20", start: "19:00", end: "20:00", status: "available" },
    { id: "c", date: "2026-10-20", start: "20:00", end: "21:00", status: "occupied" },
    { id: "d", date: "2026-10-20", start: "21:00", end: "22:00", status: "available" },
  ];

  assert.deepEqual(getContiguousEndOptions(slots, "a").map((item) => item.end), ["19:00", "20:00"]);
  assert.deepEqual(getContiguousEndOptions(slots, "c"), []);
});

test("America/Lima se convierte a UTC sin hardcodear el offset en el formulario", () => {
  const utc = zonedLocalDateTimeToUtc("2026-10-20", "18:00", "America/Lima");
  assert.equal(utc.toISOString(), "2026-10-20T23:00:00.000Z");
});

test("detecta horario pasado usando America/Lima", () => {
  const now = new Date("2026-10-20T23:30:00.000Z"); // 18:30 en Lima
  assert.equal(isPastLocalStart("2026-10-20", "18:00", "America/Lima", now), true);
  assert.equal(isPastLocalStart("2026-10-20", "19:00", "America/Lima", now), false);
});
