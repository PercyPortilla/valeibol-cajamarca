import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRole) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}

const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const email = `phase5-${Date.now()}@example.test`;
const password = `Vb!${randomUUID()}9x`;
const phone = `+519${String(Date.now()).slice(-8)}`;
const businessId = "10000000-0000-4000-8000-000000000001";
const courtId = "20000000-0000-4000-8000-000000000001";
const requestToken = randomUUID();
let userId;
let customerId;
let reservationId;

try {
  const invalid = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: invalidError } = await invalid.auth.signInWithPassword({ email, password: "incorrecta" });
  assert.ok(invalidError, "login inválido debe ser rechazado");

  const { data: created, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createUserError) throw createUserError;
  userId = created.user.id;

  const { error: profileError } = await admin.from("profiles").insert({
    user_id: userId,
    business_id: businessId,
    role: "owner",
    display_name: "Owner temporal Fase 5",
    is_active: true,
  });
  if (profileError) throw profileError;

  const { data: booking, error: bookingError } = await anon.rpc("create_public_reservation_request", {
    p_business_slug: "valeibol-cajamarca",
    p_court_id: courtId,
    p_date: "2099-12-15",
    p_start_time: "18:00",
    p_end_time: "19:00",
    p_net_height_cm: 243,
    p_customer_name: "Cliente temporal Fase 5",
    p_phone_e164: phone,
    p_marketing_opt_in: false,
    p_request_token: requestToken,
  });
  if (bookingError) throw bookingError;
  reservationId = booking?.[0]?.request_id;
  assert.ok(reservationId, "debe existir solicitud pública para probar lectura admin");

  const { data: customerRow, error: customerLookupError } = await admin
    .from("customers")
    .select("id")
    .eq("phone_e164", phone)
    .single();
  if (customerLookupError) throw customerLookupError;
  customerId = customerRow.id;

  const authenticated = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: loginData, error: loginError } = await authenticated.auth.signInWithPassword({ email, password });
  if (loginError) throw loginError;
  assert.equal(loginData.user.id, userId, "login válido debe devolver el usuario esperado");
  assert.ok(loginData.session?.access_token, "login válido debe crear una sesión");

  const { data: currentUser } = await authenticated.auth.getUser();
  assert.equal(currentUser.user?.id, userId, "la sesión debe restaurar/validar al usuario mientras esté activa");

  const { data: context, error: contextError } = await authenticated.rpc("get_current_admin_context");
  if (contextError) throw contextError;
  assert.equal(context?.[0]?.role, "owner");
  assert.equal(context?.[0]?.business_id, businessId);

  const { data: rows, error: listError } = await authenticated.rpc("get_admin_reservation_requests", { p_limit: 100 });
  if (listError) throw listError;
  const row = rows.find((item) => item.reservation_id === reservationId);
  assert.ok(row, "el admin autorizado debe ver la solicitud del negocio");
  assert.equal(row.customer_name, "Cliente temporal Fase 5");
  assert.equal(row.customer_phone_e164, phone);

  const { error: anonPiiError } = await anon.from("customers").select("id,full_name,phone_e164").limit(1);
  assert.ok(anonPiiError, "anon no debe leer customers/PII directamente");

  const { data: publicAvailability, error: publicError } = await anon.rpc("get_public_availability", {
    p_business_slug: "valeibol-cajamarca",
    p_from: "2099-12-15",
    p_to: "2099-12-15",
  });
  if (publicError) throw publicError;
  const serializedPublic = JSON.stringify(publicAvailability);
  assert.ok(!serializedPublic.includes("Cliente temporal Fase 5"), "la RPC pública no debe filtrar nombre");
  assert.ok(!serializedPublic.includes(phone), "la RPC pública no debe filtrar teléfono");

  const { error: signOutError } = await authenticated.auth.signOut();
  if (signOutError) throw signOutError;
  const { data: afterLogout } = await authenticated.auth.getSession();
  assert.equal(afterLogout.session, null, "logout debe limpiar la sesión del cliente");

  const { error: postLogoutError } = await authenticated.rpc("get_admin_reservation_requests", { p_limit: 10 });
  assert.ok(postLogoutError, "tras logout no debe poder leer la RPC administrativa");

  console.log("PASS integration-phase5-auth · login, sesión, RLS/PII, lectura admin y logout");
} finally {
  if (reservationId) await admin.from("reservations").delete().eq("id", reservationId);
  if (customerId) await admin.from("customers").delete().eq("id", customerId);
  if (userId) {
    await admin.from("profiles").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
  }
}
