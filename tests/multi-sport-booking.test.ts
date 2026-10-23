import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sportRequiresNetHeight } from "../config/sports.ts";

const migration = readFileSync("supabase/migrations/20261023090448_multi_sport_booking_rules.sql", "utf8");
const apiRoute = readFileSync("app/api/public/reservation-requests/route.ts", "utf8");
const edge = readFileSync("supabase/functions/public-reservation-request/index.ts", "utf8");

test("reglas de reserva por deporte mantienen altura obligatoria solo para vóley", () => {
  assert.equal(sportRequiresNetHeight("voley"), true);
  assert.equal(sportRequiresNetHeight("futbol"), false);
  assert.equal(sportRequiresNetHeight("futsal"), false);
  assert.equal(sportRequiresNetHeight("basquet"), false);
});

test("RPC autoritativa valida deporte antes de aceptar altura nullable", () => {
  assert.match(migration, /from public\.sports s/i);
  assert.match(migration, /if v_sport_slug = 'voley' then/i);
  assert.match(migration, /p_net_height_cm is null or p_net_height_cm not between 180 and 250/i);
  assert.match(migration, /elsif p_net_height_cm is not null then/i);
  assert.match(migration, /net_height_not_applicable/i);
});

test("proxy y Edge permiten null pero siguen rechazando alturas fuera de rango", () => {
  for (const source of [apiRoute, edge]) {
    assert.match(source, /netHeightCm: number \| null/);
    assert.match(source, /netHeightCm !== null/);
    assert.match(source, /netHeightCm < 180/);
    assert.match(source, /netHeightCm > 250/);
  }
});
