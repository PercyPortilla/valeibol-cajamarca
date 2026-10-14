import { createServerSupabaseClient } from "../supabase/server.ts";
import type { Database } from "../supabase/database.types.ts";
import type {
  AdminCustomerHistoryItem,
  AdminCustomerSummary,
  AdminOperationalMetrics,
  AdminPricingRule,
  SchedulePricingInput,
  SchedulePricingResult,
} from "../../admin/phase7.ts";
import { Phase7RepositoryError, type Phase7Repository } from "./phase7Repository.ts";

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function mapError(message: string, code?: string) {
  const normalized = message.toLowerCase();
  if (code === "42501" || normalized.includes("insufficient_role") || normalized.includes("profile_required") || normalized.includes("permission")) {
    return new Phase7RepositoryError("unauthorized", "No tienes permiso para realizar esta operación.");
  }
  if (code === "23P01" || normalized.includes("conflict")) {
    return new Phase7RepositoryError("conflict", "Existe una regla vigente/programada que entra en conflicto con esa fecha.");
  }
  if (code === "P0002" || normalized.includes("not_found")) {
    return new Phase7RepositoryError("not_found", "No encontramos el registro solicitado dentro de tu negocio.");
  }
  if (code === "22023" || normalized.includes("invalid_") || normalized.includes("in_past")) {
    return new Phase7RepositoryError("validation", "Los datos enviados no son válidos para esta operación.");
  }
  if (normalized.includes("fetch") || normalized.includes("network")) {
    return new Phase7RepositoryError("network", "No pudimos conectar con Supabase. Inténtalo nuevamente.");
  }
  return new Phase7RepositoryError("unknown", "No pudimos completar la operación.");
}

export class SupabasePhase7Repository implements Phase7Repository {
  async listCustomers(limit = 100): Promise<AdminCustomerSummary[]> {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("get_admin_customers", { p_limit: Math.max(1, Math.min(limit, 500)) });
    if (error) throw mapError(error.message, error.code);

    type Row = Database["public"]["Functions"]["get_admin_customers"]["Returns"][number];
    return ((data ?? []) as Row[]).map((row) => ({
      id: row.customer_id,
      fullName: row.full_name,
      phoneE164: row.phone_e164,
      marketingOptIn: row.marketing_opt_in,
      createdAt: row.customer_created_at,
      lastActivityAt: row.last_activity_at,
      lastReservationAt: row.last_reservation_at,
      reservationCount: toNumber(row.reservation_count),
      activeReservationCount: toNumber(row.active_reservation_count),
      completedReservationCount: toNumber(row.completed_reservation_count),
      cancelledReservationCount: toNumber(row.cancelled_reservation_count),
      confirmedValue: toNumber(row.confirmed_value),
      completedValue: toNumber(row.completed_value),
      currency: row.currency,
    }));
  }

  async getCustomerHistory(customerId: string, limit = 100): Promise<AdminCustomerHistoryItem[]> {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("get_admin_customer_history", {
      p_customer_id: customerId,
      p_limit: Math.max(1, Math.min(limit, 500)),
    });
    if (error) throw mapError(error.message, error.code);

    type Row = Database["public"]["Functions"]["get_admin_customer_history"]["Returns"][number];
    return ((data ?? []) as Row[]).map((row) => ({
      id: row.reservation_id,
      courtId: row.court_id,
      courtName: row.court_name,
      startAt: row.start_at,
      endAt: row.end_at,
      status: row.status,
      lighting: row.lighting,
      hourlyRate: toNumber(row.hourly_rate),
      totalAmount: toNumber(row.total_amount),
      source: row.source,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      currency: row.currency,
    }));
  }

  async listPricingRules(): Promise<AdminPricingRule[]> {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("get_admin_pricing_rules");
    if (error) throw mapError(error.message, error.code);

    type Row = Database["public"]["Functions"]["get_admin_pricing_rules"]["Returns"][number];
    return ((data ?? []) as Row[]).map((row) => ({
      id: row.pricing_rule_id,
      courtId: row.court_id,
      courtName: row.court_name,
      lighting: row.lighting,
      label: row.label,
      hourlyRate: toNumber(row.hourly_rate),
      effectiveFrom: row.effective_from,
      effectiveUntil: row.effective_until,
      isActive: row.is_active,
      configurationStatus: row.configuration_status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isCurrent: row.is_current,
      currency: row.currency,
      businessToday: row.business_today,
    }));
  }

  async schedulePricingRule(input: SchedulePricingInput): Promise<SchedulePricingResult> {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("admin_schedule_pricing_rule", {
      p_court_id: input.courtId,
      p_lighting: input.lighting,
      p_hourly_rate: input.hourlyRate,
      p_effective_from: input.effectiveFrom,
    });
    if (error) throw mapError(error.message, error.code);

    type Row = Database["public"]["Functions"]["admin_schedule_pricing_rule"]["Returns"][number];
    const row = ((data ?? []) as Row[])[0];
    if (!row) throw new Phase7RepositoryError("unknown", "Supabase no devolvió la nueva regla de precio.");
    return {
      id: row.pricing_rule_id,
      courtId: row.court_id,
      lighting: row.lighting,
      hourlyRate: toNumber(row.hourly_rate),
      effectiveFrom: row.effective_from,
      effectiveUntil: row.effective_until,
      currency: row.currency,
    };
  }

  async getOperationalMetrics(from: string, to: string): Promise<AdminOperationalMetrics> {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("get_admin_operational_metrics", { p_from: from, p_to: to });
    if (error) throw mapError(error.message, error.code);

    type Row = Database["public"]["Functions"]["get_admin_operational_metrics"]["Returns"][number];
    const row = ((data ?? []) as Row[])[0];
    if (!row) throw new Phase7RepositoryError("unknown", "No pudimos calcular las métricas del periodo.");
    return {
      from: row.period_from,
      to: row.period_to,
      reservationCount: toNumber(row.reservation_count),
      pendingCount: toNumber(row.pending_count),
      confirmedCount: toNumber(row.confirmed_count),
      completedCount: toNumber(row.completed_count),
      cancelledCount: toNumber(row.cancelled_count),
      pendingHours: toNumber(row.pending_hours),
      reservedHours: toNumber(row.reserved_hours),
      confirmedValue: toNumber(row.confirmed_value),
      completedValue: toNumber(row.completed_value),
      openCapacityHours: toNumber(row.open_capacity_hours),
      agendaOccupiedHours: toNumber(row.agenda_occupied_hours),
      occupancyPercent: toNumber(row.occupancy_percent),
      currency: row.currency,
      timezone: row.timezone,
    };
  }
}
