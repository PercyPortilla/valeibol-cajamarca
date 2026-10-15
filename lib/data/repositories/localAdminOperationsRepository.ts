import { businessConfig } from "../../../config/business.ts";
import { addDays, zonedLocalDateTimeToUtc } from "../../availability.ts";
import { bookingLightingForInterval, isNetHeightCm } from "../../booking.ts";
import type { AdminScheduleDay } from "../../admin/schedule.ts";
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
import {
  LOCAL_BUSINESS_ID,
  LOCAL_COURT_ID,
  LOCAL_COURT_NAME,
  getLocalAdminState,
  localOperatingHours,
  localPricingFor,
  nextLocalAdminUuid,
} from "../localAdminStore.ts";

function toIso(date: string, time: string) {
  return zonedLocalDateTimeToUtc(date, time, businessConfig.timezone).toISOString();
}

function overlaps(startAt: string, endAt: string, ignoreReservationId?: string) {
  const state = getLocalAdminState();
  const start = new Date(startAt);
  const end = new Date(endAt);
  const reservationConflict = state.reservations.some((reservation) =>
    reservation.id !== ignoreReservationId &&
    reservation.status !== "cancelled" &&
    new Date(reservation.startAt) < end && new Date(reservation.endAt) > start,
  );
  const blockConflict = state.blocks.some((block) =>
    block.status === "active" && new Date(block.startAt) < end && new Date(block.endAt) > start,
  );
  return reservationConflict || blockConflict;
}

function validateWindow(date: string, startTime: string, endTime: string) {
  const hours = localOperatingHours(date);
  if (!hours.isOpen || !hours.opensAt || !hours.closesAt || startTime < hours.opensAt || endTime > hours.closesAt || endTime <= startTime) {
    throw new AdminOperationsRepositoryError("validation", "El horario local debe estar dentro de la jornada configurada.");
  }
  const startAt = toIso(date, startTime);
  const endAt = toIso(date, endTime);
  return { startAt, endAt };
}

export class LocalAdminOperationsRepository implements AdminOperationsRepository {
  async getSchedule(from: string, to: string, timezone: string) {
    const state = getLocalAdminState();
    const days: AdminScheduleDay[] = [];
    for (let date = from; date <= to; date = addDays(date, 1)) {
      const hours = localOperatingHours(date);
      const dayStart = toIso(date, "00:00");
      const nextDay = toIso(addDays(date, 1), "00:00");
      days.push({
        businessId: LOCAL_BUSINESS_ID,
        bookingIncrementMinutes: businessConfig.availability.slotMinutes,
        courtId: LOCAL_COURT_ID,
        courtName: LOCAL_COURT_NAME,
        date,
        isOpen: hours.isOpen,
        opensAt: hours.opensAt,
        closesAt: hours.closesAt,
        scheduleStatus: "provisional",
        entries: [
          ...state.reservations.filter((item) => item.startAt >= dayStart && item.startAt < nextDay).map((item) => ({
            entryKind: "reservation" as const,
            id: item.id,
            status: item.status,
            startAt: item.startAt,
            endAt: item.endAt,
            customerName: item.customerName,
            customerPhoneE164: item.customerPhoneE164,
            lighting: item.lighting,
            netHeightCm: item.netHeightCm,
            hourlyRate: item.hourlyRate,
            totalAmount: item.totalAmount,
            currency: item.currency,
            source: item.source,
            blockReason: null,
            internalNote: null,
          })),
          ...state.blocks.filter((item) => item.startAt >= dayStart && item.startAt < nextDay).map((item) => ({
            entryKind: "block" as const,
            id: item.id,
            status: item.status,
            startAt: item.startAt,
            endAt: item.endAt,
            customerName: null,
            customerPhoneE164: null,
            lighting: null,
            netHeightCm: null,
            hourlyRate: null,
            totalAmount: null,
            currency: businessConfig.currency,
            source: null,
            blockReason: item.reason,
            internalNote: item.internalNote,
          })),
        ],
      });
    }
    return groupAdminScheduleDays(days, from, to, timezone);
  }

  async confirmReservation(reservationId: string): Promise<AdminMutationReservationResult> {
    const reservation = getLocalAdminState().reservations.find((item) => item.id === reservationId);
    if (!reservation) throw new AdminOperationsRepositoryError("not_found", "La reserva local no existe.");
    if (reservation.status !== "pending" && reservation.status !== "confirmed") throw new AdminOperationsRepositoryError("validation", "Esa reserva ya no puede confirmarse.");
    reservation.status = "confirmed";
    return { reservationId, status: reservation.status };
  }

  async cancelReservation(reservationId: string): Promise<AdminMutationReservationResult> {
    const reservation = getLocalAdminState().reservations.find((item) => item.id === reservationId);
    if (!reservation) throw new AdminOperationsRepositoryError("not_found", "La reserva local no existe.");
    if (reservation.status === "completed") throw new AdminOperationsRepositoryError("validation", "Una reserva completada no puede cancelarse.");
    reservation.status = "cancelled";
    return { reservationId, status: reservation.status };
  }

