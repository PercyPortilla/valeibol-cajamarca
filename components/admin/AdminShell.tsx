import Link from "next/link";
import type { ReactNode } from "react";
import type { AdminContext } from "@/lib/auth/server";
import { AdminNavigation } from "@/components/admin/AdminNavigation";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";

export function AdminShell({ context, children }: { context: AdminContext; children: ReactNode }) {
  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/admin" className="brand brand--admin" aria-label="Valeibol Administración">
          <span className="brand__mark">V</span>
          <span><strong>Valeibol</strong><small>Administración</small></span>
        </Link>
        <AdminNavigation />
        <div className="admin-account">
          <span className="admin-account__avatar" aria-hidden="true">{(context.displayName ?? context.email ?? "A").charAt(0).toUpperCase()}</span>
          <span className="admin-account__meta">
            <strong>{context.displayName ?? context.email ?? "Usuario administrativo"}</strong>
            <small>{context.roleLabel}</small>
          </span>
        </div>
        <AdminLogoutButton />
        <Link href="/" className="admin-exit">← Ver sitio público</Link>
      </aside>
      <section className="admin-content">{children}</section>
    </main>
  );
}
