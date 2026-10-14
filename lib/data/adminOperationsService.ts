import { SupabaseAdminOperationsRepository } from "./repositories/supabaseAdminOperationsRepository.ts";
import type { AdminOperationsRepository } from "./repositories/adminOperationsRepository.ts";

export function createAdminOperationsRepository(): AdminOperationsRepository {
  return new SupabaseAdminOperationsRepository();
}
