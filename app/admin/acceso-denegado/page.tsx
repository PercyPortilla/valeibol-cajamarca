import Link from "next/link";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";
import { PlatformAdminBrand } from "@/components/brand/PlatformAdminBrand";

export default function AdminAccessDeniedPage() {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="access-denied-title">
        <div className="brand brand--auth">
          <PlatformAdminBrand context="auth" />
          <span className="brand-context-label">Administración · acceso restringido</span>
        </div>
        <div className="auth-card__title">
          <span className="eyebrow">SIN AUTORIZACIÓN</span>
          <h1 id="access-denied-title">La cuenta no tiene un perfil administrativo activo.</h1>
          <p>La sesión existe, pero no está asociada a un rol owner, admin o staff activo para el negocio.</p>
        </div>
        <div className="access-denied-actions">
          <AdminLogoutButton />
          <Link className="button button--ghost" href="/">Volver al sitio público</Link>
        </div>
      </section>
    </main>
  );
}
