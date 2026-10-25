import { createServerSupabaseClient } from "../supabase/server.ts";
import type { Database, Json } from "../supabase/database.types.ts";
import type {
  AdminBlockScheduleEntry,
  AdminReservationScheduleEntry,
  AdminScheduleDay,
  AdminScheduleEntry,
} from "../../admin/schedule.ts";
import type { AdminBlockReason } from "../../admin/operations.ts";
import {
  AdminOperationsRepositoryError,
  groupAdminScheduleDays,
  type AdminMutationBlockResult,
  type AdminMutationReservationResult,
  type AdminOperationsRepository,
  type CreateManualReservationInput,
  type CreateScheduleBlockInput,
  type EditReservationInput,
} from "./adminOperationsRepository.ts";

function toNumber(value: number | string | null | undefined) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function isObject(value: Json): value is { [key: string]: Json | undefined } {
  return !!value && !Array.isArray(value) && typeof value === "object";
}

function stringOrNull(value: Json | undefined) {
  return typeof value === "string" ? value : null;
}

function parseScheduleEntries(value: Json): AdminScheduleEntry[] {
  if (!Array.isArray(value)) return [];

  const entries: AdminScheduleEntry[] = [];
  for (const raw of value) {
    if (!isObject(raw)) continue;
    const entryKind = raw.entryKind;
    const id = stringOrNull(raw.id);
    const status = stringOrNull(raw.status);
    const startAt = stringOrNull(raw.startAt);
    const endAt = stringOrNull(raw.endAt);
    const currency = stringOrNull(raw.currency) ?? "PEN";
    if (!id || !status || !startAt || !endAt) continue;

    if (entryKind === "reservation") {
      const lighting = stringOrNull(raw.lighting);
      const source = stringOrNull(raw.source);
      if (
        !["pending", "confirmed", "cancelled", "completed"].includes(status) ||
        !["without_lights", "with_lights"].includes(lighting ?? "") ||
        !["public_web", "admin", "phone", "whatsapp", "other"].includes(source ?? "")
      ) {
        continue;
      }

      entries.push({
        entryKind: "reservation",
        id,
        status: status as AdminReservationScheduleEntry["status"],
        startAt,
        endAt,
        customerName: stringOrNull(raw.customerName),
        customerPhoneE164: stringOrNull(raw.customerPhoneE164),
        lighting: lighting as AdminReservationScheduleEntry["lighting"],
        netHeightCm: typeof raw.netHeightCm === "number" ? raw.netHeightCm : null,
        hourlyRate: toNumber(raw.hourlyRate as number | string | null | undefined),
        totalAmount: toNumber(raw.totalAmount as number | string | null | undefined),
        currency,
        source: source as AdminReservationScheduleEntry["source"],
        blockReason: null,
        internalNote: null,
      });
      continue;
    }

    if (entryKind === "block") {
      const reason = stringOrNull(raw.blockReason);
      if (
        !["active", "cancelled"].includes(status) ||
        !["maintenance", "academy", "tournament", "event", "closure", "other"].includes(reason ?? "")
      ) {
        continue;
      }

      entries.push({
        entryKind: "block",
        id,
        status: status as AdminBlockScheduleEntry["status"],
        startAt,
        endAt,
        customerName: null,
        customerPhoneE164: null,
        lighting: null,
        netHeightCm: null,
        hourlyRate: null,
        totalAmount: null,
        currency,
        source: null,
        blockReason: reason as AdminBlockReason,
        internalNote: stringOrNull(raw.internalNote),
      });
    }
  }

  return entries;
}

