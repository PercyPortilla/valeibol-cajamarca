import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const css = readFileSync("app/styles/san-sebastian-admin-status-fill-v4.css", "utf8");
const board = readFileSync("components/admin/AdminScheduleBoard.tsx", "utf8");
const imports = readFileSync("app/globals.css", "utf8");

test("seis estados tienen fondo, borde, texto y acento propios en la pizarra del tenant", () => {
  const states = ["available", "pending", "confirmed", "blocked", "completed", "unavailable"];
  const backgrounds = new Set<string>();
  for (const state of states) {
    const selector = `.admin-slot--${state}, .admin-legend-status--${state}`;
    const rule = css.match(new RegExp(`\\.ss-admin-schedule-v3 :is\\(\\.admin-slot--${state}, \\.admin-legend-status--${state}\\) \\{([^}]+)\\}`));
    assert.ok(rule, `Falta selector para ${selector}`);
    for (const variable of ["bg", "border", "ink", "accent"]) {
      const value: RegExpMatchArray | null = rule[1].match(new RegExp(`--ss-state-${variable}: (#[0-9a-f]{6});`, "i"));
      assert.ok(value, `Falta --ss-state-${variable} de ${state}`);
      if (variable === "bg") backgrounds.add(value[1].toLowerCase());
    }
  }
  assert.equal(backgrounds.size, 6, "Los seis estados deben tener rellenos distinguibles");
  assert.match(css, /\.admin-shell \.ss-admin-schedule-v3 article\.admin-slot\s*\{[^}]*background: var\(--ss-state-bg\)/);
  assert.match(css, /\.admin-legend-status\s*\{[^}]*background: var\(--ss-state-bg\)/);
  assert.match(css, /\.admin-slot\.admin-slot--expanded/);
});

test("la leyenda se vincula al estado real y el CSS solo afecta al negocio habilitado", () => {
  assert.match(board, /admin-legend-status--\$\{status\}/);
  assert.match(board, /admin-status-dot--\$\{status\}/);
  assert.match(board, /adminScheduleStatusLabel\(status\)/);
  assert.match(board, /premiumCommand \? "admin-schedule-app ss-admin-schedule-v3"/);
  assert.equal(css.includes(".admin-schedule-app .admin-slot {"), false);
  assert.ok(imports.trimEnd().endsWith('@import "./styles/san-sebastian-admin-status-fill-v4.css";'));
});
