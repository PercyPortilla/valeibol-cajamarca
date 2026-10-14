import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { businessConfig } from "../config/business.ts";
import { calculateBookingPreview } from "../lib/booking.ts";
import { canPerformPhase7Operation, pricingTemporalStatus, type AdminPricingRule } from "../lib/admin/phase7.ts";

test("owner/admin administran precios; staff conserva lectura y métricas", () => {
  for (const role of ["owner", "admin"] as const) {
    assert.equal(canPerformPhase7Operation(role, "read_customers"), true);
    assert.equal(canPerformPhase7Operation(role, "read_pricing"), true);
    assert.equal(canPerformPhase7Operation(role, "manage_pricing"), true);
    assert.equal(canPerformPhase7Operation(role, "read_metrics"), true);
  }
  assert.equal(canPerformPhase7Operation("staff", "read_customers"), true);
  assert.equal(canPerformPhase7Operation("staff", "read_pricing"), true);
  assert.equal(canPerformPhase7Operation("staff", "read_metrics"), true);
  assert.equal(canPerformPhase7Operation("staff", "manage_pricing"), false);
});

test("la configuración comercial inicial sigue siendo S/35 y S/60", () => {
  assert.equal(businessConfig.pricing.withoutLights, 35);
  assert.equal(businessConfig.pricing.withLights, 60);
});

test("la previsualización pública acepta tarifas vigentes dinámicas sin cambiar el cálculo server-side", () => {
  const preview = calculateBookingPreview("18:00", "20:00", "without_lights", { withoutLights: 42, withLights: 70 });
  assert.equal(preview.hourlyRate, 42);
  assert.equal(preview.total, 84);
  const withLights = calculateBookingPreview("18:00", "20:00", "with_lights", { withoutLights: 42, withLights: 70 });
  assert.equal(withLights.total, 140);
});

test("clasifica reglas vigente, futura e histórica por fecha del negocio", () => {
  const base: AdminPricingRule = {
    id: "1", courtId: "c", courtName: "Cancha", lighting: "without_lights", label: "Sin luz",
    hourlyRate: 35, effectiveFrom: "2026-01-01", effectiveUntil: null, isActive: true,
    configurationStatus: "confirmed", createdBy: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
    isCurrent: true, currency: "PEN", businessToday: "2026-10-14",
  };
  assert.equal(pricingTemporalStatus(base), "current");
  assert.equal(pricingTemporalStatus({ ...base, isCurrent: false, effectiveFrom: "2026-11-01" }), "future");
  assert.equal(pricingTemporalStatus({ ...base, isCurrent: false, effectiveFrom: "2026-01-01", effectiveUntil: "2026-10-13" }), "historical");
});

test("la migración Fase 7 deriva negocio desde auth/profile y no acepta business_id/precio histórico desde el navegador", () => {
  const sql = readFileSync(new URL("../supabase/migrations/202610140005_phase7_customers_pricing_metrics.sql", import.meta.url), "utf8");
  const pricingSignature = sql.match(/create or replace function public\.admin_schedule_pricing_rule\(([\s\S]*?)\)\nreturns table/i)?.[1] ?? "";
  assert.equal(/business_id|total_amount|status/i.test(pricingSignature), false);
  assert.match(sql, /phase6_admin_actor\(\)/);
  assert.match(sql, /v_actor\.role not in \('owner', 'admin'\)/);
});

test("las superficies públicas de Fase 7 no devuelven PII de clientes", () => {
  const sql = readFileSync(new URL("../supabase/migrations/202610140005_phase7_customers_pricing_metrics.sql", import.meta.url), "utf8");
  const publicPricing = sql.slice(sql.indexOf("create or replace function public.get_public_pricing_for_date"), sql.indexOf("create or replace function public.get_public_business_config"));
  assert.equal(/customer|phone_e164|full_name|internal_notes|marketing_opt_in/i.test(publicPricing), false);
});
