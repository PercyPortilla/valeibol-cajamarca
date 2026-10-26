import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { LocalPhase7Repository } from "../lib/data/repositories/localPhase7Repository.ts";
import { getLocalAdminState, resetLocalAdminStateForTests } from "../lib/data/localAdminStore.ts";

const migration = readFileSync("supabase/migrations/20261025193000_block55_admin_customer_pagination.sql", "utf8");
const page = readFileSync("app/admin/(protected)/clientes/page.tsx", "utf8");
const contract = readFileSync("lib/data/repositories/phase7Repository.ts", "utf8");
const repository = readFileSync("lib/data/repositories/supabasePhase7Repository.ts", "utf8");
const types = readFileSync("lib/data/supabase/database.types.ts", "utf8");
const runner = readFileSync("scripts/run-supabase-sql-tests.mjs", "utf8");

test("B55 directorio pagina dentro del tenant antes del LIMIT", () => {
  const fn = migration.match(/create or replace function public\.get_admin_customers_page[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /phase6_admin_actor\(\)/);
  assert.match(fn, /c\.business_id = v_actor\.business_id/);
  assert.match(fn, /c\.archived_at is null/);
  assert.doesNotMatch(fn, /p_business_id/);
  assert.match(fn, /num_nonnulls\(p_cursor_created_at, p_cursor_id\)/);
  assert.match(fn, /\(s\.customer_created_at, s\.customer_id\) < \(p_cursor_created_at, p_cursor_id\)/);
  assert.match(fn, /order by s\.customer_created_at desc, s\.customer_id desc/);
  assert.match(fn, /least\(coalesce\(p_limit, 31\), 101\)/);
});

test("B55 historial pagina por created_at id inmutables y valida ownership del cliente", () => {
  const fn = migration.match(/create or replace function public\.get_admin_customer_history_page[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /c\.id = p_customer_id[\s\S]*c\.business_id = v_actor\.business_id/);
  assert.match(fn, /num_nonnulls\(p_cursor_created_at, p_cursor_id\)/);
  assert.match(fn, /\(r\.created_at, r\.id\) < \(p_cursor_created_at, p_cursor_id\)/);
  assert.match(fn, /order by r\.created_at desc, r\.id desc/);
  assert.doesNotMatch(fn, /p_cursor_start_at/);
  assert.match(fn, /r\.net_height_cm/);
});

test("B55 repositorio y UI dejan de usar topes 200/100", () => {
  assert.match(contract, /listCustomersPage\(options\?/);
  assert.match(contract, /getCustomerHistoryPage\(customerId: string/);
  assert.match(repository, /rpc\("get_admin_customers_page"/);
  assert.match(repository, /rpc\("get_admin_customer_history_page"/);
  assert.match(repository, /p_limit: limit \+ 1/);
  assert.doesNotMatch(page, /listCustomers\(200\)/);
  assert.doesNotMatch(page, /getCustomerHistory\([^\n]*100/);
  assert.match(page, /listCustomersPage\(\{ limit: 30, cursor \}\)/);
  assert.match(page, /getCustomerHistoryPage\(selected\.id, \{ limit: 25, cursor: customerHistoryCursor \}\)/);
  assert.match(page, /Ver más clientes/);
  assert.match(page, /Ver reservas más antiguas/);
  assert.match(page, /tenantIsEmpty = customers\.length === 0 && !cursor && !selected/);
  assert.match(page, /No hay más clientes en esta página/);
  assert.match(page, /No hay más reservas en esta página/);
});

test("B55 cliente seleccionado se resuelve por id aunque ya no esté en la página actual", () => {
  const fn = migration.match(/create or replace function public\.get_admin_customer_summary[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /phase6_admin_actor\(\)/);
  assert.match(fn, /c\.id = p_customer_id[\s\S]*c\.business_id = v_actor\.business_id/);
  assert.doesNotMatch(fn, /p_business_id/);
  assert.match(repository, /get_admin_customer_summary/);
  assert.match(page, /await repository\.getCustomer\(cliente!\)/);
  assert.match(types, /get_admin_customer_summary:/);
});

test("B55 un deep-link de cliente stale no tumba el directorio", () => {
  assert.match(page, /let selectedMissing = false/);
  assert.match(page, /error instanceof Phase7RepositoryError && error\.code === "not_found"/);
  assert.match(page, /selectedMissing = true/);
  assert.match(page, /Cliente no disponible/);
  assert.match(page, /Volver al directorio/);
  assert.match(page, /tenantIsEmpty = customers\.length === 0 && !cursor && !selected && !selectedMissing/);
});

test("B55 paridad local alcanza más de 200 clientes y más de 100 reservas del mismo cliente", async () => {
  resetLocalAdminStateForTests();
  const state = getLocalAdminState();
  const template = state.reservations[0]!;
  state.reservations = [];

  for (let i = 0; i < 230; i += 1) {
    const stamp = new Date(Date.UTC(2027, 0, 1, 0, 0, i)).toISOString();
    state.reservations.push({
      ...template,
      id: `61000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      customerId: `62000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      customerName: `Cliente ${String(i).padStart(3, "0")}`,
      startAt: stamp,
      endAt: new Date(new Date(stamp).getTime() + 3_600_000).toISOString(),
      createdAt: stamp,
    });
  }

  const historyCustomerId = "63000000-0000-4000-8000-000000000001";
  for (let i = 0; i < 125; i += 1) {
    const stamp = new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString();
    state.reservations.push({
      ...template,
      id: `64000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      customerId: historyCustomerId,
      customerName: "Cliente Historial",
      startAt: stamp,
      endAt: new Date(new Date(stamp).getTime() + 3_600_000).toISOString(),
      createdAt: stamp,
    });
  }

  const local = new LocalPhase7Repository();
  const seenCustomers = new Set<string>();
  let customerCursor = null;
  do {
    const result = await local.listCustomersPage({ limit: 37, cursor: customerCursor });
    result.items.forEach((item) => seenCustomers.add(item.id));
    customerCursor = result.nextCursor;
  } while (customerCursor);
  assert.equal(seenCustomers.size, 231);

  const seenReservations = new Set<string>();
  let historyCursor = null;
  do {
    const result = await local.getCustomerHistoryPage(historyCustomerId, { limit: 23, cursor: historyCursor });
    result.items.forEach((item) => seenReservations.add(item.id));
    historyCursor = result.nextCursor;
  } while (historyCursor);
  assert.equal(seenReservations.size, 125);
});

test("B55 cursores inmutables no omiten ni duplican filas cuando cambian actividad u horario", async () => {
  resetLocalAdminStateForTests();
  const state = getLocalAdminState();
  const template = state.reservations[0]!;
  state.reservations = [];

  for (let i = 0; i < 8; i += 1) {
    const createdAt = new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString();
    state.reservations.push({
      ...template,
      id: `65000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      customerId: `66000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      customerName: `Mutable ${i}`,
      createdAt,
      startAt: new Date(Date.UTC(2026, 1, 1, 0, 0, i)).toISOString(),
      endAt: new Date(Date.UTC(2026, 1, 1, 1, 0, i)).toISOString(),
    });
  }

  const local = new LocalPhase7Repository();
  const firstCustomers = await local.listCustomersPage({ limit: 3 });
  assert.ok(firstCustomers.nextCursor);
  const firstCustomerIds = firstCustomers.items.map((item) => item.id);

  const unseenCustomerId = "66000000-0000-4000-8000-000000000002";
  const unseenReservation = state.reservations.find((item) => item.customerId === unseenCustomerId)!;
  unseenReservation.startAt = "2035-01-01T00:00:00.000Z";
  unseenReservation.endAt = "2035-01-01T01:00:00.000Z";

  const remainingCustomerIds = new Set<string>();
  let customerCursor: { createdAt: string; id: string } | null = firstCustomers.nextCursor;
  while (customerCursor) {
    const result = await local.listCustomersPage({ limit: 3, cursor: customerCursor });
    result.items.forEach((item) => remainingCustomerIds.add(item.id));
    customerCursor = result.nextCursor;
  }
  const allCustomerIds = new Set([...firstCustomerIds, ...remainingCustomerIds]);
  assert.equal(allCustomerIds.size, 8);
  assert.ok(allCustomerIds.has(unseenCustomerId));

  const historyCustomerId = "67000000-0000-4000-8000-000000000001";
  state.reservations = [];
  for (let i = 0; i < 8; i += 1) {
    const createdAt = new Date(Date.UTC(2026, 2, 1, 0, 0, i)).toISOString();
    state.reservations.push({
      ...template,
      id: `68000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      customerId: historyCustomerId,
      customerName: "Historial mutable",
      createdAt,
      startAt: new Date(Date.UTC(2026, 3, 1, 0, 0, i)).toISOString(),
      endAt: new Date(Date.UTC(2026, 3, 1, 1, 0, i)).toISOString(),
    });
  }

  const firstHistory = await local.getCustomerHistoryPage(historyCustomerId, { limit: 3 });
  assert.ok(firstHistory.nextCursor);
  const firstHistoryIds = firstHistory.items.map((item) => item.id);
  state.reservations.find((item) => item.id === firstHistory.items[0]!.id)!.startAt = "2020-01-01T00:00:00.000Z";
  state.reservations.find((item) => item.id === "68000000-0000-4000-8000-000000000002")!.startAt = "2035-01-01T00:00:00.000Z";

  const remainingHistoryIds = new Set<string>();
  let historyCursor: { createdAt: string; id: string } | null = firstHistory.nextCursor;
  while (historyCursor) {
    const result = await local.getCustomerHistoryPage(historyCustomerId, { limit: 3, cursor: historyCursor });
    result.items.forEach((item) => remainingHistoryIds.add(item.id));
    historyCursor = result.nextCursor;
  }
  assert.equal(new Set([...firstHistoryIds, ...remainingHistoryIds]).size, 8);
  assert.ok(remainingHistoryIds.has("68000000-0000-4000-8000-000000000002"));
});

test("B55 privilegios y tipos quedan registrados", () => {
  assert.match(migration, /revoke all on function public\.get_admin_customers_page[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.get_admin_customers_page[\s\S]*to authenticated/);
  assert.match(migration, /revoke all on function public\.get_admin_customer_history_page[\s\S]*from public, anon, authenticated/);
  assert.match(types, /get_admin_customers_page:/);
  assert.match(types, /get_admin_customer_history_page:/);
  assert.match(runner, /platform_admin_customer_pagination\.sql/);
});
