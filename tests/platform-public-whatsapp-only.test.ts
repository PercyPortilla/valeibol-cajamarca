import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PUBLIC_WHATSAPP_ONLY } from "../lib/platform/publicAccess.ts";
import { buildWhatsAppChatHref } from "../lib/whatsapp/links.ts";

const read = (path: string) => readFileSync(path, "utf8");

test("los visitantes coordinan por WhatsApp, sin cuenta ni reserva automática", () => {
  assert.equal(PUBLIC_WHATSAPP_ONLY, true);

  const calendar = read("components/availability/AvailabilityCalendar.tsx");
  const api = read("app/api/public/reservation-requests/route.ts");
  const header = read("components/platform/PlatformHeader.tsx");
  const account = read("app/mi-cuenta/page.tsx");
  const proxy = read("proxy.ts");

  assert.match(calendar, /whatsappForSlot/);
  assert.match(calendar, /buildWhatsAppChatHref/);
  assert.doesNotMatch(calendar, /<ReservationDialog/);
  assert.match(api, /if \(PUBLIC_WHATSAPP_ONLY\)[\s\S]*?jsonError\("reservations_via_whatsapp", 410\)/);
  assert.doesNotMatch(header, /href="\/mi-cuenta"/);
  assert.match(account, /if \(PUBLIC_WHATSAPP_ONLY\) redirect\("\/buscar"\)/);
  assert.match(proxy, /if \(PUBLIC_WHATSAPP_ONLY && isCustomerAccountPath\(pathname\)\)/);
});

test("la consulta incorpora día y horario sin inventar una reserva", () => {
  const message = "Hola, quisiera consultar el horario en Mi Cancha para Cancha 1 (voley), el 2026-11-18 de 18:00 a 19:00. ¿Podrían confirmar disponibilidad y tarifa?";
  const url = buildWhatsAppChatHref("+51935059868", message);
  assert.ok(url);
  const chatUrl = new URL(url);
  assert.equal(chatUrl.hostname, "wa.me");
  assert.equal(chatUrl.pathname, "/51935059868");
  assert.equal(chatUrl.searchParams.get("text"), message);
  assert.equal(buildWhatsAppChatHref("", message), null);
});

test("los accesos privados de madre e hijas permanecen diferenciados", () => {
  const global = read("app/admin-global/page.tsx");
  const tenant = read("app/propietario/page.tsx");
  const authorization = read("lib/auth/platformAdmin.ts");
  const account = read("components/admin/AdminLoginForm.tsx");
  assert.match(global, /requirePlatformAdminContext/);
  assert.match(global, /PlatformAdminBusinessOnboarding/);
  assert.match(global, /PlatformAdminBusinessList/);
  assert.match(tenant, /getPlatformAdminContext/);
  assert.match(tenant, /requireAdminContext/);
  assert.match(tenant, /redirect\("\/admin-global"\)/);
  assert.match(authorization, /get_platform_admin_context/);
  assert.match(account, /isPlatformAdmin \? "\/admin-global"/);
});

test("una sola cuenta administradora global activa; los perfiles hijas son independientes", () => {
  const migration = read("supabase/migrations/20261110165713_single_global_platform_owner.sql");
  assert.match(migration, /create unique index if not exists user_accounts_single_active_platform_admin/);
  assert.match(migration, /where role = 'admin' and is_active/);
  assert.match(migration, /multiple_active_platform_admins_need_review/);
  assert.doesNotMatch(migration, /update public\.profiles|delete from public\.profiles/i);
});
