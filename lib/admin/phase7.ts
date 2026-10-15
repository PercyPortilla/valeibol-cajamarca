import type { AdminRole } from "../auth.ts";
import type { LightingMode, ReservationSource, ReservationStatus } from "../data/supabase/database.types.ts";

export type Phase7Operation =
  | "read_customers"
  | "read_pricing"
  | "manage_pricing"
  | "read_metrics";

const PHASE7_PERMISSIONS: Record<AdminRole, ReadonlySet<Phase7Operation>> = {
  owner: new Set(["read_customers", "read_pricing", "manage_pricing", "read_metrics"]),
  admin: new Set(["read_customers", "read_pricing", "manage_pricing", "read_metrics"]),
  staff: new Set(["read_customers", "read_pricing", "read_metrics"]),
};

export function canPerformPhase7Operation(role: AdminRole, operation: Phase7Operation) {
  return PHASE7_PERMISSIONS[role].has(operation);
}

export type AdminCustomerSummary = {
  id: string;
  fullName: string;
  phoneE164: string | null;
  marketingOptIn: boolean;
  createdAt: string;
  lastActivityAt: string;
  lastReservationAt: string | null;
  reservationCount: number;
  activeReservationCount: number;
  completedReservationCount: number;
  cancelledReservationCount: number;
  confirmedValue: number;
  completedValue: number;
  currency: string;
};

export type AdminCustomerHistoryItem = {
  id: string;
  courtId: string;
  courtName: string;
  startAt: string;
  endAt: string;
  status: ReservationStatus;
  lighting: LightingMode;
  netHeightCm: number | null;
  hourlyRate: number;
  totalAmount: number;
  source: ReservationSource;
  createdAt: string;
  updatedAt: string;
  currency: string;
};

export type PricingTemporalStatus = "current" | "future" | "historical" | "inactive";

export type AdminPricingRule = {
  id: string;
  courtId: string;
  courtName: string;
  lighting: LightingMode;
  label: string;
  hourlyRate: number;
  effectiveFrom: string;
  effectiveUntil: string | null;
  isActive: boolean;
  configurationStatus: "provisional" | "confirmed";
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  isCurrent: boolean;
  currency: string;
  businessToday: string;
};

export type SchedulePricingInput = {
  courtId: string;
  lighting: LightingMode;
  hourlyRate: number;
  effectiveFrom: string;
};

export type SchedulePricingResult = {
  id: string;
  courtId: string;
  lighting: LightingMode;
  hourlyRate: number;
  effectiveFrom: string;
  effectiveUntil: string | null;
  currency: string;
};

export type AdminOperationalMetrics = {
  from: string;
  to: string;
  reservationCount: number;
  pendingCount: number;
  confirmedCount: number;
  completedCount: number;
  cancelledCount: number;
  pendingHours: number;
  reservedHours: number;
  confirmedValue: number;
  completedValue: number;
  openCapacityHours: number;
  agendaOccupiedHours: number;
  occupancyPercent: number;
  currency: string;
  timezone: string;
};

export const METRIC_DEFINITIONS = {
  reservationCount: "Todas las reservas/solicitudes cuyo inicio cae dentro del periodo, incluidas canceladas.",
  pendingCount: "Solicitudes pending del periodo. Bloquean agenda, pero no están confirmadas.",
  confirmedValue: "Suma del valor autoritativo de reservas confirmed del periodo. No significa dinero cobrado.",
  completedValue: "Suma del valor autoritativo de reservas completed del periodo. Tampoco equivale a pago recibido.",
  reservedHours: "Horas de reservas confirmed + completed. Excluye pending y cancelled.",
  occupancyPercent: "Horas que bloquean agenda (reservas activas + bloqueos) / horas abiertas configuradas del periodo.",
} as const;

export function pricingTemporalStatus(rule: AdminPricingRule): PricingTemporalStatus {
  if (!rule.isActive) return "inactive";
  if (rule.isCurrent) return "current";
  if (rule.effectiveFrom > rule.businessToday) return "future";
  return "historical";
}

export function pricingTemporalLabel(status: PricingTemporalStatus) {
  const labels: Record<PricingTemporalStatus, string> = {
    current: "Vigente",
    future: "Programada",
    historical: "Histórica",
    inactive: "Inactiva",
  };
  return labels[status];
}

export function lightingModeLabel(mode: LightingMode) {
  return mode === "with_lights" ? "Con luz" : "Sin luz";
}
