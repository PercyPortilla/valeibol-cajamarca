import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminContext } from "@/lib/auth/server";
import { isLocalDevAdminUserId } from "@/lib/auth/localDev";
import { createSiteContentRepository } from "@/lib/data/siteContentService";
import { defaultSiteContent } from "@/lib/siteContent";
import { createServerSupabaseClient } from "@/lib/data/supabase/server";

export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const context = await requireAdminContext();
  let content = defaultSiteContent();
  let unreadNotifications = 0;
  try {
    content = await createSiteContentRepository({ local: isLocalDevAdminUserId(context.userId) }).getAdminContent();
  } catch {
    // El panel conserva la paleta base si el contenido remoto no está disponible.
  }
  if (!isLocalDevAdminUserId(context.userId)) {
    try {
      const supabase = await createServerSupabaseClient();
      const result = await supabase.rpc("get_admin_notification_unread_count");
      if (!result.error && typeof result.data === "number") unreadNotifications = result.data;
    } catch {
      unreadNotifications = 0;
    }
  }
  return <AdminShell context={context} theme={content.theme} unreadNotifications={unreadNotifications}>{children}</AdminShell>;
}
