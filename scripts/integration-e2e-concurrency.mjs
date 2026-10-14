import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRole) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}

const businessId = "10000000-0000-4000-8000-000000000001";
const businessSlug = "valeibol-cajamarca";
const service = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
const owner = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

const suffix = Date.now().toString().slice(-8);
const courtId = randomUUID();
const email = `e2e-${Date.now()}@example.test`;
const password = `Valeibol-${randomUUID()}-Aa1!`;
const phones = Array.from({ length: 8 }, (_, index) => {
  const value = (Number(suffix) + index + 1) % 100000000;
  return `+519${String(value).padStart(8, "0")}`;
});
let userId = null;

function datePlus(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function oneWinner(results, label) {
  const successes = results.filter((result) => !result.error && result.data?.[0]);
  const failures = results.filter((result) => result.error);
  assert.equal(successes.length, 1, `${label}: se esperaba exactamente 1 ganador; hubo ${successes.length}`);
  assert.equal(failures.length, 1, `${label}: se esperaba exactamente 1 rechazo; hubo ${failures.length}`);
  return { winner: successes[0], loser: failures[0] };
}

async function cleanup() {
  await service.from("courts").delete().eq("id", courtId);
  await service.from("customers").delete().eq("business_id", businessId).in("phone_e164", phones);
  if (userId) {
    await service.from("profiles").delete().eq("user_id", userId);
    await service.auth.admin.deleteUser(userId);
  }
}

try {
  const { data: created, error: userError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userError || !created.user) throw userError ?? new Error("No se pudo crear owner temporal");
  userId = created.user.id;

  const { error: profileError } = await service.from("profiles").insert({
    user_id: userId,
    business_id: businessId,
    role: "owner",
    display_name: "E2E concurrency owner",
    is_active: true,
  });
  if (profileError) throw profileError;

  const { error: loginError } = await owner.auth.signInWithPassword({ email, password });
  if (loginError) throw loginError;

  const { error: courtError } = await service.from("courts").insert({
    id: courtId,
    business_id: businessId,
    slug: `e2e-${suffix}`,
    name: `Cancha E2E ${suffix}`,
    configuration_status: "confirmed",
    is_active: true,
    sort_order: 99,
  });
  if (courtError) throw courtError;

  const hours = Array.from({ length: 7 }, (_, index) => ({
    court_id: courtId,
    weekday: index + 1,
    is_open: true,
    opens_at: "08:00",
    closes_at: "23:00",
    effective_from: "1970-01-01",
    configuration_status: "confirmed",
  }));
  const { error: hoursError } = await service.from("operating_hours").insert(hours);
  if (hoursError) throw hoursError;

  const { error: pricingError } = await service.from("pricing_rules").insert([
    {
      court_id: courtId,
      lighting: "without_lights",
      label: "Sin luz",
      hourly_rate: 35,
      effective_from: "1970-01-01",
      configuration_status: "confirmed",
      is_active: true,
    },
    {
      court_id: courtId,
      lighting: "with_lights",
      label: "Con luz",
      hourly_rate: 60,
      effective_from: "1970-01-01",
      configuration_status: "confirmed",
      is_active: true,
    },
  ]);
  if (pricingError) throw pricingError;

  // 1) Solicitud pública vs reserva manual: el ledger permite un solo ganador.
  const raceDate = datePlus(100);
  const publicAttempt = service.rpc("create_public_reservation_request", {
    p_business_slug: businessSlug,
    p_court_id: courtId,
    p_date: raceDate,
    p_start_time: "18:00",
    p_end_time: "19:00",
    p_lighting: "without_lights",
    p_customer_name: "E2E Public",
    p_phone_e164: phones[0],
    p_marketing_opt_in: false,
    p_request_token: randomUUID(),
  });
  const manualAttempt = owner.rpc("admin_create_manual_reservation", {
    p_court_id: courtId,
    p_date: raceDate,
    p_start_time: "18:00",
    p_end_time: "19:00",
    p_lighting: "without_lights",
    p_customer_name: "E2E Manual",
    p_phone_e164: phones[1],
    p_source: "admin",
  });
  const race = oneWinner(await Promise.all([publicAttempt, manualAttempt]), "pública vs manual");
  assert.match(race.loser.error.message ?? "", /slot|exclusion|conflict|overlap|schedule/i);

  // 2) Editar una reserva hacia un intervalo ocupado debe fallar sin mover la original.
  const editDate = datePlus(101);
  const occupied = await owner.rpc("admin_create_manual_reservation", {
    p_court_id: courtId,
    p_date: editDate,
    p_start_time: "18:00",
    p_end_time: "19:00",
    p_lighting: "without_lights",
    p_customer_name: "E2E Occupied",
    p_phone_e164: phones[2],
    p_source: "admin",
  });
  if (occupied.error || !occupied.data?.[0]) throw occupied.error ?? new Error("No se creó reserva ocupante");

  const editable = await owner.rpc("admin_create_manual_reservation", {
    p_court_id: courtId,
    p_date: editDate,
    p_start_time: "20:00",
    p_end_time: "21:00",
    p_lighting: "without_lights",
    p_customer_name: "E2E Editable",
    p_phone_e164: phones[3],
    p_source: "admin",
  });
  if (editable.error || !editable.data?.[0]) throw editable.error ?? new Error("No se creó reserva editable");

  const editConflict = await owner.rpc("admin_edit_reservation", {
    p_reservation_id: editable.data[0].reservation_id,
    p_court_id: courtId,
    p_date: editDate,
    p_start_time: "18:00",
    p_end_time: "19:00",
    p_lighting: "with_lights",
    p_customer_name: "E2E Editable",
    p_phone_e164: phones[3],
  });
  assert.ok(editConflict.error, "edición hacia intervalo ocupado debía fallar");

  // 3) Confirmar/cancelar en paralelo conserva un único estado y un ledger coherente.
  const transitionDate = datePlus(102);
  const pending = await service.rpc("create_public_reservation_request", {
    p_business_slug: businessSlug,
    p_court_id: courtId,
    p_date: transitionDate,
    p_start_time: "18:00",
    p_end_time: "19:00",
    p_lighting: "without_lights",
    p_customer_name: "E2E Transition",
    p_phone_e164: phones[4],
    p_marketing_opt_in: false,
    p_request_token: randomUUID(),
  });
  if (pending.error || !pending.data?.[0]) throw pending.error ?? new Error("No se creó pending para transición");

  const reservationId = pending.data[0].request_id;
  const [confirmResult, cancelResult] = await Promise.all([
    owner.rpc("admin_confirm_reservation", { p_reservation_id: reservationId }),
    owner.rpc("admin_cancel_reservation", { p_reservation_id: reservationId }),
  ]);
  assert.ok(
    (!confirmResult.error && confirmResult.data?.[0]) || (!cancelResult.error && cancelResult.data?.[0]),
    "confirmar/cancelar concurrente no produjo ninguna transición válida",
  );

  const { data: finalReservation, error: finalError } = await service
    .from("reservations")
    .select("status")
    .eq("id", reservationId)
    .single();
  if (finalError) throw finalError;
  assert.ok(["confirmed", "cancelled"].includes(finalReservation.status), `estado final inválido: ${finalReservation.status}`);

  const { count: ledgerCount, error: ledgerError } = await service
    .from("court_schedule_entries")
    .select("id", { count: "exact", head: true })
    .eq("source_kind", "reservation")
    .eq("source_id", reservationId)
    .eq("blocks_availability", true);
  if (ledgerError) throw ledgerError;
  assert.equal(ledgerCount, finalReservation.status === "cancelled" ? 0 : 1, "ledger inconsistente tras confirm/cancel concurrente");

  // 4) Dos cambios de precio con la misma fecha efectiva: solo uno puede versionar.
  const pricingDate = datePlus(130);
  const pricingRace = oneWinner(await Promise.all([
    owner.rpc("admin_schedule_pricing_rule", {
      p_court_id: courtId,
      p_lighting: "without_lights",
      p_hourly_rate: 41,
      p_effective_from: pricingDate,
    }),
    owner.rpc("admin_schedule_pricing_rule", {
      p_court_id: courtId,
      p_lighting: "without_lights",
      p_hourly_rate: 42,
      p_effective_from: pricingDate,
    }),
  ]), "pricing concurrente");
  assert.ok(pricingRace.loser.error, "pricing concurrente debía rechazar un contendiente");

  console.log("PASS E2E concurrencia · pública/manual, edición ocupada, transición concurrente, pricing concurrente");
} finally {
  await cleanup();
}
