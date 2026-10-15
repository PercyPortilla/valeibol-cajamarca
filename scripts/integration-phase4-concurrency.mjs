import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  process.exit(2);
}

const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
const courtId = "20000000-0000-4000-8000-000000000001";
const date = new Date();
date.setUTCDate(date.getUTCDate() + 40);
const dateKey = date.toISOString().slice(0, 10);

const baseArgs = {
  p_business_slug: "valeibol-cajamarca",
  p_court_id: courtId,
  p_date: dateKey,
  p_start_time: "18:00",
  p_end_time: "20:00",
  p_net_height_cm: 243,
  p_customer_name: "Concurrency test",
  p_marketing_opt_in: false,
};

const calls = [
  supabase.rpc("create_public_reservation_request", {
    ...baseArgs,
    p_phone_e164: "+51988888001",
    p_request_token: crypto.randomUUID(),
  }),
  supabase.rpc("create_public_reservation_request", {
    ...baseArgs,
    p_phone_e164: "+51988888002",
    p_request_token: crypto.randomUUID(),
  }),
];

const results = await Promise.all(calls);
const successes = results.filter((result) => !result.error);
const failures = results.filter((result) => result.error);

if (successes.length !== 1 || failures.length !== 1) {
  console.error("FAIL: se esperaba exactamente 1 éxito y 1 rechazo bajo concurrencia.", results);
  process.exit(1);
}

if (failures[0].error?.code !== "23P01" && !failures[0].error?.message?.includes("slot_unavailable")) {
  console.error("FAIL: el segundo intento no fue rechazado como solapamiento.", failures[0].error);
  process.exit(1);
}

const { data: availability, error: availabilityError } = await supabase.rpc("get_public_availability", {
  p_business_slug: "valeibol-cajamarca",
  p_from: dateKey,
  p_to: dateKey,
});
if (availabilityError) {
  console.error("FAIL al revalidar disponibilidad:", availabilityError);
  process.exit(1);
}

const serialized = JSON.stringify(availability);
if (!serialized.includes("reservation")) {
  console.error("FAIL: la agenda pública no reflejó la ocupación pending.");
  process.exit(1);
}
if (/customer|phone|full_name|internal_note|created_by/i.test(serialized)) {
  console.error("FAIL: la RPC pública expuso una clave potencialmente privada.");
  process.exit(1);
}

console.log("PASS Fase 4 concurrencia: 2 intentos simultáneos => 1 solicitud pending válida, 1 rechazo, agenda actualizada sin PII.");