function mapSupabaseError(error: { code?: string; message: string }) {
  const text = error.message.toLowerCase();
  if (error.code === "42501" || text.includes("authentication_required") || text.includes("admin_profile_required")) {
    return new AdminOperationsRepositoryError("unauthorized", "La sesión no tiene permisos administrativos para esta operación.");
  }
  if (text.includes("insufficient_role")) {
    return new AdminOperationsRepositoryError("unauthorized", "Tu rol no permite realizar esta operación.");
  }
  if (error.code === "23P01" || text.includes("slot_unavailable") || text.includes("exclusion")) {
    return new AdminOperationsRepositoryError("conflict", "Ese intervalo ya no está disponible. Actualiza la pizarra e intenta otro horario.");
  }
  if (error.code === "P0002" || text.includes("not_found")) {
    return new AdminOperationsRepositoryError("not_found", "El recurso solicitado ya no existe o no pertenece a tu negocio.");
  }
  if (
    error.code === "22023" ||
    text.includes("invalid_") ||
    text.includes("outside_operating_hours") ||
    text.includes("court_closed") ||
    text.includes("schedule_in_past") ||
    text.includes("not_editable") ||
    text.includes("not_cancelled")
  ) {
    return new AdminOperationsRepositoryError("validation", "La operación no cumple las reglas actuales de horario, estado o datos.");
  }
  if (text.includes("fetch") || text.includes("network")) {
    return new AdminOperationsRepositoryError("network", "No pudimos conectar con Supabase. Revisa la conexión e inténtalo otra vez.");
  }
  return new AdminOperationsRepositoryError("unknown", "No pudimos completar la operación administrativa.");
}

export class SupabaseAdminOperationsRepository implements AdminOperationsRepository {
  async getSchedule(from: string, to: string, timezone: string) {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("get_admin_schedule", { p_from: from, p_to: to });
    if (error) throw mapSupabaseError(error);

    type Row = Database["public"]["Functions"]["get_admin_schedule"]["Returns"][number];
    const days: AdminScheduleDay[] = ((data ?? []) as Row[]).map((row) => ({
      businessId: row.business_id,
      bookingIncrementMinutes: row.booking_increment_minutes,
      courtId: row.court_id,
      courtName: row.court_name,
      date: row.calendar_date,
      isOpen: row.is_open,
      opensAt: row.opens_at?.slice(0, 5) ?? null,
      closesAt: row.closes_at?.slice(0, 5) ?? null,
      scheduleStatus: row.schedule_status,
      entries: parseScheduleEntries(row.entries),
    }));

    return groupAdminScheduleDays(days, from, to, timezone);
  }

  async confirmReservation(reservationId: string): Promise<AdminMutationReservationResult> {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("admin_confirm_reservation", { p_reservation_id: reservationId });
    if (error) throw mapSupabaseError(error);
    const row = data?.[0];
    if (!row) throw new AdminOperationsRepositoryError("unknown", "Supabase no devolvió la reserva confirmada.");
    return { reservationId: row.reservation_id, status: row.reservation_status };
  }

  async completeReservation(reservationId: string): Promise<AdminMutationReservationResult> {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("admin_complete_reservation", { p_reservation_id: reservationId });
    if (error) throw mapSupabaseError(error);
    const row = data?.[0];
    if (!row) throw new AdminOperationsRepositoryError("unknown", "Supabase no devolvió la reserva completada.");
    return { reservationId: row.reservation_id, status: row.reservation_status };
  }

  async cancelReservation(reservationId: string): Promise<AdminMutationReservationResult> {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("admin_cancel_reservation", { p_reservation_id: reservationId });
    if (error) throw mapSupabaseError(error);
    const row = data?.[0];
    if (!row) throw new AdminOperationsRepositoryError("unknown", "Supabase no devolvió la reserva cancelada.");
    return { reservationId: row.reservation_id, status: row.reservation_status };
  }

  async archiveCancelledReservation(reservationId: string): Promise<AdminMutationReservationResult> {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("admin_archive_cancelled_reservation", { p_reservation_id: reservationId });
    if (error) throw mapSupabaseError(error);
    const row = data?.[0];
    if (!row) throw new AdminOperationsRepositoryError("unknown", "Supabase no devolvió la reserva archivada.");
    return { reservationId: row.reservation_id, status: row.reservation_status, archivedAt: row.archived_at };
  }

