import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("app/propietario/page.tsx", "utf8");
const shell = readFileSync("components/admin/AdminShell.tsx", "utf8");
const navigation = readFileSync("components/admin/AdminNavigation.tsx", "utf8");

test("portal propietario reutiliza rutas administrativas existentes", () => {
  for (const route of [
    "/admin/disponibilidad",
    "/admin/reservas",
    "/admin/clientes",
    "/admin/precios",
    "/admin/reportes",
    "/admin/configuracion",
  ]) assert.match(page, new RegExp(route.replaceAll("/", "\\/")));
});

test("staff no recibe entrada de propietario y el shell enlaza solo roles superiores", () => {
  assert.match(page, /context\.role === "staff"/);
  assert.match(page, /redirect\("\/admin"\)/);
  assert.match(shell, /context\.role !== "staff"/);
  assert.match(shell, /href="\/propietario"/);
});

test("portal propietario no expone pagos y deriva coordinaciones a WhatsApp", () => {
  assert.doesNotMatch(page, /\/admin\/pagos/);
  assert.doesNotMatch(navigation, /\/admin\/pagos/);
  assert.doesNotMatch(page, /pago|adelanto/i);
  assert.match(page, /WhatsApp/i);
});
