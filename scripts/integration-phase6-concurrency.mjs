import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRole) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY para la prueba de integración Fase 6.");
  process.exit(2);
}

const service = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
const email = `phase6-${Date.now()}@example.test`;
const password = `Phase6-${Date.now()}-Aa!`;
let userId = null;
let createdReservationIds = [];
let createdCustomerIds = [];
let createdBlockIds = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function cleanup() {
  if (createdBlockIds.length) await service.from("schedule_blocks").delete().in("id", createdBlockIds);
  if (createdReservationIds.length) await service.from("reservations").delete().in("id", createdReservationIds);
  if (createdCustomerIds.length) await service.from("customers").delete().in("id", createdCustomerIds);
  if (userId) {
    await service.from("profiles").delete().eq("user_id", userId);
    await service.auth.admin.deleteUser(userId);
  }
}

try {
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) throw createError ?? new Error("No se creó usuario Fase 6");
  userId = created.user.id;

  const { error: profileError } = await service.from("profiles").insert({
    user_id: userId,
    business_id: "10000000-0000-4000-8000-000000000001",
    role: "owner",
    display_name: "Phase 6 integration",
    is_active: true,
  });
  if (profileError) throw profileError;

  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: loginError } = await client.auth.signInWithPassword({ email, password });
  if (loginError) throw loginError;

  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 70);
  const dateKey = date.toISOString().slice(0, 10);

  const payloadA = {
    p_court_id: "20000000-0000-4000-8000-000000000001",
    p_date: dateKey,
    p_start_time: "18:00",
    p_end_time: "20:00",
    p_net_height_cm: 243,
    p_customer_name: "Concurrent A",
    p_phone_e164: "+51998000001",
    p_source: "admin",
  };
  const payloadB = { ...payloadA, p_customer_name: "Concurrent B", p_phone_e164: "+51998000002" };

  const [a, b] = await Promise.all([
    client.rpc("admin_create_manual_reservation", payloadA),
    client.rpc("admin_create_manual_reservation", payloadB),
  ]);

  const successes = [a, b].filter((result) => !result.error && result.data?.[0]);
  const failures = [a, b].filter((result) => result.error);
  assert(successes.length === 1, `Se esperaba exactamente 1 reserva concurrente válida; hubo ${successes.length}`);
  assert(failures.length === 1, `Se esperaba exactamente 1 rechazo concurrente; hubo ${failures.length}`);
  assert(failures[0].error.code === "23P01" || /slot_unavailable|exclusion/i.test(failures[0].error.message), "El rechazo concurrente no fue por conflicto de agenda");

  const winner = successes[0].data[0];
  createdReservationIds.push(winner.reservation_id);

  const { data: winnerRow } = await service.from("reservations").select("customer_id").eq("id", winner.reservation_id).single();
  if (winnerRow?.customer_id) createdCustomerIds.push(winnerRow.customer_id);

  const { error: cancelError } = await client.rpc("admin_cancel_reservation", { p_reservation_id: winner.reservation_id });
  if (cancelError) throw cancelError;

  const [manualAfterCancel, blockRace] = await Promise.all([
    client.rpc("admin_create_manual_reservation", {
      ...payloadA,
      p_customer_name: "Concurrent C",
      p_phone_e164: "+51998000003",
    }),
    client.rpc("admin_create_schedule_block", {
      p_court_id: payloadA.p_court_id,
      p_date: dateKey,
      p_start_time: "18:00",
      p_end_time: "20:00",
      p_reason: "event",
      p_internal_note: "Race block",
    }),
  ]);

  const secondSuccesses = [manualAfterCancel, blockRace].filter((result) => !result.error && result.data?.[0]);
  const secondFailures = [manualAfterCancel, blockRace].filter((result) => result.error);
  assert(secondSuccesses.length === 1 && secondFailures.length === 1, "Reserva vs bloqueo concurrentes deben producir un solo ganador");

  if (!manualAfterCancel.error && manualAfterCancel.data?.[0]) {
    createdReservationIds.push(manualAfterCancel.data[0].reservation_id);
    const { data: row } = await service.from("reservations").select("customer_id").eq("id", manualAfterCancel.data[0].reservation_id).single();
    if (row?.customer_id) createdCustomerIds.push(row.customer_id);
  }
  if (!blockRace.error && blockRace.data?.[0]) createdBlockIds.push(blockRace.data[0].block_id);

  console.log("PASS Fase 6 concurrencia: reserva-reserva y reserva-bloqueo producen como máximo una ocupación válida.");
} finally {
  await cleanup();
}
