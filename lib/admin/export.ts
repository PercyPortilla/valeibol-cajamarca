export type ExportReservation = {
  id: string;
  customerId: string | null;
  customerName: string | null;
  customerPhoneE164: string | null;
  marketingOptIn: boolean;
  courtId: string;
  courtName: string;
  startAt: string;
  endAt: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  lighting: "without_lights" | "with_lights";
  netHeightCm: number | null;
  hourlyRate: number;
  totalAmount: number;
  currency: string;
  source: "public_web" | "admin" | "phone" | "whatsapp" | "other";
  createdAt: string;
  updatedAt: string;
};

export function sanitizeExcelText(value: string | null | undefined) {
  if (!value) return "";
  return /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
}

export function formatExportLocalDateTime(iso: string, timezone: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export type ExportCustomer = {
  key: string;
  customerId: string | null;
  fullName: string;
  phoneE164: string;
  marketingOptIn: boolean;
  reservationCount: number;
  activeReservationCount: number;
  completedReservationCount: number;
  cancelledReservationCount: number;
  confirmedValue: number;
  completedValue: number;
  currency: string;
  lastReservationAt: string;
};

export function buildExportCustomers(reservations: ExportReservation[]): ExportCustomer[] {
  const customers = new Map<string, ExportCustomer>();

  for (const reservation of reservations) {
    const key = reservation.customerId ?? reservation.customerPhoneE164 ?? `reservation:${reservation.id}`;
    const current = customers.get(key) ?? {
      key,
      customerId: reservation.customerId,
      fullName: reservation.customerName ?? "Sin nombre",
      phoneE164: reservation.customerPhoneE164 ?? "",
      marketingOptIn: reservation.marketingOptIn,
      reservationCount: 0,
      activeReservationCount: 0,
      completedReservationCount: 0,
      cancelledReservationCount: 0,
      confirmedValue: 0,
      completedValue: 0,
      currency: reservation.currency,
      lastReservationAt: reservation.startAt,
    };

    current.reservationCount += 1;
    if (reservation.status === "pending" || reservation.status === "confirmed") current.activeReservationCount += 1;
    if (reservation.status === "completed") current.completedReservationCount += 1;
    if (reservation.status === "cancelled") current.cancelledReservationCount += 1;
    if (reservation.status === "confirmed") current.confirmedValue += reservation.totalAmount;
    if (reservation.status === "completed") current.completedValue += reservation.totalAmount;
    if (reservation.startAt > current.lastReservationAt) current.lastReservationAt = reservation.startAt;
    current.marketingOptIn ||= reservation.marketingOptIn;
    customers.set(key, current);
  }

  return [...customers.values()].sort((a, b) => b.lastReservationAt.localeCompare(a.lastReservationAt));
}
