import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const checks = [];
function check(name, condition) { checks.push({ name, ok: Boolean(condition) }); }
function read(path) { return readFileSync(resolve(root, path), "utf8"); }

const migrationPath = "supabase/migrations/202610140005_phase7_customers_pricing_metrics.sql";
const migration = read(migrationPath);
const publicPage = read("app/page.tsx");
const valeibolLanding = read("components/site/ValeibolLanding.tsx");
const dialog = read("components/booking/ReservationDialog.tsx");
const actions = read("app/admin/(protected)/actions.ts");
const css = [
  read("app/globals.css"),
  ...[1, 2, 3, 4, 5].map((part) => read(`app/styles/globals-${part}.css`)),
].join("\n");
const types = read("lib/data/supabase/database.types.ts");

check("migración Fase 7 existe", existsSync(resolve(root, migrationPath)));
check("Clientes RPC privada", migration.includes("get_admin_customers") && migration.includes("get_admin_customer_history"));
check("Precios versionados", migration.includes("admin_schedule_pricing_rule") && migration.includes("effective_until = p_effective_from - 1"));
check("staff rechazado en DB para precios", migration.includes("v_actor.role not in ('owner', 'admin')"));
check("métricas operativas", migration.includes("get_admin_operational_metrics") && migration.includes("confirmed_value") && migration.includes("completed_value"));
check("precios públicos por fecha", migration.includes("get_public_pricing_for_date") && migration.includes("p_date >= pr.effective_from"));
check("anon no recibe RPCs admin", migration.includes("revoke all on function public.get_admin_customers(integer) from public, anon, authenticated"));
check("UI Clientes real", existsSync(resolve(root, "app/admin/(protected)/clientes/page.tsx")));
check("UI Precios real", existsSync(resolve(root, "app/admin/(protected)/precios/page.tsx")));
check("UI actividad real", existsSync(resolve(root, "app/admin/(protected)/ingresos/page.tsx")));
check("repositorio desacoplado", existsSync(resolve(root, "lib/data/repositories/phase7Repository.ts")) && existsSync(resolve(root, "lib/data/repositories/supabasePhase7Repository.ts")));
check("acción precio específica", actions.includes("schedulePricingRuleAction") && actions.includes("manage_pricing"));
check(
  "web pública lee tarifa vigente",
  valeibolLanding.includes("getPublicCurrentPricing")
    && !valeibolLanding.includes("<strong>S/{businessConfig.pricing.withoutLights}"),
);
check("reserva pública lee tarifa por fecha", dialog.includes("getPricingForDate") && dialog.includes("pricingReady"));
check("tipos Supabase F7", types.includes("get_admin_customers") && types.includes("admin_schedule_pricing_rule") && types.includes("get_admin_operational_metrics"));
check("responsive 430 F7", css.includes("@media (max-width: 430px)") && css.includes("phase7-metric-grid"));
check("sin service role", ![migration, publicPage, valeibolLanding, dialog, actions].join("\n").includes("SUPABASE_SERVICE_ROLE_KEY"));

const failed = checks.filter((item) => !item.ok);
for (const item of checks) console.log(`${item.ok ? "PASS" : "FAIL"} · ${item.name}`);
if (failed.length) {
  console.error(`QA Fase 7: ${failed.length}/${checks.length} fallaron.`);
  process.exit(1);
}
console.log(`QA Fase 7: ${checks.length}/${checks.length} PASS`);
