const baseUrl = (process.env.PRODUCTION_BASE_URL || "https://valeibol-cajamarca-live.vercel.app").replace(/\/$/, "");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY para comprobar el backend real.");
  process.exit(2);
}

async function expectStatus(url, expected) {
  const response = await fetch(url, { redirect: "manual", cache: "no-store" });
  if (!expected.includes(response.status)) {
    console.error(`FAIL ${url}: HTTP ${response.status}; esperado ${expected.join("/")}`);
    process.exit(1);
  }
  return response;
}

await expectStatus(baseUrl, [200]);
await expectStatus(`${baseUrl}/privacidad`, [200]);

const admin = await expectStatus(`${baseUrl}/admin`, [301, 302, 303, 307, 308]);
const location = admin.headers.get("location") || "";
if (!location.includes("/admin/login")) {
  console.error("FAIL: /admin no redirigió al login protegido.", location);
  process.exit(1);
}

const headers = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  "Content-Type": "application/json",
};

const availability = await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_availability`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    p_business_slug: "valeibol-cajamarca",
    p_from: new Date().toISOString().slice(0, 10),
    p_to: new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10),
  }),
});
if (!availability.ok) {
  console.error("FAIL: disponibilidad Supabase no respondió correctamente.", availability.status);
  process.exit(1);
}
const payload = await availability.json();
if (!Array.isArray(payload)) {
  console.error("FAIL: disponibilidad Supabase no devolvió un arreglo.");
  process.exit(1);
}

for (const table of ["customers", "reservations", "profiles"]) {
  const direct = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*`, { headers });
  if (direct.ok) {
    console.error(`FAIL: anon pudo leer directamente ${table}.`);
    process.exit(1);
  }
}

console.log("PASS smoke production");
console.log(`- homepage HTTP 200: ${baseUrl}`);
console.log("- privacidad HTTP 200");
console.log("- admin protegido por redirect a login");
console.log(`- disponibilidad real Supabase: ${payload.length} filas`);
console.log("- anon sin acceso directo a customers/reservations/profiles");
