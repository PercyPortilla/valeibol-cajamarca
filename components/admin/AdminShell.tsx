import Link from "next/link";
import type { ReactNode } from "react";
import type { AdminContext } from "@/lib/auth/server";
import { AdminNavigation } from "@/components/admin/AdminNavigation";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";
import { isLocalDevAdminUserId } from "@/lib/auth/localDev";

export function AdminShell({ context, children }: { context: AdminContext; children: ReactNode }) {
  const localMode = isLocalDevAdminUserId(context.userId);
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
      <section className="admin-content">
        {localMode ? <div className="admin-local-banner" role="status">Modo local de prueba · las acciones se guardan solo mientras este servidor de desarrollo esté activo.</div> : null}
        {children}
      </section>
    </main>
  );
}
