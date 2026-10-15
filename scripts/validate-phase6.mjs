import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];
const check = (name, condition) => checks.push({ name, ok: Boolean(condition) });

const pkg = JSON.parse(read("package.json"));
const migration = read("supabase/migrations/202610140004_phase6_admin_operations.sql");
const board = read("components/admin/AdminScheduleBoard.tsx");
const page = read("app/admin/(protected)/disponibilidad/page.tsx");
const actions = read("app/admin/(protected)/actions.ts");
const repo = read("lib/data/repositories/supabaseAdminOperationsRepository.ts");
const publicCalendar = read("components/availability/AvailabilityCalendar.tsx");
const publicAvailability = read("lib/data/repositories/supabaseAvailabilityRepository.ts");
const publicRealtime = read("lib/data/availabilityRealtime.ts");
const config = read("config/business.ts");
const css = [
  read("app/globals.css"),
  ...[1, 2, 3, 4, 5].map((part) => read(`app/styles/globals-${part}.css`)),
].join("\n");
const env = read(".env.example");
const sqlTest = read("supabase/tests/phase6.sql");

check("versión Fase 6", pkg.version === "0.6.0");
check("pizarra administrativa específica", fs.existsSync(path.join(root, "app/admin/(protected)/disponibilidad/page.tsx")) && page.includes("AdminScheduleBoard"));
check("siete días en desktop", board.includes("admin-week-board") && css.includes("grid-template-columns: repeat(7"));
check("selector móvil de días", board.includes("admin-mobile-days") && css.includes(".admin-mobile-days"));
check("estados administrativos visibles", board.includes("pending") && board.includes("confirmed") && board.includes("blocked") && board.includes("completed"));
check("PII solo dentro de panel", board.includes("customerName") && board.includes("customerPhoneE164") && !publicAvailability.includes("customerName"));
check("confirmación usa RPC específica", repo.includes('rpc("admin_confirm_reservation"'));
check("cancelación usa RPC específica", repo.includes('rpc("admin_cancel_reservation"'));
check("reserva manual usa RPC específica", repo.includes('rpc("admin_create_manual_reservation"'));
check("edición usa RPC específica", repo.includes('rpc("admin_edit_reservation"'));
check("bloqueo/desbloqueo usan RPCs específicas", repo.includes('rpc("admin_create_schedule_block"') && repo.includes('rpc("admin_cancel_schedule_block"'));
check("UI no llama Supabase directamente", !board.includes("createClient(") && !board.includes("supabase.rpc"));
check("server actions validan sesión/rol", actions.includes("getAdminContext") && actions.includes("canPerformAdminOperation"));
check("server actions revalidan público y admin", actions.includes('revalidatePath("/")') && actions.includes('revalidatePath("/admin/disponibilidad")'));
check("negocio se deriva de auth.uid", migration.includes("phase6_admin_actor") && migration.includes("p.user_id = auth.uid()"));
check("RPCs no reciben business_id/precio/status", migration.includes("admin_create_manual_reservation") && sqlTest.includes("no aceptan business_id, precio, total ni status"));
check("DML genérico sigue revocado", migration.includes("revoke insert, update, delete") && migration.includes("from authenticated"));
check("anon no ejecuta operaciones admin", migration.includes("from public, anon, authenticated") && sqlTest.includes("anon no debe ejecutar funciones administrativas"));
check("confirmar no crea segunda ocupación", sqlTest.includes("exactamente una ocupación") || sqlTest.includes("conservar exactamente una ocupación"));
check("cancelación libera ledger", sqlTest.includes("cancelar debe liberar la ocupación"));
check("tarifa admin autoritativa 35/60", sqlTest.includes("hourly_rate <> 35") && sqlTest.includes("hourly_rate <> 60"));
check("staff sin edición avanzada", migration.includes("if v_actor.role = 'staff'") && board.includes('canPerformAdminOperation(role, "edit_reservation")'));
check("bloqueos tienen motivo", migration.includes("p_reason public.block_reason") && board.includes("blockReasonLabel"));
check("restricción EXCLUDE existente sigue fuente de verdad", migration.includes("slot_unavailable") && fs.readFileSync(path.join(root, "supabase/migrations/202610140001_phase3_core.sql"), "utf8").includes("exclude using gist"));
check("público sigue sin PII", publicCalendar.includes("Disponible") && publicAvailability.includes("busy_intervals") && !publicAvailability.includes("phone_e164"));
check("public refresh Realtime sanitizado", publicCalendar.includes("subscribeToPublicAvailabilityChanges") && publicRealtime.includes("availability_revisions") && migration.includes("availability_revisions") && migration.includes("supabase_realtime"));
check("polling fallback tras cambios externos", publicCalendar.includes("setInterval(refreshWhenVisible, 30000)") && publicCalendar.includes("visibilitychange"));
check("precios centralizados siguen 35/60", config.includes("withoutLights: 35") && config.includes("withLights: 60"));
check("timezone America/Lima intacta", config.includes('timezone: "America/Lima"'));
check("horario sigue provisional", config.includes('scheduleSource: "mock-provisional"'));
check("sin service role pública", !env.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE") && !board.includes("SERVICE_ROLE"));
check("confirmación destructiva para cancelar/desbloquear", board.includes("window.confirm") && board.includes("¿Cancelar esta reserva?"));
check("responsive 360", css.includes("@media (max-width: 360px)"));
check("responsive 390", css.includes("@media (max-width: 390px)"));
check("responsive 430", css.includes("@media (max-width: 430px)"));
check("tablet cambia a pizarra móvil", css.includes("@media (max-width: 900px)") && css.includes(".admin-week-board { display: none; }"));
check("SQL Fase 6 existe", fs.existsSync(path.join(root, "supabase/tests/phase6.sql")));
check("concurrencia Fase 6 preparada", fs.existsSync(path.join(root, "scripts/integration-phase6-concurrency.mjs")));
check("unit tests Fase 6 existen", fs.existsSync(path.join(root, "tests/admin-operations.test.ts")));

const failed = checks.filter((item) => !item.ok);
for (const item of checks) console.log(`${item.ok ? "PASS" : "FAIL"} · ${item.name}`);
if (failed.length) {
  console.error(`\n${failed.length} comprobación(es) fallaron.`);
  process.exit(1);
}
console.log(`\nQA estático Fase 6: PASS (${checks.length}/${checks.length})`);
