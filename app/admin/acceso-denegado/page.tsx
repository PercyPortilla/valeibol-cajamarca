import Link from "next/link";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";
import { PlatformAdminBrand } from "@/components/brand/PlatformAdminBrand";
import { getPlatformAdminContext } from "@/lib/auth/platformAdmin";
import { cookies } from "next/headers";
import { PLATFORM_ADMIN_BUSINESS_COOKIE, validPlatformBusinessId } from "@/lib/auth/platformScope";

export const dynamic = "force-dynamic";

export default async function AdminAccessDeniedPage() {
  let isPlatformAdmin = false;
  try {
    await getPlatformAdminContext();
    isPlatformAdmin = true;
  } catch {
    // No divulgar información del panel global a perfiles sin autorización.
  }
  const hasBusinessSelection = isPlatformAdmin && Boolean(validPlatformBusinessId(
    (await cookies()).get(PLATFORM_ADMIN_BUSINESS_COOKIE)?.value,
  ));

  return (
    <main className="auth-page auth-page--caxas">
      <section className="auth-card" aria-labelledby="access-denied-title">
        <div className="auth-card__edition"><span aria-hidden="true" /> CAXAS SPORTCENTER <span>· CONTROL DE ACCESO</span></div>
        <div className="brand brand--auth">
          <PlatformAdminBrand context="auth" />
          <span className="brand-context-label">Administración · acceso restringido</span>
        </div>
        <div className="auth-card__title">
          <span className="eyebrow">SIN AUTORIZACIÓN</span>
          <h1 id="access-denied-title">La cuenta no tiene un perfil administrativo activo.</h1>
          <p>{isPlatformAdmin
            ? (hasBusinessSelection
              ? "SC-12: La selección del negocio llegó al servidor, pero el perfil operativo no fue reconocido. Regresa al panel principal y vuelve a seleccionarlo."
              : "SC-11: La sesión global está activa, pero la selección del negocio no llegó al servidor. Regresa al panel principal y vuelve a elegir «Administrar negocio».")
            : "La sesión existe, pero no está asociada a un rol owner, admin o staff activo para el negocio."}</p>
        </div>
        <div className="access-denied-actions">
          {isPlatformAdmin ? <a className="button button--primary" href="/admin-global">Volver a administración global</a> : null}
          <AdminLogoutButton />
          <Link className="button button--ghost" href="/">Volver al sitio público</Link>
        </div>
      </section>
    </main>
  );
}
