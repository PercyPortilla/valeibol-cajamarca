import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];
const check = (name, condition) => checks.push({ name, ok: Boolean(condition) });

const packageJson = JSON.parse(read("package.json"));
const migration = read("supabase/migrations/202610140003_phase5_admin_auth.sql");
const proxy = read("proxy.ts");
const login = read("components/admin/AdminLoginForm.tsx");
const layout = read("app/admin/(protected)/layout.tsx");
const reservations = read("app/admin/(protected)/reservas/page.tsx");
const adminRepo = read("lib/data/repositories/supabaseAdminReservationRepository.ts");
const publicCalendar = read("components/availability/AvailabilityCalendar.tsx");
const publicDialog = read("components/booking/ReservationDialog.tsx");
const config = read("config/business.ts");
const css = read("app/globals.css");
const env = read(".env.example");

check("versión Fase 5", packageJson.version === "0.5.0");
check("proxy protege /admin", proxy.includes('matcher: ["/admin/:path*"]') && proxy.includes("auth.getUser"));
check("login usa Supabase Auth real", login.includes("signInWithPassword") && !login.includes("mock"));
check("login no simula auth sin config", login.includes("Supabase/Auth no configurado") && login.includes("disabled={!configured"));
check("logout existe", fs.existsSync(path.join(root, "components/admin/AdminLogoutButton.tsx")));
check("layout protegido valida perfil", layout.includes("requireAdminContext"));
check("roles owner/admin/staff presentes", migration.includes("'owner', 'admin', 'staff'"));
check("RPC admin deriva negocio desde auth.uid", migration.includes("p.user_id = auth.uid()") && migration.includes("get_admin_reservation_requests"));
check("RPC admin no es ejecutable por anon", migration.includes("revoke all on function public.get_admin_reservation_requests(integer) from public, anon, authenticated"));
check("Fase 5 revoca mutaciones directas", migration.includes("revoke insert, update, delete") && migration.includes("from authenticated"));
check("anon sigue sin leer PII", migration.includes("revoke all on public.profiles, public.customers, public.reservations"));
check("reservas administrativas pasan por repositorio", reservations.includes("createAdminReservationRepository") && !reservations.includes("createServerClient"));
check("repositorio admin usa RPC", adminRepo.includes('rpc("get_admin_reservation_requests"'));
check("vista admin muestra estados y PII mínima", reservations.includes("customerName") && reservations.includes("customerPhoneE164") && reservations.includes("reservationStatusLabel"));
check("vista admin es solo lectura", reservations.includes("Fase 5: lectura únicamente") && !reservations.includes("Confirmar reserva"));
check("web pública conserva CTA/flujo Fase 4", publicCalendar.includes('slot.status === "available"') && publicDialog.includes("createPublicBookingRepository"));
check("precios siguen centralizados 35/60", config.includes("withoutLights: 35") && config.includes("withLights: 60"));
check("timezone sigue America/Lima", config.includes('timezone: "America/Lima"'));
check("horario sigue provisional", config.includes('scheduleSource: "mock-provisional"'));
check("frontend no contiene service-role pública", !env.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE") && !login.includes("SERVICE_ROLE"));
check("responsive admin 360", css.includes("@media (max-width: 360px)") && css.includes(".admin-nav-item"));
check("responsive admin 390", css.includes("@media (max-width: 390px)"));
check("responsive admin 430", css.includes("@media (max-width: 430px)"));
check("tablet admin legible", css.includes("@media (max-width: 960px) and (min-width: 641px)"));
check("test SQL Fase 5 existe", fs.existsSync(path.join(root, "supabase/tests/phase5.sql")));
check("integration auth Fase 5 existe", fs.existsSync(path.join(root, "scripts/integration-phase5-auth.mjs")));

const failed = checks.filter((item) => !item.ok);
for (const item of checks) console.log(`${item.ok ? "PASS" : "FAIL"} · ${item.name}`);
if (failed.length) {
  console.error(`\n${failed.length} comprobación(es) fallaron.`);
  process.exit(1);
}
console.log(`\nQA estático Fase 5: PASS (${checks.length}/${checks.length})`);
