import { SupabaseAdminOperationsRepository } from "./repositories/supabaseAdminOperationsRepository.ts";
import { LocalAdminOperationsRepository } from "./repositories/localAdminOperationsRepository.ts";
import type { AdminOperationsRepository } from "./repositories/adminOperationsRepository.ts";

export function createAdminOperationsRepository(options?: { local?: boolean }): AdminOperationsRepository {
  return options?.local ? new LocalAdminOperationsRepository() : new SupabaseAdminOperationsRepository();
}
