import { businessConfig } from "../../config/business.ts";
import {
  DEMO_BUSINESS_ID,
  DEMO_COURT_ID,
  DEMO_COURT_NAME,
} from "./demoPlatform.ts";
import {
  addDays,
  businessTodayDateKey,
  getDayKey,
  zonedLocalDateTimeToUtc,
} from "../availability.ts";
import type { AdminBlockReason } from "../admin/operations.ts";
import type { AdminPricingRule } from "../admin/phase7.ts";
import type { AdminReservation } from "../admin/reservations.ts";

export const LOCAL_BUSINESS_ID = DEMO_BUSINESS_ID;
export const LOCAL_COURT_ID = DEMO_COURT_ID;
export const LOCAL_COURT_NAME = DEMO_COURT_NAME;

export type LocalAdminBlock = {
  id: string;
  courtId: string;
  startAt: string;
  endAt: string;
  status: "active" | "cancelled";
  reason: AdminBlockReason;
  internalNote: string | null;
};

export type LocalAdminState = {
  reservations: AdminReservation[];
  blocks: LocalAdminBlock[];
  pricingRules: AdminPricingRule[];
  nextId: number;
};

declare global {
  var __valeibolLocalAdminState: LocalAdminState | undefined;
}

function uuid(prefix: string, index: number) {
  return `${prefix}-${String(index).padStart(4, "0")}-4000-8000-${String(index).padStart(12, "0")}`;
}

function iso(date: string, time: string) {
  return zonedLocalDateTimeToUtc(date, time, businessConfig.timezone).toISOString();
}

function seedState(): LocalAdminState {
  const today = businessTodayDateKey();
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);
  const now = new Date().toISOString();
  const customerAna = "20000000-0000-4000-8000-000000000001";
  const customerLuis = "20000000-0000-4000-8000-000000000002";

  const reservations: AdminReservation[] = [
    {
      id: "30000000-0000-4000-8000-000000000001",
      businessId: LOCAL_BUSINESS_ID,
      courtId: LOCAL_COURT_ID,
      courtName: LOCAL_COURT_NAME,
      customerId: customerAna,
      customerName: "Ana Torres",
      customerPhoneE164: "+51987654321",
      startAt: iso(tomorrow, "18:00"),
      endAt: iso(tomorrow, "19:00"),
      status: "confirmed",
      lighting: "with_lights",
      netHeightCm: 243,
      hourlyRate: businessConfig.pricing.withLights,
      totalAmount: businessConfig.pricing.withLights,
      currency: businessConfig.currency,
      source: "whatsapp",
      createdAt: now,
      archivedAt: null,
    },
    {
      id: "30000000-0000-4000-8000-000000000002",
      businessId: LOCAL_BUSINESS_ID,
      courtId: LOCAL_COURT_ID,
      courtName: LOCAL_COURT_NAME,
      customerId: customerLuis,
      customerName: "Luis Mendoza",
      customerPhoneE164: "+51912345678",
      startAt: iso(tomorrow, "16:00"),
      endAt: iso(tomorrow, "17:00"),
      status: "pending",
      lighting: "without_lights",
      netHeightCm: 224,
      hourlyRate: businessConfig.pricing.withoutLights,
      totalAmount: businessConfig.pricing.withoutLights,
      currency: businessConfig.currency,
      source: "public_web",
      createdAt: now,
      archivedAt: null,
    },
    {
      id: "30000000-0000-4000-8000-000000000003",
      businessId: LOCAL_BUSINESS_ID,
      courtId: LOCAL_COURT_ID,
      courtName: LOCAL_COURT_NAME,
      customerId: customerAna,
      customerName: "Ana Torres",
      customerPhoneE164: "+51987654321",
      startAt: iso(yesterday, "19:00"),
      endAt: iso(yesterday, "20:00"),
      status: "completed",
      lighting: "with_lights",
      netHeightCm: null,
      hourlyRate: businessConfig.pricing.withLights,
      totalAmount: businessConfig.pricing.withLights,
      currency: businessConfig.currency,
      source: "admin",
      createdAt: now,
      archivedAt: null,
    },
  ];

  const pricingRules: AdminPricingRule[] = [
    {
      id: "40000000-0000-4000-8000-000000000001",
      courtId: LOCAL_COURT_ID,
      courtName: LOCAL_COURT_NAME,
      lighting: "without_lights",
      label: "Sin iluminación",
      hourlyRate: businessConfig.pricing.withoutLights,
      effectiveFrom: addDays(today, -30),
      effectiveUntil: null,
      isActive: true,
      configurationStatus: "provisional",
      createdBy: null,
      createdAt: now,
      updatedAt: now,
      isCurrent: true,
      currency: businessConfig.currency,
      businessToday: today,
    },
    {
      id: "40000000-0000-4000-8000-000000000002",
      courtId: LOCAL_COURT_ID,
      courtName: LOCAL_COURT_NAME,
      lighting: "with_lights",
      label: "Con iluminación",
      hourlyRate: businessConfig.pricing.withLights,
      effectiveFrom: addDays(today, -30),
      effectiveUntil: null,
      isActive: true,
      configurationStatus: "provisional",
      createdBy: null,
      createdAt: now,
      updatedAt: now,
      isCurrent: true,
      currency: businessConfig.currency,
      businessToday: today,
    },
  ];

  return {
    reservations,
    pricingRules,
    blocks: [
      {
        id: "50000000-0000-4000-8000-000000000001",
        courtId: LOCAL_COURT_ID,
        startAt: iso(tomorrow, "20:00"),
        endAt: iso(tomorrow, "21:00"),
        status: "active",
        reason: "maintenance",
        internalNote: "Bloqueo local de ejemplo",
      },
    ],
    nextId: 10,
  };
}

export function getLocalAdminState() {
  globalThis.__valeibolLocalAdminState ??= seedState();
  return globalThis.__valeibolLocalAdminState;
}

export function resetLocalAdminStateForTests() {
  globalThis.__valeibolLocalAdminState = seedState();
  return globalThis.__valeibolLocalAdminState;
}

export function nextLocalAdminUuid(prefix = "90000000") {
  const state = getLocalAdminState();
  const id = uuid(prefix, state.nextId);
  state.nextId += 1;
  return id;
}

export function localPricingFor(date: string, lighting: "without_lights" | "with_lights") {
  const today = businessTodayDateKey();
  return getLocalAdminState().pricingRules
    .filter((rule) => rule.courtId === LOCAL_COURT_ID && rule.lighting === lighting && rule.isActive)
    .filter((rule) => rule.effectiveFrom <= date && (!rule.effectiveUntil || rule.effectiveUntil >= date))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
    .map((rule) => ({ ...rule, businessToday: today }))[0] ?? null;
}

export function localOperatingHours(date: string) {
  const day = businessConfig.availability.weeklySchedule[getDayKey(date)];
  return {
    isOpen: day.enabled,
    opensAt: day.enabled ? day.opensAt : null,
    closesAt: day.enabled ? day.closesAt : null,
  };
}
