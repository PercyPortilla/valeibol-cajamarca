import { businessConfig } from "@/config/business";
import { calculateBookingPreview } from "@/lib/booking";
import type {
  BookingRepository,
  PublicBookingContext,
  PublicBookingDatePricing,
  PublicBookingRequest,
  PublicBookingResult,
} from "./bookingRepository";

export class MockBookingRepository implements BookingRepository {
  async getContext(): Promise<PublicBookingContext> {
    return {
      source: "mock-provisional",
      businessId: null,
      businessName: businessConfig.name,
      currency: businessConfig.currency,
      timezone: businessConfig.timezone,
      bookingIncrementMinutes: businessConfig.availability.slotMinutes,
      courts: [{
        courtId: "mock-court",
        courtName: "Cancha demo (provisional)",
        pricing: [
          { lighting: "without_lights", label: "Sin luz", hourlyRate: businessConfig.pricing.withoutLights, status: "confirmed" },
          { lighting: "with_lights", label: "Con luz", hourlyRate: businessConfig.pricing.withLights, status: "confirmed" },
        ],
      }],
    };
  }

  async getPricingForDate(_businessSlug: string, date: string, courtId: string): Promise<PublicBookingDatePricing> {
    return {
      source: "mock-provisional",
      businessName: businessConfig.name,
      currency: businessConfig.currency,
      timezone: businessConfig.timezone,
      courtId,
      courtName: "Cancha demo (provisional)",
      date,
      pricing: [
        { lighting: "without_lights", label: "Sin luz", hourlyRate: businessConfig.pricing.withoutLights, status: "confirmed" },
        { lighting: "with_lights", label: "Con luz", hourlyRate: businessConfig.pricing.withLights, status: "confirmed" },
      ],
    };
  }

  async submit(request: PublicBookingRequest): Promise<PublicBookingResult> {
    const quote = calculateBookingPreview(request.start, request.end, request.lighting);
    return {
      persisted: false,
      requestId: null,
      status: "demo",
      courtId: request.courtId,
      startAt: null,
      endAt: null,
      lighting: request.lighting,
      hourlyRate: quote.hourlyRate,
      totalAmount: quote.total,
      currency: businessConfig.currency,
    };
  }
}
