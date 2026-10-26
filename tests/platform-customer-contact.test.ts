import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261025070000_block31_customer_business_contact.sql", "utf8");
const sqlTest = readFileSync("supabase/tests/platform_customer_contact.sql", "utf8");
const service = readFileSync("lib/data/publicBusinessContactService.ts", "utf8");
const accountPage = readFileSync("app/mi-cuenta/page.tsx", "utf8");
const complexPage = readFileSync("app/complejo/[slug]/page.tsx", "utf8");
const types = readFileSync("lib/data/supabase/database.types.ts", "utf8");
const styles = readFileSync("app/styles/globals-5.css", "utf8");
const links = readFileSync("lib/whatsapp/links.ts", "utf8");

test("B31 extiende el historial propio con contacto del negocio sin depender de publicación", () => {
  assert.match(migration, /business_phone text/i);
  assert.match(migration, /b\.phone/i);
  assert.match(migration, /r\.user_id = \(select auth\.uid\(\)\)/i);
  assert.doesNotMatch(migration, /configuration_status|b\.is_active/i);
  assert.match(migration, /revoke all on function public\.get_my_reservations\(\) from public, anon/i);
  assert.match(sqlTest, /tenant provisional no debe aparecer en config pública/i);
  assert.match(sqlTest, /historial propio debe conservar contacto del negocio/i);
});

test("B31 normaliza teléfono y la ficha genérica usa solo config pública publicada", () => {
  assert.match(service, /get_public_business_config/);
  assert.match(service, /p_business_slug: normalizedSlug/);
  assert.match(service, /normalizePeruWhatsApp/);
  assert.match(service, /normalizedSlug === businessConfig\.slug/);
  assert.match(complexPage, /getPublicBusinessContact\(business\.slug\)/);
  assert.match(complexPage, /buildWhatsAppChatHref/);
  assert.match(complexPage, /Contactar por WhatsApp/);
  assert.match(complexPage, /no publicó un WhatsApp de contacto/);
});

test("Mi cuenta cierra coordinación solo para reservas activas que requieren negocio", () => {
  assert.match(accountPage, /reservation\.status === "confirmed" \|\| \(reservation\.status === "pending" && !reservation\.can_withdraw\)/);
  assert.match(accountPage, /normalizePublicBusinessPhone\(reservation\.business_phone\)/);
  assert.match(accountPage, /buildWhatsAppChatHref/);
  assert.match(accountPage, /Contactar por WhatsApp/);
  assert.match(accountPage, /Este negocio no publicó un WhatsApp de contacto/);
  assert.doesNotMatch(accountPage, /getPublicBusinessContact\(/);
  assert.match(types, /get_my_reservations:[\s\S]*business_phone: string \| null[\s\S]*can_withdraw: boolean/);
});

test("B31 mantiene enlaces WhatsApp validados y targets accesibles", () => {
  assert.match(links, /const E164 = \/\^\[\+\]\[1-9\]\[0-9\]\{7,14\}\$\//);
  assert.match(links, /if \(!E164\.test\(normalized\)\) return null/);
  assert.match(styles, /\.account-whatsapp-contact \{[^}]*min-height: 44px/);
  assert.match(styles, /\.platform-whatsapp-contact \{[^}]*min-height: 44px/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*?\.platform-whatsapp-contact \{ width: 100%; justify-content: center; \}/);
});
