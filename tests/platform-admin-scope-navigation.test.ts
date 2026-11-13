import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { pendingPlatformBusinessHandoff, shouldClearPlatformBusinessSelection } from "../lib/auth/platformNavigation.ts";

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

test("el scope del POST solo puede recuperarse en la primera entrada administrativa", () => {
  const selectedId = "73426eb7-4a4f-405b-b0bd-be06cd53aa3f";
  const query = new URLSearchParams({ scope: selectedId });
  assert.equal(pendingPlatformBusinessHandoff({pathname:"/admin",method:"GET",searchParams:query}), selectedId);
  assert.equal(pendingPlatformBusinessHandoff({pathname:"/admin/centro",method:"GET",searchParams:query}), selectedId);
  for(const pathname of ["/admin/reservas","/admin-global","/api/admin-global/select-business","/buscar"]){
    assert.equal(pendingPlatformBusinessHandoff({pathname,method:"GET",searchParams:query}), null);
  }
  assert.equal(pendingPlatformBusinessHandoff({pathname:"/admin",method:"POST",searchParams:query}), null);
  assert.equal(pendingPlatformBusinessHandoff({pathname:"/admin",method:"GET",searchParams:new URLSearchParams({scope:"not-a-uuid"})}), null);
  const proxy = readFileSync("proxy.ts", "utf8");
  assert.match(proxy, /supabase\.rpc\("get_platform_admin_context"\)/);
  assert.match(proxy, /scoped\.rpc\("get_current_admin_context"\)/);
  assert.match(proxy, /row\.business_id === handoffBusinessId && row\.role === "admin"/);
  assert.match(proxy, /request\.cookies\.set\(PLATFORM_ADMIN_BUSINESS_COOKIE, handoffBusinessId\)/);
  assert.match(proxy, /const scopedResponse = NextResponse\.next\(\{ request \}\)/);
  assert.match(proxy, /response\.cookies\.set\(PLATFORM_ADMIN_BUSINESS_COOKIE, handoffBusinessId/);
});

test("un ADMIN global sin scope vuelve al selector en vez de ser declarado sin autorización", () => {
  const server = readFileSync("lib/auth/server.ts", "utf8");
  const globalPage = readFileSync("app/admin-global/page.tsx", "utf8");
  assert.match(server, /global_selection_required/);
  assert.match(server, /!platformResult\.error && \(platformResult\.data\?\.length \?\? 0\) > 0/);
  assert.match(server, /redirect\("\/admin-global\?selectionError=missing"\)/);
  assert.match(globalPage, /params\.selectionError === "missing"/);
  assert.match(globalPage, /Tu sesión global continúa activa/);
});
