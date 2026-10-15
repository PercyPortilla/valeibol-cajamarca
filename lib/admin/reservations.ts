import type { AdminRole } from "@/lib/auth";

export type AdminReservationStatus = "pending" | "confirmed" | "cancelled" | "completed";
export type AdminLightingMode = "without_lights" | "with_lights";

export type AdminReservation = {
  id: string;
  businessId: string;
  courtId: string;
  courtName: string;
  customerId: string | null;
  customerName: string | null;
  customerPhoneE164: string | null;
  startAt: string;
  endAt: string;
  status: AdminReservationStatus;
  lighting: AdminLightingMode;
  netHeightCm: number | null;
  hourlyRate: number;
  totalAmount: number;
  currency: string;
  source: "public_web" | "admin" | "phone" | "whatsapp" | "other";
  createdAt: string;
};

export const ADMIN_RESERVATION_STATUSES: AdminReservationStatus[] = [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
];

export function reservationStatusLabel(status: AdminReservationStatus) {
  const labels: Record<AdminReservationStatus, string> = {
    pending: "Pendiente",
    confirmed: "Confirmada",
    cancelled: "Cancelada",
    completed: "Completada",
  };
  return labels[status];
}

export function reservationStatusTone(status: AdminReservationStatus) {
  const tones = {
    pending: "warning",
    confirmed: "success",
    cancelled: "danger",
    completed: "info",
  } as const;
  return tones[status];
}

export function lightingLabel(mode: AdminLightingMode) {
  return mode === "with_lights" ? "Con luz" : "Sin luz";
}

export function formatAdminDateTime(iso: string, timezone = "America/Lima") {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Fecha inválida";
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: timezone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatMoney(amount: number, currency = "PEN") {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function canReadAdminReservations(role: AdminRole) {
  return role === "owner" || role === "admin" || role === "staff";
}
