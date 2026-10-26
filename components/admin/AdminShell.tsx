import Link from "next/link";
import type { ReactNode } from "react";
import { PlatformAdminBrand } from "@/components/brand/PlatformAdminBrand";
import type { AdminContext } from "@/lib/auth/server";
import { AdminNavigation } from "@/components/admin/AdminNavigation";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";
import { isLocalDevAdminUserId } from "@/lib/auth/localDev";
import { themeCssVariables, type SiteTheme } from "@/lib/siteContent";
import type { CSSProperties } from "react";

export function AdminShell({ context, children, theme, unreadNotifications = 0 }: { context: AdminContext; children: ReactNode; theme: SiteTheme; unreadNotifications?: number }) {
  const localMode = isLocalDevAdminUserId(context.userId);
  return (
    <main className="admin-shell" style={themeCssVariables(theme) as CSSProperties}>
      <a className="platform-skip-link" href="#admin-main">Saltar al contenido principal</a>
      <aside className="admin-sidebar">
        <Link href="/admin" className="brand brand--admin" aria-label="Caxas SportCenter · Administración">
          <PlatformAdminBrand context="admin" />
        </Link>
        <AdminNavigation unreadNotifications={unreadNotifications} />
        <div className="admin-account">
          <span className="admin-account__avatar" aria-hidden="true">{(context.displayName ?? context.email ?? "A").charAt(0).toUpperCase()}</span>
          <span className="admin-account__meta">
            <strong>{context.displayName ?? context.email ?? "Usuario administrativo"}</strong>
            <small>{context.roleLabel}</small>
          </span>
        </div>
        <AdminLogoutButton />
        {context.isPlatformAdmin
          ? <Link href="/admin-global" className="admin-exit">Administración principal</Link>
          : context.role !== "staff" ? <Link href="/propietario" className="admin-exit">Panel propietario</Link> : null}
        <Link href="/" className="admin-exit">← Ver sitio público</Link>
      </aside>
      <section className="admin-content" id="admin-main" tabIndex={-1}>
        {localMode ? <div className="admin-local-banner" role="status">Modo local de prueba · las acciones se guardan solo mientras este servidor de desarrollo esté activo.</div> : null}
        {context.isPlatformAdmin ? (
          <div className="admin-local-banner" role="status">
            Supervisión global · estás administrando <strong>{context.businessName}</strong>. <Link href="/admin-global">Volver a la administración principal</Link>
          </div>
        ) : null}
        {children}
      </section>
    </main>
  );
}
