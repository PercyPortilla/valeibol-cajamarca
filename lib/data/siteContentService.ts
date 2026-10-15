import { LocalSiteContentRepository } from "./repositories/localSiteContentRepository.ts";
import type { SiteContentRepository } from "./repositories/siteContentRepository.ts";
import { SupabaseSiteContentRepository } from "./repositories/supabaseSiteContentRepository.ts";

export function createSiteContentRepository(options?: { local?: boolean }): SiteContentRepository {
  return options?.local ? new LocalSiteContentRepository() : new SupabaseSiteContentRepository();
}
