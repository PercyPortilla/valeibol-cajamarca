import assert from "node:assert/strict";
import test from "node:test";
import { businessConfig } from "../config/business.ts";
import {
  addDays,
  buildCalendarDaysFromOperatingDays,
  buildSlotsFromOperatingDay,
  businessTodayDateKey,
  generateMockSlotsForDate,
  getWeekDateKeys,
  startOfWeekMonday,
  zonedLocalDateTimeToUtc,
  type PublicOperatingDay,
} from "../lib/availability.ts";

test("las tarifas comerciales siguen centralizadas y correctas", () => {
  assert.equal(businessConfig.pricing.withoutLights, 35);
  assert.equal(businessConfig.pricing.withLights, 60);
});

test("el fallback de horario sigue marcado explícitamente como provisional", () => {
  assert.equal(businessConfig.availability.scheduleSource, "mock-provisional");
  assert.equal(businessConfig.timezone, "America/Lima");
});

test("la semana empieza el lunes y contiene siete fechas consecutivas", () => {
  assert.equal(startOfWeekMonday("2026-10-14"), "2026-10-12");
  assert.deepEqual(getWeekDateKeys("2026-10-14"), [
    "2026-10-12",
    "2026-10-13",
    "2026-10-14",
    "2026-10-15",
    "2026-10-16",
    "2026-10-17",
    "2026-10-18",
  ]);
});

test("navegar una semana preserva la fecha incluso al cruzar mes/año", () => {
  assert.equal(addDays("2026-10-14", 7), "2026-10-21");
  assert.equal(addDays("2026-10-14", -7), "2026-10-07");
  assert.equal(startOfWeekMonday("2026-01-01"), "2025-12-29");
  assert.equal(addDays("2026-12-30", 7), "2027-01-06");
});

test("la fecha de negocio usa America/Lima", () => {
  assert.equal(businessTodayDateKey(new Date("2026-10-14T02:00:00Z")), "2026-10-13");
  assert.equal(businessTodayDateKey(new Date("2026-10-14T05:00:00Z")), "2026-10-14");
});

test("la conversión local->UTC respeta America/Lima sin hardcodear el offset en la API", () => {
  assert.equal(
    zonedLocalDateTimeToUtc("2026-10-14", "19:00", "America/Lima").toISOString(),
    "2026-10-15T00:00:00.000Z",
  );
});

test("los slots fallback no contienen PII", () => {
  const slots = generateMockSlotsForDate("2026-10-14");
  assert.ok(slots.length > 0);
  const allowedKeys = ["date", "end", "id", "start", "status"];

  for (const slot of slots) {
    assert.deepEqual(Object.keys(slot).sort(), allowedKeys);
    assert.ok(["available", "occupied", "unavailable"].includes(slot.status));
  }
});

test("el horario provisional configurable genera bloques de una hora", () => {
  const slots = generateMockSlotsForDate("2026-10-14");
  assert.equal(slots.length, 15);
  assert.equal(slots[0]?.start, "08:00");
  assert.equal(slots[0]?.end, "09:00");
  assert.equal(slots.at(-1)?.start, "22:00");
  assert.equal(slots.at(-1)?.end, "23:00");
});

test("una reserva sanitizada produce Ocupado y un bloqueo produce No disponible", () => {
  const day: PublicOperatingDay = {
    date: "2026-10-14",
    isOpen: true,
    opensAt: "18:00",
    closesAt: "22:00",
    scheduleStatus: "provisional",
    busyIntervals: [
      {
        startAt: "2026-10-14T23:00:00.000Z", // 18:00 Lima
        endAt: "2026-10-15T00:00:00.000Z",   // 19:00 Lima
        kind: "reservation",
      },
      {
        startAt: "2026-10-15T01:00:00.000Z", // 20:00 Lima
        endAt: "2026-10-15T02:00:00.000Z",   // 21:00 Lima
        kind: "block",
      },
    ],
  };

  const slots = buildSlotsFromOperatingDay(day, "America/Lima", 60);
  assert.deepEqual(slots.map((slot) => [slot.start, slot.status]), [
    ["18:00", "occupied"],
    ["19:00", "available"],
    ["20:00", "unavailable"],
    ["21:00", "available"],
  ]);
});

test("un intervalo ocupado parcial bloquea el slot completo que intersecta", () => {
  const day: PublicOperatingDay = {
    date: "2026-10-14",
    isOpen: true,
    opensAt: "18:00",
    closesAt: "20:00",
    scheduleStatus: "confirmed",
    busyIntervals: [
      {
        startAt: "2026-10-14T23:30:00.000Z", // 18:30 Lima
        endAt: "2026-10-15T00:15:00.000Z",   // 19:15 Lima
        kind: "reservation",
      },
    ],
  };

  const slots = buildSlotsFromOperatingDay(day, "America/Lima", 60);
  assert.equal(slots[0]?.status, "occupied");
  assert.equal(slots[1]?.status, "occupied");
});

test("un día cerrado no genera slots", () => {
  const slots = buildSlotsFromOperatingDay(
    {
      date: "2026-10-18",
      isOpen: false,
      opensAt: null,
      closesAt: null,
      scheduleStatus: "provisional",
      busyIntervals: [],
    },
    "America/Lima",
  );
  assert.deepEqual(slots, []);
});

test("el calendario derivado conserva únicamente campos públicos", () => {
  const days = buildCalendarDaysFromOperatingDays(
    [
      {
        date: "2026-10-14",
        isOpen: true,
        opensAt: "08:00",
        closesAt: "10:00",
        scheduleStatus: "provisional",
        busyIntervals: [],
      },
    ],
    "2026-10-14",
    "America/Lima",
  );

  assert.equal(days.length, 1);
  assert.equal(days[0]?.isToday, true);
  assert.deepEqual(Object.keys(days[0]?.slots[0] ?? {}).sort(), ["date", "end", "id", "start", "status"]);
});
