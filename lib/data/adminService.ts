import { SupabaseAdminReservationRepository } from "@/lib/data/repositories/supabaseAdminReservationRepository";
import type { AdminReservationRepository } from "@/lib/data/repositories/adminReservationRepository";

export function createAdminReservationRepository(): AdminReservationRepository {
  return new SupabaseAdminReservationRepository();
}
