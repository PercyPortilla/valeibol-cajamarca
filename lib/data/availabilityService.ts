import { hasPublicSupabaseConfig } from "@/lib/data/supabase/browser";
import type { AvailabilityRepository } from "@/lib/data/repositories/availabilityRepository";
import { MockAvailabilityRepository } from "@/lib/data/repositories/mockAvailabilityRepository";
import { SupabaseAvailabilityRepository } from "@/lib/data/repositories/supabaseAvailabilityRepository";

export function createPublicAvailabilityRepository(): AvailabilityRepository {
  return hasPublicSupabaseConfig()
    ? new SupabaseAvailabilityRepository()
    : new MockAvailabilityRepository();
}
