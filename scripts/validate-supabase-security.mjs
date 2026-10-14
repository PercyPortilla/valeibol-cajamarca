import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const migrationDir = "supabase/migrations";
const migrationNames = readdirSync(migrationDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

const migrations = migrationNames.map((name) => ({
  name,
  text: readFileSync(join(migrationDir, name), "utf8"),
}));

const failures = [];

for (const { name, text } of migrations) {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*--/.test(lines[i]) || !/\bsecurity\s+definer\b/i.test(lines[i])) continue;
    const nearby = lines.slice(i, i + 5).join("\n");
    if (!/set\s+search_path\s*=\s*public\s*,\s*pg_temp/i.test(nearby)) {
      failures.push(`${name}:${i + 1} SECURITY DEFINER sin search_path = public, pg_temp`);
    }
  }
}

const phase5 = readFileSync("supabase/migrations/202610140003_phase5_admin_auth.sql", "utf8");
if (!/revoke\s+insert\s*,\s*update\s*,\s*delete[\s\S]+from\s+authenticated/i.test(phase5)) {
  failures.push("Fase 5 no revoca DML directo a authenticated");
}

const phase7 = readFileSync("supabase/migrations/202610140005_phase7_customers_pricing_metrics.sql", "utf8");
if (!/v_actor\.role\s+not\s+in\s*\('owner'\s*,\s*'admin'\)/i.test(phase7)) {
  failures.push("Fase 7 no bloquea a staff en programación de tarifas");
}

const hardening = readFileSync("supabase/migrations/202610140006_phase7_production_hardening.sql", "utf8");
if (!/create_public_reservation_request[\s\S]+from\s+anon\s*,\s*authenticated/i.test(hardening)) {
  failures.push("Hardening no revoca la RPC de escritura pública a anon/authenticated");
}
if (!/create_public_reservation_request[\s\S]+to\s+service_role/i.test(hardening)) {
  failures.push("Hardening no concede la RPC autoritativa a service_role");
}

const allSource = migrations.map(({ text }) => text).join("\n");
if (/NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE/i.test(allSource)) {
  failures.push("Se detectó service role con prefijo NEXT_PUBLIC_ en migraciones");
}

if (failures.length) {
  console.error("Supabase security audit: FAIL");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(`Supabase security audit: PASS · ${migrationNames.length} migraciones revisadas`);
