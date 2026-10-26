import { businessConfig } from "../../../config/business.ts";
import { addDays, businessTodayDateKey } from "../../availability.ts";
import type {
  AdminCustomerHistoryItem,
  AdminCustomerSummary,
  AdminOperationalMetrics,
  AdminPricingRule,
  SchedulePricingInput,
  SchedulePricingResult,
} from "../../admin/phase7.ts";
import { getLocalDateTimeParts } from "../../admin/schedule.ts";
import {
  Phase7RepositoryError,
  type AdminCustomerCursor,
  type AdminCustomerHistoryCursor,
  type Phase7Repository,
} from "./phase7Repository.ts";
import { LOCAL_COURT_ID, LOCAL_COURT_NAME, getLocalAdminState, nextLocalAdminUuid } from "../localAdminStore.ts";

function durationHours(startAt: string, endAt: string) {
  return Math.max(0, (new Date(endAt).getTime() - new Date(startAt).getTime()) / 3_600_000);
}

function inRange(iso: string, from: string, to: string) {
  const date = getLocalDateTimeParts(iso, businessConfig.timezone).date;
  return date >= from && date <= to;
}

export class LocalPhase7Repository implements Phase7Repository {
  private customerSummaries(): AdminCustomerSummary[] {
    const reservations = getLocalAdminState().reservations.filter((item) => item.customerId && item.customerName);
    const ids = [...new Set(reservations.map((item) => item.customerId!))];
    return ids.map((id) => {
      const items = reservations
        .filter((item) => item.customerId === id)
        .sort((a, b) => b.startAt.localeCompare(a.startAt) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
      const first = items[0]!;
      return {
        id,
        fullName: first.customerName ?? "Cliente local",
        phoneE164: first.customerPhoneE164,
        marketingOptIn: false,
        createdAt: items.reduce((oldest, item) => item.createdAt < oldest ? item.createdAt : oldest, first.createdAt),
        lastActivityAt: first.startAt,
        lastReservationAt: first.startAt,
        reservationCount: items.length,
        activeReservationCount: items.filter((item) => item.status === "pending" || item.status === "confirmed").length,
        completedReservationCount: items.filter((item) => item.status === "completed").length,
        cancelledReservationCount: items.filter((item) => item.status === "cancelled").length,
        confirmedValue: items.filter((item) => item.status === "confirmed").reduce((sum, item) => sum + item.totalAmount, 0),
        completedValue: items.filter((item) => item.status === "completed").reduce((sum, item) => sum + item.totalAmount, 0),
        currency: businessConfig.currency,
      };
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  }

  async listCustomers(limit = 100): Promise<AdminCustomerSummary[]> {
    return this.customerSummaries().slice(0, Math.max(1, Math.min(limit, 500)));
  }

  async getCustomerHistory(customerId: string, limit = 100): Promise<AdminCustomerHistoryItem[]> {
    return getLocalAdminState().reservations
      .filter((item) => item.customerId === customerId)
      .sort((a, b) => b.startAt.localeCompare(a.startAt))
      .slice(0, Math.max(1, Math.min(limit, 500)))
      .map((item) => ({ id: item.id, courtId: item.courtId, courtName: item.courtName, startAt: item.startAt, endAt: item.endAt, status: item.status, lighting: item.lighting, netHeightCm: item.netHeightCm, hourlyRate: item.hourlyRate, totalAmount: item.totalAmount, source: item.source, createdAt: item.createdAt, updatedAt: item.createdAt, currency: item.currency }));
  }

  async listCustomersPage(options?: { limit?: number; cursor?: AdminCustomerCursor | null }) {
    const limit = Math.max(1, Math.min(options?.limit ?? 30, 100));
    const cursor = options?.cursor ?? null;
    const rows = this.customerSummaries().filter((item) => !cursor
      || item.createdAt < cursor.createdAt
      || (item.createdAt === cursor.createdAt && item.id < cursor.id));
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor: rows.length > limit && last ? { createdAt: last.createdAt, id: last.id } : null,
    };
  }

  async getCustomer(customerId: string) {
    const customer = this.customerSummaries().find((item) => item.id === customerId);
    if (!customer) throw new Phase7RepositoryError("not_found", "No encontramos el cliente dentro de tu negocio.");
    return customer;
  }

  async getCustomerHistoryPage(customerId: string, options?: { limit?: number; cursor?: AdminCustomerHistoryCursor | null }) {
    if (!this.customerSummaries().some((item) => item.id === customerId)) {
      throw new Phase7RepositoryError("not_found", "No encontramos el cliente dentro de tu negocio.");
    }
    const limit = Math.max(1, Math.min(options?.limit ?? 25, 100));
    const cursor = options?.cursor ?? null;
    const rows = getLocalAdminState().reservations
      .filter((item) => item.customerId === customerId)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
      .filter((item) => !cursor
        || item.createdAt < cursor.createdAt
        || (item.createdAt === cursor.createdAt && item.id < cursor.id));
    const pageRows = rows.slice(0, limit);
    const items = pageRows.map((item) => ({
      id: item.id,
      courtId: item.courtId,
      courtName: item.courtName,
      startAt: item.startAt,
      endAt: item.endAt,
      status: item.status,
      lighting: item.lighting,
      netHeightCm: item.netHeightCm,
      hourlyRate: item.hourlyRate,
      totalAmount: item.totalAmount,
      source: item.source,
      createdAt: item.createdAt,
      updatedAt: item.createdAt,
      currency: item.currency,
    }));
    const last = pageRows.at(-1);
    return {
      items,
      nextCursor: rows.length > limit && last ? { createdAt: last.createdAt, id: last.id } : null,
    };
  }

  async listPricingRules(): Promise<AdminPricingRule[]> {
    const today = businessTodayDateKey();
    const rules = getLocalAdminState().pricingRules;
    return rules
      .map((rule) => ({ ...rule, businessToday: today, isCurrent: rule.isActive && rule.effectiveFrom <= today && (!rule.effectiveUntil || rule.effectiveUntil >= today) }))
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  }

  async schedulePricingRule(input: SchedulePricingInput): Promise<SchedulePricingResult> {
    if (input.courtId !== LOCAL_COURT_ID) throw new Phase7RepositoryError("not_found", "La cancha local no existe.");
    const state = getLocalAdminState();
    if (state.pricingRules.some((rule) => rule.courtId === input.courtId && rule.lighting === input.lighting && rule.effectiveFrom === input.effectiveFrom)) {
      throw new Phase7RepositoryError("conflict", "Ya existe una tarifa local que comienza en esa fecha.");
    }
    state.pricingRules
      .filter((rule) => rule.courtId === input.courtId && rule.lighting === input.lighting && rule.isActive && rule.effectiveFrom < input.effectiveFrom && (!rule.effectiveUntil || rule.effectiveUntil >= input.effectiveFrom))
      .forEach((rule) => { rule.effectiveUntil = addDays(input.effectiveFrom, -1); rule.updatedAt = new Date().toISOString(); });
    const now = new Date().toISOString();
    const rule: AdminPricingRule = {
      id: nextLocalAdminUuid("40000000"), courtId: LOCAL_COURT_ID, courtName: LOCAL_COURT_NAME, lighting: input.lighting,
      label: input.lighting === "with_lights" ? "Con iluminación" : "Sin iluminación", hourlyRate: input.hourlyRate,
      effectiveFrom: input.effectiveFrom, effectiveUntil: null, isActive: true, configurationStatus: "provisional", createdBy: null,
      createdAt: now, updatedAt: now, isCurrent: input.effectiveFrom <= businessTodayDateKey(), currency: businessConfig.currency, businessToday: businessTodayDateKey(),
    };
    state.pricingRules.push(rule);
    return { id: rule.id, courtId: rule.courtId, lighting: rule.lighting, hourlyRate: rule.hourlyRate, effectiveFrom: rule.effectiveFrom, effectiveUntil: rule.effectiveUntil, currency: rule.currency };
  }

  async getOperationalMetrics(from: string, to: string): Promise<AdminOperationalMetrics> {
    const state = getLocalAdminState();
    const reservations = state.reservations.filter((item) => inRange(item.startAt, from, to));
    const blocks = state.blocks.filter((item) => item.status === "active" && inRange(item.startAt, from, to));
    const pendingHours = reservations.filter((item) => item.status === "pending").reduce((sum, item) => sum + durationHours(item.startAt, item.endAt), 0);
    const reservedHours = reservations.filter((item) => item.status === "confirmed" || item.status === "completed").reduce((sum, item) => sum + durationHours(item.startAt, item.endAt), 0);
    const blockingHours = blocks.reduce((sum, item) => sum + durationHours(item.startAt, item.endAt), 0);
    let days = 0;
    for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) days += 1;
    const openCapacityHours = days * 15;
    const agendaOccupiedHours = pendingHours + reservedHours + blockingHours;
    return {
      from, to,
      reservationCount: reservations.length,
      pendingCount: reservations.filter((item) => item.status === "pending").length,
      confirmedCount: reservations.filter((item) => item.status === "confirmed").length,
      completedCount: reservations.filter((item) => item.status === "completed").length,
      cancelledCount: reservations.filter((item) => item.status === "cancelled").length,
      pendingHours,
      reservedHours,
      confirmedValue: reservations.filter((item) => item.status === "confirmed").reduce((sum, item) => sum + item.totalAmount, 0),
      completedValue: reservations.filter((item) => item.status === "completed").reduce((sum, item) => sum + item.totalAmount, 0),
      openCapacityHours,
      agendaOccupiedHours,
      occupancyPercent: openCapacityHours > 0 ? Math.min(100, (agendaOccupiedHours / openCapacityHours) * 100) : 0,
      currency: businessConfig.currency,
      timezone: businessConfig.timezone,
    };
  }
}
