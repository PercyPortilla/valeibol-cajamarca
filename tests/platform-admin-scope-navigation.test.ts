import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { shouldClearPlatformBusinessSelection } from "../lib/auth/platformNavigation.ts";

function clears(pathname: string, headers: Record<string, string>, method = "GET") {
  return shouldClearPlatformBusinessSelection({ pathname, headers: new Headers(headers), method });
}

test("navegación real hacia el global limpia selección previa", () => {
  assert.equal(clears("/admin-global", { "sec-fetch-dest": "document", accept: "text/html" }), true);
  assert.equal(clears("/admin-global?page=2", { "sec-fetch-dest": "document" }), false);
  assert.equal(clears("/admin-global/equipo", { "sec-fetch-dest": "document" }), true);
  assert.equal(clears("/admin", { "sec-fetch-dest": "document" }), false);
  assert.equal(clears("/admin-global", { accept: "text/html" }), true);
});

test("precargas RSC/fetch y POST no borran la selección vigente", () => {
  assert.equal(clears("/admin-global", { rsc: "1", accept: "text/x-component" }), false);
  assert.equal(clears("/admin-global", { "next-router-prefetch": "1", accept: "*/*" }), false);
  assert.equal(clears("/admin-global", { "sec-fetch-dest": "empty", accept: "text/html" }), false);
  assert.equal(clears("/admin-global", { purpose: "prefetch", accept: "text/html" }), false);
  assert.equal(clears("/admin-global", { "sec-purpose": "prefetch", accept: "text/html" }), false);
  assert.equal(clears("/admin-global", { "sec-fetch-dest": "document" }, "POST"), false);
});

test("selector verifica contexto RPC del negocio antes de instalar la cookie", () => {
  const route = readFileSync("app/api/admin-global/select-business/route.ts", "utf8");
  const server = readFileSync("lib/data/supabase/server.ts", "utf8");
  const shell = readFileSync("components/admin/AdminShell.tsx", "utf8");
  const proxy = readFileSync("proxy.ts", "utf8");
  assert.match(route, /explicitPlatformBusinessId: businessId/);
  assert.match(route, /scopedClient\.rpc\("get_current_admin_context"\)/);
  assert.match(route, /row\.business_id === businessId && row\.role === "admin"/);
  assert.ok(route.indexOf('scopedClient.rpc("get_current_admin_context")') < route.indexOf("response.cookies.set("));
  assert.match(server, /options\?\.explicitPlatformBusinessId !== undefined/);
  assert.match(proxy, /shouldClearPlatformBusinessSelection/);
  assert.match(shell, /<a href="\/admin-global" className="admin-exit">/);
  assert.doesNotMatch(shell, /<Link href="\/admin-global"/);
});
