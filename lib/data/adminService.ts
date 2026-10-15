import { SupabaseAdminReservationRepository } from "@/lib/data/repositories/supabaseAdminReservationRepository";
import { LocalAdminReservationRepository } from "@/lib/data/repositories/localAdminReservationRepository";
import type { AdminReservationRepository } from "@/lib/data/repositories/adminReservationRepository";

export function createAdminReservationRepository(options?: { local?: boolean }): AdminReservationRepository {
  return options?.local ? new LocalAdminReservationRepository() : new SupabaseAdminReservationRepository();
}
