const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  process.exit(2);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const rpc = await fetch(`${url}/rest/v1/rpc/get_public_availability`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    p_business_slug: "valeibol-cajamarca",
    p_from: "2026-10-12",
    p_to: "2026-10-18",
  }),
});

const rpcPayload = await readJson(rpc);
if (!rpc.ok) {
  console.error("RPC pública falló:", rpc.status, rpcPayload);
  process.exit(1);
}
if (!Array.isArray(rpcPayload)) {
  console.error("La RPC pública no devolvió un arreglo.", rpcPayload);
  process.exit(1);
}

const forbidden = ["customer_id", "full_name", "phone_e164", "internal_notes", "created_by", "payment"];
const serialized = JSON.stringify(rpcPayload).toLowerCase();
for (const keyName of forbidden) {
  if (serialized.includes(keyName.toLowerCase())) {
    console.error(`PII/clave privada detectada en RPC pública: ${keyName}`);
    process.exit(1);
  }
}

for (const table of ["customers", "reservations", "schedule_blocks"]) {
  const direct = await fetch(`${url}/rest/v1/${table}?select=*`, { headers });
  if (direct.ok) {
    console.error(`ERROR: anon pudo leer directamente ${table}.`);
    process.exit(1);
  }
}

console.log("Smoke Supabase Fase 3: PASS");
console.log(`- RPC pública accesible (${rpcPayload.length} filas)`);
console.log("- sin claves PII detectadas en payload");
console.log("- anon no puede leer customers/reservations/schedule_blocks directamente");
