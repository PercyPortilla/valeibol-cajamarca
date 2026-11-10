import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { PlatformAdminBrand } from "@/components/brand/PlatformAdminBrand";
import { AdminAuthError, getAdminContext } from "@/lib/auth/server";
import { getPlatformAdminContext } from "@/lib/auth/platformAdmin";
import { createServerSupabaseClient, hasPublicSupabaseServerConfig } from "@/lib/data/supabase/server";
import { safeTenantAdminRedirectPath } from "@/lib/auth/tenantAccess";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const tenantTarget = safeTenantAdminRedirectPath((await searchParams).next);
  if (tenantTarget && hasPublicSupabaseServerConfig()) {
    const client = await createServerSupabaseClient();
    const { data } = await client.auth.getUser();
    if (data.user) redirect(tenantTarget);
  }

  let sessionTarget: string | null = null;
  if (!tenantTarget) try {
    await getPlatformAdminContext();
    sessionTarget = "/admin-global";
  } catch {
    try {
      await getAdminContext();
      sessionTarget = "/admin";
    } catch (error) {
      if (error instanceof AdminAuthError && error.code === "unauthorized") {
        sessionTarget = "/admin/acceso-denegado";
      }
    }
  }
  if (sessionTarget) redirect(sessionTarget);

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="admin-login-title">
        <Link className="auth-back" href="/">← Volver a la web pública</Link>
        <div className="brand brand--auth">
          <PlatformAdminBrand context="auth" />
          <span className="brand-context-label">{tenantTarget ? "Página hija · acceso privado" : "Plataforma madre · acceso privado"}</span>
        </div>
        <div className="auth-card__title">
          <span className="eyebrow">ÁREA PRIVADA</span>
          <h1 id="admin-login-title">{tenantTarget ? "Administración del complejo." : "Administración de SportCenter Caxas."}</h1>
          <p>{tenantTarget ? "Ingresa con la cuenta de propietario o trabajador autorizado de este negocio." : "Acceso exclusivo al panel global de la plataforma."}</p>
        </div>
        <AdminLoginForm />
        <p className="auth-note">El acceso se valida según el perfil y rol de cada usuario.</p>
      </section>
    </main>
  );
}
