import { SupabasePhase7Repository } from "./repositories/supabasePhase7Repository.ts";
import type { Phase7Repository } from "./repositories/phase7Repository.ts";

export function createPhase7Repository(): Phase7Repository {
  return new SupabasePhase7Repository();
}
