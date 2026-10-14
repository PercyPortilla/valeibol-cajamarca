import { hasPublicSupabaseConfig } from "@/lib/data/supabase/browser";
import type { BookingRepository } from "@/lib/data/repositories/bookingRepository";
import { MockBookingRepository } from "@/lib/data/repositories/mockBookingRepository";
import { SupabaseBookingRepository } from "@/lib/data/repositories/supabaseBookingRepository";

export function createPublicBookingRepository(): BookingRepository {
  return hasPublicSupabaseConfig()
    ? new SupabaseBookingRepository()
    : new MockBookingRepository();
}
