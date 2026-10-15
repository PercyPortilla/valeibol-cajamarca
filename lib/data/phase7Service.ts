import { SupabasePhase7Repository } from "./repositories/supabasePhase7Repository.ts";
import { LocalPhase7Repository } from "./repositories/localPhase7Repository.ts";
import type { Phase7Repository } from "./repositories/phase7Repository.ts";

export function createPhase7Repository(options?: { local?: boolean }): Phase7Repository {
  return options?.local ? new LocalPhase7Repository() : new SupabasePhase7Repository();
}