  async restoreArchivedReservation(reservationId: string): Promise<AdminMutationReservationResult> {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("admin_restore_archived_reservation", { p_reservation_id: reservationId });
    if (error) throw mapSupabaseError(error);
    const row = data?.[0];
    if (!row) throw new AdminOperationsRepositoryError("unknown", "Supabase no devolvió la reserva restaurada.");
    return { reservationId: row.reservation_id, status: row.reservation_status, archivedAt: row.archived_at };
  }

  async createManualReservation(input: CreateManualReservationInput): Promise<AdminMutationReservationResult> {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("admin_create_manual_reservation", {
      p_court_id: input.courtId,
      p_date: input.date,
      p_start_time: input.startTime,
      p_end_time: input.endTime,
      p_net_height_cm: input.netHeightCm,
      p_customer_name: input.customerName,
      p_phone_e164: input.phoneE164,
      p_source: input.source,
    });
    if (error) throw mapSupabaseError(error);
    const row = data?.[0];
    if (!row) throw new AdminOperationsRepositoryError("unknown", "Supabase no devolvió la reserva manual.");
    return {
      reservationId: row.reservation_id,
      status: row.reservation_status,
      courtId: row.court_id,
      startAt: row.start_at,
      endAt: row.end_at,
      lighting: row.lighting,
      netHeightCm: row.net_height_cm,
      hourlyRate: toNumber(row.hourly_rate),
      totalAmount: toNumber(row.total_amount),
      currency: row.currency,
    };
  }

  async editReservation(input: EditReservationInput): Promise<AdminMutationReservationResult> {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("admin_edit_reservation", {
      p_reservation_id: input.reservationId,
      p_court_id: input.courtId,
      p_date: input.date,
      p_start_time: input.startTime,
      p_end_time: input.endTime,
      p_net_height_cm: input.netHeightCm,
      p_customer_name: input.customerName,
      p_phone_e164: input.phoneE164,
    });
    if (error) throw mapSupabaseError(error);
    const row = data?.[0];
    if (!row) throw new AdminOperationsRepositoryError("unknown", "Supabase no devolvió la reserva editada.");
    return {
      reservationId: row.reservation_id,
      status: row.reservation_status,
      courtId: row.court_id,
      startAt: row.start_at,
      endAt: row.end_at,
      lighting: row.lighting,
      netHeightCm: row.net_height_cm,
      hourlyRate: toNumber(row.hourly_rate),
      totalAmount: toNumber(row.total_amount),
      currency: row.currency,
    };
  }

  async createScheduleBlock(input: CreateScheduleBlockInput): Promise<AdminMutationBlockResult> {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("admin_create_schedule_block", {
      p_court_id: input.courtId,
      p_date: input.date,
      p_start_time: input.startTime,
      p_end_time: input.endTime,
      p_reason: input.reason,
      p_internal_note: input.internalNote ?? null,
    });
    if (error) throw mapSupabaseError(error);
    const row = data?.[0];
    if (!row) throw new AdminOperationsRepositoryError("unknown", "Supabase no devolvió el bloqueo creado.");
    return {
      blockId: row.block_id,
      status: row.block_status,
      courtId: row.court_id,
      startAt: row.start_at,
      endAt: row.end_at,
      reason: row.reason,
    };
  }

  async unblock(blockId: string): Promise<AdminMutationBlockResult> {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("admin_cancel_schedule_block", { p_block_id: blockId });
    if (error) throw mapSupabaseError(error);
    const row = data?.[0];
    if (!row) throw new AdminOperationsRepositoryError("unknown", "Supabase no devolvió el bloqueo actualizado.");
    return { blockId: row.block_id, status: row.block_status };
  }
}
