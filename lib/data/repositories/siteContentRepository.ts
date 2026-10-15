import type { SiteContent, SiteGalleryItem, SiteService, SiteTheme } from "../../siteContent.ts";

export type UpdateSiteContentInput = {
  services: SiteService[];
  gallery: SiteGalleryItem[];
  theme: SiteTheme;
};

export interface SiteContentRepository {
  getAdminContent(): Promise<SiteContent>;
  updateAdminContent(input: UpdateSiteContentInput): Promise<SiteContent>;
}

export class SiteContentRepositoryError extends Error {
  readonly code: "unauthorized" | "validation" | "network" | "unknown";

  constructor(code: "unauthorized" | "validation" | "network" | "unknown", message: string) {
    super(message);
    this.code = code;
    this.name = "SiteContentRepositoryError";
  }
}