  async createManualReservation(input: CreateManualReservationInput): Promise<AdminMutationReservationResult> {
    const { startAt, endAt } = validateWindow(input.date, input.startTime, input.endTime);
    if (!isNetHeightCm(input.netHeightCm)) throw new AdminOperationsRepositoryError("validation", "La altura de red debe estar entre 180 y 250 cm.");
    let lighting: "without_lights" | "with_lights";
    try {
      lighting = bookingLightingForInterval(input.startTime, input.endTime);
    } catch (error) {
      throw new AdminOperationsRepositoryError("validation", error instanceof Error ? error.message : "El horario cruza el cambio de tarifa de las 18:00.");
    }
    if (overlaps(startAt, endAt)) throw new AdminOperationsRepositoryError("conflict", "Ese horario local ya está ocupado o bloqueado.");
    const pricing = localPricingFor(input.date, lighting);
    if (!pricing) throw new AdminOperationsRepositoryError("validation", "No existe una tarifa local para esa modalidad.");
    const durationHours = (new Date(endAt).getTime() - new Date(startAt).getTime()) / 3_600_000;
    const reservationId = nextLocalAdminUuid("30000000");
    getLocalAdminState().reservations.push({
      id: reservationId,
      businessId: LOCAL_BUSINESS_ID,
      courtId: input.courtId,
      courtName: LOCAL_COURT_NAME,
      customerId: nextLocalAdminUuid("20000000"),
      customerName: input.customerName,
      customerPhoneE164: input.phoneE164,
      startAt,
      endAt,
      status: "confirmed",
      lighting,
      netHeightCm: input.netHeightCm,
      hourlyRate: pricing.hourlyRate,
      totalAmount: pricing.hourlyRate * durationHours,
      currency: pricing.currency,
      source: input.source,
      createdAt: new Date().toISOString(),
    });
    return { reservationId, status: "confirmed", courtId: input.courtId, startAt, endAt, lighting, netHeightCm: input.netHeightCm, hourlyRate: pricing.hourlyRate, totalAmount: pricing.hourlyRate * durationHours, currency: pricing.currency };
  }

  async editReservation(input: EditReservationInput): Promise<AdminMutationReservationResult> {
    const state = getLocalAdminState();
    const reservation = state.reservations.find((item) => item.id === input.reservationId);
    if (!reservation) throw new AdminOperationsRepositoryError("not_found", "La reserva local no existe.");
    if (reservation.status !== "pending" && reservation.status !== "confirmed") throw new AdminOperationsRepositoryError("validation", "La reserva ya no es editable.");
    const { startAt, endAt } = validateWindow(input.date, input.startTime, input.endTime);
    if (!isNetHeightCm(input.netHeightCm)) throw new AdminOperationsRepositoryError("validation", "La altura de red debe estar entre 180 y 250 cm.");
    let lighting: "without_lights" | "with_lights";
    try {
      lighting = bookingLightingForInterval(input.startTime, input.endTime);
    } catch (error) {
      throw new AdminOperationsRepositoryError("validation", error instanceof Error ? error.message : "El horario cruza el cambio de tarifa de las 18:00.");
    }
    if (overlaps(startAt, endAt, input.reservationId)) throw new AdminOperationsRepositoryError("conflict", "Ese horario local ya está ocupado o bloqueado.");
    const pricing = localPricingFor(input.date, lighting);
    if (!pricing) throw new AdminOperationsRepositoryError("validation", "No existe una tarifa local para esa modalidad.");
    const durationHours = (new Date(endAt).getTime() - new Date(startAt).getTime()) / 3_600_000;
    Object.assign(reservation, { courtId: input.courtId, courtName: LOCAL_COURT_NAME, startAt, endAt, lighting, netHeightCm: input.netHeightCm, customerName: input.customerName, customerPhoneE164: input.phoneE164, hourlyRate: pricing.hourlyRate, totalAmount: pricing.hourlyRate * durationHours });
    return { reservationId: reservation.id, status: reservation.status, courtId: reservation.courtId, startAt, endAt, lighting: reservation.lighting, netHeightCm: reservation.netHeightCm ?? undefined, hourlyRate: reservation.hourlyRate, totalAmount: reservation.totalAmount, currency: reservation.currency };
  }

  async createScheduleBlock(input: CreateScheduleBlockInput): Promise<AdminMutationBlockResult> {
    const { startAt, endAt } = validateWindow(input.date, input.startTime, input.endTime);
    if (overlaps(startAt, endAt)) throw new AdminOperationsRepositoryError("conflict", "Ese horario local ya está ocupado o bloqueado.");
    const blockId = nextLocalAdminUuid("50000000");
    getLocalAdminState().blocks.push({ id: blockId, courtId: input.courtId, startAt, endAt, status: "active", reason: input.reason, internalNote: input.internalNote ?? null });
    return { blockId, status: "active", courtId: input.courtId, startAt, endAt, reason: input.reason };
  }

  async unblock(blockId: string): Promise<AdminMutationBlockResult> {
    const block = getLocalAdminState().blocks.find((item) => item.id === blockId);
    if (!block) throw new AdminOperationsRepositoryError("not_found", "El bloqueo local no existe.");
    block.status = "cancelled";
    return { blockId, status: "cancelled" };
  }
}
