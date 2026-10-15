import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminContext } from "@/lib/auth/server";
import { isLocalDevAdminUserId } from "@/lib/auth/localDev";
import { createSiteContentRepository } from "@/lib/data/siteContentService";
import { defaultSiteContent } from "@/lib/siteContent";

export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const context = await requireAdminContext();
  let content = defaultSiteContent();
  try {
    content = await createSiteContentRepository({ local: isLocalDevAdminUserId(context.userId) }).getAdminContent();
  } catch {
    // El panel conserva la paleta base si el contenido remoto no está disponible.
  }
  return <AdminShell context={context} theme={content.theme}>{children}</AdminShell>;
}
