import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import {
  createServerSupabaseClient,
  hasPublicSupabaseServerConfig,
} from "@/lib/data/supabase/server";

export default async function AdminLoginPage() {
  // Restauración de sesión: si ya existe una cookie válida y además el usuario
  // posee perfil administrativo activo, no obligamos a iniciar sesión otra vez.
  if (hasPublicSupabaseServerConfig()) {
    let sessionTarget: string | null = null;
    try {
      const supabase = await createServerSupabaseClient();
      const { data: authData } = await supabase.auth.getUser();
      if (authData.user) {
        const { data: context } = await supabase.rpc("get_current_admin_context");
        sessionTarget = (context ?? []).length > 0 ? "/admin" : "/admin/acceso-denegado";
      }
    } catch {
      // Un fallo de red no convierte una sesión en válida. La pantalla de login
      // seguirá disponible y mostrará errores al intentar autenticar.
    }
    if (sessionTarget) redirect(sessionTarget);
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="admin-login-title">
        <Link className="auth-back" href="/">← Volver a la web pública</Link>
        <div className="brand brand--auth">
          <span className="brand__mark">V</span>
          <span><strong>Valeibol Admin</strong><small>Acceso privado</small></span>
        </div>
        <div className="auth-card__title">
          <span className="eyebrow">ÁREA PRIVADA</span>
          <h1 id="admin-login-title">Acceso administrativo seguro.</h1>
          <p>Inicia sesión con la cuenta autorizada en Supabase Auth. No existe un modo demo para autenticación administrativa.</p>
        </div>
        <AdminLoginForm />
        <p className="auth-note">Las sesiones se validan también en servidor y la base de datos aplica RLS por perfil y rol.</p>
      </section>
    </main>
  );
}
