import { hasPublicSupabaseConfig } from "@/lib/data/supabase/browser";
import {
  BookingRepositoryError,
  type BookingRepository,
} from "@/lib/data/repositories/bookingRepository";
import { MockBookingRepository } from "@/lib/data/repositories/mockBookingRepository";
import { SupabaseBookingRepository } from "@/lib/data/repositories/supabaseBookingRepository";

class UnavailableBookingRepository implements BookingRepository {
  async getContext(): Promise<never> {
    throw new BookingRepositoryError("configuration", "La reserva en línea no está configurada.");
  }

  async getPricingForDate(): Promise<never> {
    throw new BookingRepositoryError("configuration", "No se pudo consultar la tarifa real.");
  }

  async submit(): Promise<never> {
    throw new BookingRepositoryError("configuration", "La reserva en línea no está configurada.");
  }
}

export function createPublicBookingRepository(): BookingRepository {
  if (hasPublicSupabaseConfig()) return new SupabaseBookingRepository();
  if (process.env.NODE_ENV === "production") return new UnavailableBookingRepository();
  return new MockBookingRepository();
}
