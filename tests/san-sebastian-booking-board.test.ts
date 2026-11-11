import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { consecutiveAvailableEnd } from "../lib/availabilitySelection.ts";
import type { AvailabilitySlot } from "../lib/availability.ts";

const fixture: AvailabilitySlot[] = [
  { id: "a", date: "2026-11-12", start: "08:00", end: "09:00", status: "available" },
  { id: "b", date: "2026-11-12", start: "09:00", end: "10:00", status: "available" },
  { id: "c", date: "2026-11-12", start: "10:00", end: "11:00", status: "occupied" },
  { id: "d", date: "2026-11-12", start: "11:00", end: "12:00", status: "available" },
];
const read = (path: string) => readFileSync(path, "utf8");

test("1 y 2 horas contiguas pueden consultarse, 3 horas con reserva intermedia NO", () => {
  assert.equal(consecutiveAvailableEnd(fixture, "08:00", 60), "09:00");
  assert.equal(consecutiveAvailableEnd(fixture, "08:00", 120), "10:00");
  assert.equal(consecutiveAvailableEnd(fixture, "08:00", 180), null);
  assert.equal(consecutiveAvailableEnd(fixture, "09:00", 120), null);
  assert.equal(consecutiveAvailableEnd(fixture, "10:00", 60), null);
  assert.equal(consecutiveAvailableEnd(fixture, "11:00", 120), null);
});

test("no admite intervalos con huecos, desorden temporal, duraciones parciales o distinto día", () => {
  const gap = [fixture[0], { ...fixture[1], start: "09:30", end: "10:30" }];
  assert.equal(consecutiveAvailableEnd(gap, "08:00", 120), null);
  assert.equal(consecutiveAvailableEnd([{ ...fixture[0], end: "08:00" }], "08:00", 60), null);
  assert.equal(consecutiveAvailableEnd(fixture, "08:00", 90), null);
  assert.equal(consecutiveAvailableEnd(fixture, "08:00", 0), null);
  assert.equal(consecutiveAvailableEnd(fixture, "08:00", 300), null);
  assert.equal(consecutiveAvailableEnd([fixture[0], { ...fixture[1], date: "2026-11-13" }], "08:00", 120), null);
});

test("pizarra hija usa identidad propia, un selector por campo/deporte/duración y mismo calendario", () => {
  const page = read("app/reservar/page.tsx");
  const calendar = read("components/availability/AvailabilityCalendar.tsx");
  const board = read("components/availability/SanSebastianBookingBoard.tsx");
  const css = read("app/styles/san-sebastian-booking-2026.css");
  const complex = read("app/complejo/[slug]/page.tsx");
  assert.match(page, /getPublicBusinessShowcase/);
  assert.match(page, /selectedCourtId = requestedShowcase\?\.courtId/);
  assert.match(page, /mode=\{isSanSebastian \? "san-sebastian" : "default"\}/);
  assert.match(calendar, /SanSebastianBookingBoard/);
  assert.match(board, /\[1, 2, 3, 4\]/);
  assert.match(board, /consecutiveAvailableEnd\(day.slots, slot.start, durationMinutes\)/);
  assert.match(board, /!isPastLocalStart/);
  assert.match(board, /Me interesan/);
  assert.match(board, /Esta consulta no bloquea el campo/);
  assert.match(css, /background: #fff; color: #163c26/);
  assert.match(css, /#a1c92f/);
  assert.match(complex, /court\.bookable \|\| business\.slug === "polideportivo-san-sebastian"/);
});
