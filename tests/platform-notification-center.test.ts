import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261025113000_block41_notification_center.sql", "utf8");
const account = readFileSync("app/mi-cuenta/page.tsx", "utf8");
const customerUi = readFileSync("components/account/CustomerNotificationCenter.tsx", "utf8");
const adminPage = readFileSync("app/admin/(protected)/notificaciones/page.tsx", "utf8");
const adminUi = readFileSync("components/admin/AdminNotificationCenter.tsx", "utf8");
const adminLayout = readFileSync("app/admin/(protected)/layout.tsx", "utf8");
const adminNavigation = readFileSync("components/admin/AdminNavigation.tsx", "utf8");
const types = readFileSync("lib/data/supabase/database.types.ts", "utf8");
const sqlRunner = readFileSync("scripts/run-supabase-sql-tests.mjs", "utf8");

test("B41 usa tablas privadas y estado de lectura por usuario", () => {
  assert.match(migration, /create table if not exists public\.app_notifications/);
  assert.match(migration, /create table if not exists public\.app_notification_reads/);
  assert.match(migration, /primary key \(notification_id, user_id\)/);
  assert.match(migration, /alter table public\.app_notifications enable row level security/);
  assert.match(migration, /revoke all on public\.app_notifications from public, anon, authenticated/);
  assert.match(migration, /revoke all on public\.app_notification_reads from public, anon, authenticated/);
  assert.match(migration, /revoke all on function public\.block41_queue_reservation_notification\(\) from public, anon, authenticated/i);
  assert.match(migration, /revoke all on function public\.block41_queue_change_request_notification\(\) from public, anon, authenticated/i);
});

test("B41 genera eventos desde reservations y change requests sin depender de WhatsApp", () => {
  assert.match(migration, /reservations_block41_notification/);
  assert.match(migration, /reservation_change_requests_block41_notification/);
  assert.match(migration, /reservation_requested/);
  assert.match(migration, /reservation_confirmed/);
  assert.match(migration, /cancellation_requested/);
  assert.match(migration, /cancellation_approved/);
  assert.match(migration, /cancellation_rejected/);
  assert.match(migration, /reschedule_requested/);
  assert.match(migration, /reschedule_approved/);
  assert.match(migration, /reschedule_rejected/);
  assert.doesNotMatch(migration, /whatsapp_outbox|phase8_/i);
  assert.doesNotMatch(migration, /exception when others then/i);
  assert.match(migration, /update of status, user_id on public\.reservations/i);
});

test("B41 fecha una confirmación reclamada con el momento del claim y no con la confirmación histórica", () => {
  const fn = migration.match(/create or replace function public\.block41_queue_reservation_notification[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /old\.status = new\.status[\s\S]*old\.user_id is distinct from new\.user_id[\s\S]*then now\(\)/i);
  assert.match(fn, /else coalesce\(new\.status_changed_at, now\(\)\)/i);
  assert.match(fn, /'reservation_confirmed',[\s\S]*v_customer_created_at/i);
});

test("B41 liga declarativamente cada evento al mismo tenant de su fuente", () => {
  assert.match(migration, /reservation_id uuid not null/);
  assert.match(migration, /foreign key \(reservation_id, business_id\)[\s\S]*?references public\.reservations\(id, business_id\)/i);
  assert.match(migration, /foreign key \(change_request_id, business_id\)[\s\S]*?references public\.reservation_change_requests\(id, business_id\)/i);
  assert.match(migration, /change_request_id is null and event_type in \('reservation_requested','reservation_confirmed'\)/i);
});

test("B41 cliente solo lee y marca sus propias notificaciones", () => {
  const listFn = migration.match(/create or replace function public\.get_my_notifications[\s\S]*?\$\$;/i)?.[0] ?? "";
  const markFn = migration.match(/create or replace function public\.mark_my_notification_read[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(listFn, /n\.recipient_user_id = \(select auth\.uid\(\)\)/);
  assert.match(listFn, /n\.audience = 'customer'/);
  assert.match(markFn, /n\.recipient_user_id = v_uid/);
  assert.doesNotMatch(markFn, /p_user_id|p_business_id/i);
});

test("B41 admin queda aislado al tenant activo y lectura es individual por operador", () => {
  const listFn = migration.match(/create or replace function public\.get_admin_notifications[\s\S]*?\$\$;/i)?.[0] ?? "";
  const markFn = migration.match(/create or replace function public\.mark_admin_notification_read[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(listFn, /phase6_admin_actor\(\)/);
  assert.match(listFn, /n\.business_id = v_actor\.business_id/);
  assert.match(markFn, /n\.business_id = v_actor\.business_id/);
  assert.match(markFn, /v_actor\.user_id/);
  assert.doesNotMatch(markFn, /p_business_id|p_user_id/i);
});

test("B41 expone centros cliente/admin y contador en navegación", () => {
  assert.match(account, /CustomerNotificationCenter/);
  assert.match(account, /get_my_notifications(?:_page)?/);
  assert.match(account, /get_my_notification_unread_count/);
  assert.match(customerUi, /mark_my_notification_read/);
  assert.match(customerUi, /mark_all_my_notifications_read/);
  assert.match(adminPage, /get_admin_notifications(?:_page)?/);
  assert.match(adminUi, /mark_admin_notification_read/);
  assert.match(adminUi, /mark_all_admin_notifications_read/);
  assert.match(adminLayout, /get_admin_notification_unread_count/);
  assert.match(adminNavigation, /\/admin\/notificaciones/);
  assert.match(adminNavigation, /admin-nav-item__count/);
});

test("B41 sincroniza tipos y runner SQL", () => {
  assert.match(types, /get_my_notifications/);
  assert.match(types, /get_admin_notifications/);
  assert.match(types, /mark_my_notification_read/);
  assert.match(types, /mark_admin_notification_read/);
  assert.match(sqlRunner, /platform_notification_center\.sql/);
});

