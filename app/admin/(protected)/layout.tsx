import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminContext } from "@/lib/auth/server";

export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const context = await requireAdminContext();
  return <AdminShell context={context}>{children}</AdminShell>;
}
