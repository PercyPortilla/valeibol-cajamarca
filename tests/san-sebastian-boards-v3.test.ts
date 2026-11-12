import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { slotMatchesAdminFilter, visibleBoardDates } from "../lib/admin/boardPresentation.ts";
import type { AdminBoardSlot } from "../lib/admin/schedule.ts";

const monday = "2026-11-09";

test("Día, 3 días y Semana muestran fechas válidas sin comprimir siete columnas", () => {
  assert.deepEqual(visibleBoardDates(monday, "2026-11-12", "day"), ["2026-11-12"]);
  assert.deepEqual(visibleBoardDates(monday, "2026-11-12", "three"), ["2026-11-12", "2026-11-13", "2026-11-14"]);
  assert.deepEqual(visibleBoardDates(monday, "2026-11-15", "three"), ["2026-11-13", "2026-11-14", "2026-11-15"]);
  assert.deepEqual(visibleBoardDates(monday, "2026-11-12", "week"), [
    "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15",
  ]);
});

test("filtro visual no inventa ocupaciones ni permite tratar pasado como libre", () => {
  const asSlot = (status: AdminBoardSlot["status"]): AdminBoardSlot => ({
    id: "c1-2026-11-12-21", date: "2026-11-12", start: "21:00", end: "22:00",
    status, entry: null, releasedEntries: [],
  });
  for (const state of ["pending", "confirmed", "blocked", "completed"] as const) {
    assert.equal(slotMatchesAdminFilter(asSlot(state), "busy"), true);
    assert.equal(slotMatchesAdminFilter(asSlot(state), "free"), false);
  }
  assert.equal(slotMatchesAdminFilter(asSlot("available"), "free"), true);
  assert.equal(slotMatchesAdminFilter(asSlot("unavailable"), "free"), false);
  assert.equal(slotMatchesAdminFilter(asSlot("unavailable"), "busy"), false);
  assert.equal(slotMatchesAdminFilter(asSlot("unavailable"), "all"), true);
});

test("UI A+D usa acciones protegidas y no altera la separación multitenant", () => {
  const panel = readFileSync("components/admin/AdminScheduleBoard.tsx", "utf8");
  const route = readFileSync("app/admin/(protected)/disponibilidad/page.tsx", "utf8");
  const css = readFileSync("app/styles/san-sebastian-admin-ux-v3.css", "utf8");
  assert.match(panel, /premiumCommand \? "day" : "week"/);
  assert.match(panel, /aria-expanded=\{overviewOpen\}/);
  assert.match(panel, /ss-admin-daily__desktop/);
  assert.match(panel, /ss-admin-daily__mobile/);
  assert.match(panel, /ss-admin-week-scroll/);
  assert.match(panel, /canPerformAdminOperation\(role, "create_manual_reservation"\)/);
  assert.match(panel, /canPerformAdminOperation\(role, "create_block"\)/);
  assert.match(panel, /confirmReservationAction/);
  assert.match(panel, /cancelReservationAction/);
  assert.match(route, /requireAdminContext\(\)/);
  assert.match(route, /premiumCommand=\{context\.businessId === "73426eb7-4a4f-405b-b0bd-be06cd53aa3f"/);
  assert.match(css, /\.ss-admin-week-scroll \.admin-week-board/);
  assert.match(css, /repeat\(7, 300px\)/);
  assert.match(css, /\.admin-slot__head span \{ font-size: 14px/);
});
