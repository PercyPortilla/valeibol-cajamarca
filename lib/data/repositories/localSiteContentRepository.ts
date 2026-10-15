import {
  defaultSiteContent,
  normalizeSiteGallery,
  normalizeSiteServices,
  type SiteContent,
} from "../../siteContent.ts";
import type { SiteContentRepository, UpdateSiteContentInput } from "./siteContentRepository.ts";

declare global {
  var __valeibolLocalSiteContent: SiteContent | undefined;
}

function state() {
  globalThis.__valeibolLocalSiteContent ??= { ...defaultSiteContent(), source: "local" };
  return globalThis.__valeibolLocalSiteContent;
}

export class LocalSiteContentRepository implements SiteContentRepository {
  async getAdminContent() {
    return structuredClone(state());
  }

  async updateAdminContent(input: UpdateSiteContentInput) {
    const next: SiteContent = {
      services: normalizeSiteServices(input.services),
      gallery: normalizeSiteGallery(input.gallery),
      updatedAt: new Date().toISOString(),
      source: "local",
    };
    globalThis.__valeibolLocalSiteContent = next;
    return structuredClone(next);
  }
}

export function resetLocalSiteContentForTests() {
  globalThis.__valeibolLocalSiteContent = { ...defaultSiteContent(), source: "local" };
}
