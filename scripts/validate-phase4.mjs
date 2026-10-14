import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];
const check = (name, condition) => checks.push({ name, ok: Boolean(condition) });

const migration3 = read("supabase/migrations/202610140001_phase3_core.sql");
const migration4 = read("supabase/migrations/202610140002_phase4_public_booking.sql");
const calendar = read("components/availability/AvailabilityCalendar.tsx");
const dialog = read("components/booking/ReservationDialog.tsx");
const bookingRepo = read("lib/data/repositories/supabaseBookingRepository.ts");
const mockRepo = read("lib/data/repositories/mockBookingRepository.ts");
const css = read("app/globals.css");
const config = read("config/business.ts");
const envExample = read(".env.example");

check("precio centralizado S/35 sin luz", config.includes("withoutLights: 35"));
check("precio centralizado S/60 con luz", config.includes("withLights: 60"));
check("timezone America/Lima", config.includes('timezone: "America/Lima"'));
check("horario fallback sigue marcado provisional", config.includes('scheduleSource: "mock-provisional"'));
check("pending bloquea disponibilidad en ledger", migration3.includes("new.status in ('pending', 'confirmed', 'completed')"));
check("RPC transaccional pública existe", migration4.includes("create_public_reservation_request"));
check("RPC no recibe hourly_rate", !/create_public_reservation_request\([\s\S]*?p_hourly_rate/i.test(migration4));
check("RPC no recibe total_amount", !/create_public_reservation_request\([\s\S]*?p_total_amount/i.test(migration4));
check("precio se lee de pricing_rules", migration4.includes("from public.pricing_rules pr"));
check("horario se valida contra operating_hours", migration4.includes("from public.operating_hours oh"));
check("fecha pasada se valida server-side", migration4.includes("reservation_in_past"));
check("solapamiento se traduce a slot_unavailable", migration4.includes("when exclusion_violation") && migration4.includes("slot_unavailable"));
check("idempotencia por request_token", migration4.includes("request_token") && migration4.includes("reservations_request_token_unique"));
check("anon sin acceso directo a customers/reservations", migration4.includes("revoke all on public.customers, public.reservations"));
check("anon solo ejecuta RPC controlada", migration4.includes("grant execute on function public.create_public_reservation_request"));
check("formulario usa repositorio y no SQL directo", dialog.includes("createPublicBookingRepository") && !dialog.includes("createBrowserClient"));
check("modo demo declara no persistencia", dialog.includes("Modo demostración · no guarda datos") && mockRepo.includes("persisted: false"));
check("CTA solo se renderiza para available", calendar.includes('slot.status === "available"'));
check("tras persistir revalida disponibilidad", calendar.includes("onPersisted={refreshAvailability}"));
check("PII no se inyecta en disponibilidad", !bookingRepo.includes("select(\"full_name") && migration3.includes("No devuelve customer_id, nombres, teléfonos"));
check("service role no está expuesta como NEXT_PUBLIC", !envExample.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE"));
check("service role de ejemplo no contiene valor", !/^SUPABASE_SERVICE_ROLE_KEY=.+$/m.test(envExample));
check("responsive 360", css.includes("@media (max-width: 360px)"));
check("responsive 390", css.includes("@media (max-width: 390px)"));
check("responsive 430", css.includes("@media (max-width: 430px)"));
check("selector móvil bajo 899", css.includes("@media (max-width: 899px)"));
check("dialog accesible nativo", dialog.includes("<dialog") && dialog.includes("onCancel"));

const failed = checks.filter((item) => !item.ok);
for (const item of checks) console.log(`${item.ok ? "PASS" : "FAIL"} · ${item.name}`);
if (failed.length) {
  console.error(`\n${failed.length} comprobación(es) fallaron.`);
  process.exit(1);
}
console.log(`\nQA estático Fase 4: PASS (${checks.length}/${checks.length})`);
