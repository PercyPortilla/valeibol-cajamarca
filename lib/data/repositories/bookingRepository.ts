import type { LightingMode, NetHeightCm } from "@/lib/booking";

export type PublicBookingPricing = {
  lighting: LightingMode;
  label: string;
  hourlyRate: number;
  status: "provisional" | "confirmed";
};

export type PublicBookingCourt = {
  courtId: string;
  courtName: string;
  pricing: PublicBookingPricing[];
};

export type PublicBookingDatePricing = {
  source: "supabase" | "mock-provisional";
  businessName: string;
  currency: string;
  timezone: string;
  courtId: string;
  courtName: string;
  date: string;
  pricing: PublicBookingPricing[];
};

export type PublicBookingContext = {
  source: "supabase" | "mock-provisional";
  businessId: string | null;
  businessName: string;
  currency: string;
  timezone: string;
  bookingIncrementMinutes: number;
  courts: PublicBookingCourt[];
};

export type PublicBookingRequest = {
  businessSlug: string;
  courtId: string;
  date: string;
  start: string;
  end: string;
  netHeightCm: NetHeightCm | null;
  customerName: string;
  phoneE164: string;
  marketingOptIn: boolean;
  requestToken: string;
};

export type PublicBookingResult = {
  persisted: boolean;
  requestId: string | null;
  status: "pending" | "demo";
  courtId: string;
  startAt: string | null;
  endAt: string | null;
  lighting: LightingMode;
  netHeightCm: NetHeightCm | null;
  hourlyRate: number;
  totalAmount: number;
  currency: string;
};

export type BookingErrorCode =
  | "slot_unavailable"
  | "invalid_customer"
  | "invalid_phone"
  | "invalid_interval"
  | "court_closed"
  | "outside_operating_hours"
  | "reservation_in_past"
  | "lighting_cutoff_crossed"
  | "invalid_net_height"
  | "pricing_not_found"
  | "not_found"
  | "configuration"
  | "rate_limited"
  | "network"
  | "unknown";

export class BookingRepositoryError extends Error {
  constructor(public readonly code: BookingErrorCode, message: string) {
    super(message);
    this.name = "BookingRepositoryError";
  }
}

export interface BookingRepository {
  getContext(businessSlug: string): Promise<PublicBookingContext>;
  getPricingForDate(businessSlug: string, date: string, courtId: string): Promise<PublicBookingDatePricing>;
  submit(request: PublicBookingRequest): Promise<PublicBookingResult>;
}
