import { hasPublicSupabaseConfig } from "@/lib/data/supabase/browser";
import type { AvailabilityRepository } from "@/lib/data/repositories/availabilityRepository";
import { MockAvailabilityRepository } from "@/lib/data/repositories/mockAvailabilityRepository";
import { SupabaseAvailabilityRepository } from "@/lib/data/repositories/supabaseAvailabilityRepository";

class UnavailableAvailabilityRepository implements AvailabilityRepository {
  async getWeek(): Promise<never> {
    throw new Error("La disponibilidad real no está configurada. Intenta nuevamente más tarde.");
  }
}

export function createPublicAvailabilityRepository(): AvailabilityRepository {
  if (hasPublicSupabaseConfig()) return new SupabaseAvailabilityRepository();
  if (process.env.NODE_ENV === "production") return new UnavailableAvailabilityRepository();
  return new MockAvailabilityRepository();
}
