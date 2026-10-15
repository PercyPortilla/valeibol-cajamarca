import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { AdminAuthError, getAdminContext } from "@/lib/auth/server";

export default async function AdminLoginPage() {
  let sessionTarget: string | null = null;
  try {
    await getAdminContext();
    sessionTarget = "/admin";
  } catch (error) {
    if (error instanceof AdminAuthError && error.code === "unauthorized") {
      sessionTarget = "/admin/acceso-denegado";
    }
  }
  if (sessionTarget) redirect(sessionTarget);

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="admin-login-title">
        <Link className="auth-back" href="/">← Volver a la web pública</Link>
        <div className="brand brand--auth">
          <BrandLogo context="auth" />
          <span className="brand-context-label">Administración · acceso privado</span>
        </div>
        <div className="auth-card__title">
          <span className="eyebrow">ÁREA PRIVADA</span>
          <h1 id="admin-login-title">Acceso administrativo seguro.</h1>
          <p>Inicia sesión con una cuenta administrativa autorizada para gestionar la operación.</p>
        </div>
        <AdminLoginForm />
        <p className="auth-note">El acceso se valida según el perfil y rol de cada usuario.</p>
      </section>
    </main>
  );
}
