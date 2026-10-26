import type { AdminLightingMode, AdminReservationStatus } from "../../admin/reservations.ts";
import type { NetHeightCm } from "../../booking.ts";
import type { AdminBlockReason } from "../../admin/operations.ts";
import type { AdminScheduleDay, AdminScheduleSnapshot } from "../../admin/schedule.ts";

export type AdminMutationReservationResult = {
  reservationId: string;
  status: AdminReservationStatus;
  closureKind?: "customer_withdrawal" | "business_rejection" | "confirmed_cancellation" | "request_expiration" | null;
  courtId?: string;
  startAt?: string;
  endAt?: string;
  lighting?: AdminLightingMode;
  netHeightCm?: NetHeightCm;
  hourlyRate?: number;
  totalAmount?: number;
  currency?: string;
  archivedAt?: string | null;
};

export type AdminMutationBlockResult = {
  blockId: string;
  status: "active" | "cancelled";
  courtId?: string;
  startAt?: string;
  endAt?: string;
  reason?: AdminBlockReason;
};

export type CreateManualReservationInput = {
  courtId: string;
  date: string;
  startTime: string;
  endTime: string;
  netHeightCm: NetHeightCm;
  customerName: string;
  phoneE164: string;
  source: "admin" | "phone" | "whatsapp" | "other";
};

export type EditReservationInput = {
  reservationId: string;
  courtId: string;
  date: string;
  startTime: string;
  endTime: string;
  netHeightCm: NetHeightCm;
  customerName: string;
  phoneE164: string;
};

export type CreateScheduleBlockInput = {
  courtId: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: AdminBlockReason;
  internalNote?: string | null;
};

export interface AdminOperationsRepository {
  getSchedule(from: string, to: string, timezone: string): Promise<AdminScheduleSnapshot>;
  confirmReservation(reservationId: string): Promise<AdminMutationReservationResult>;
  rejectPendingReservation(reservationId: string): Promise<AdminMutationReservationResult>;
  expirePendingReservation(reservationId: string): Promise<AdminMutationReservationResult>;
  completeReservation(reservationId: string): Promise<AdminMutationReservationResult>;
  cancelReservation(reservationId: string): Promise<AdminMutationReservationResult>;
  archiveCancelledReservation(reservationId: string): Promise<AdminMutationReservationResult>;
  restoreArchivedReservation(reservationId: string): Promise<AdminMutationReservationResult>;
  createManualReservation(input: CreateManualReservationInput): Promise<AdminMutationReservationResult>;
  editReservation(input: EditReservationInput): Promise<AdminMutationReservationResult>;
  createScheduleBlock(input: CreateScheduleBlockInput): Promise<AdminMutationBlockResult>;
  unblock(blockId: string): Promise<AdminMutationBlockResult>;
}

export type AdminOperationsErrorCode =
  | "unauthenticated"
  | "unauthorized"
  | "not_found"
  | "conflict"
  | "validation"
  | "network"
  | "unknown";

export class AdminOperationsRepositoryError extends Error {
  readonly code: AdminOperationsErrorCode;

  constructor(
    code: AdminOperationsErrorCode,
    message: string,
  ) {
    super(message);
    this.code = code;
    this.name = "AdminOperationsRepositoryError";
  }
}

export function groupAdminScheduleDays(
  days: AdminScheduleDay[],
  from: string,
  to: string,
  timezone: string,
): AdminScheduleSnapshot {
  const byCourt = new Map<string, { courtId: string; courtName: string; days: AdminScheduleDay[] }>();
  let bookingIncrementMinutes = 60;

  for (const day of days) {
    bookingIncrementMinutes = day.bookingIncrementMinutes || bookingIncrementMinutes;
    const current = byCourt.get(day.courtId) ?? {
      courtId: day.courtId,
      courtName: day.courtName,
      days: [],
    };
    current.days.push(day);
    byCourt.set(day.courtId, current);
  }

  return {
    from,
    to,
    timezone,
    bookingIncrementMinutes,
    courts: [...byCourt.values()].map((court) => ({
      ...court,
      days: court.days.sort((a, b) => a.date.localeCompare(b.date)),
    })),
  };
}
