import Link from "next/link";
import type { Metadata } from "next";
import { CustomerPasswordRecoveryForm } from "@/components/account/CustomerPasswordRecoveryForm";
import { PlatformFooter } from "@/components/platform/PlatformFooter";
import { PlatformHeader } from "@/components/platform/PlatformHeader";
import { createServerSupabaseClient, hasPublicSupabaseServerConfig } from "@/lib/data/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Recuperar contraseña · Mi cuenta",
  robots: { index: false, follow: false },
};

export default async function CustomerPasswordRecoveryPage() {
  let hasRecoverySession = false;

  if (hasPublicSupabaseServerConfig()) {
    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase.auth.getUser();
      hasRecoverySession = !error && Boolean(data.user);
    } catch {
      hasRecoverySession = false;
    }
  }

  return (
    <div className="platform-page">
      <PlatformHeader />
      <main className="account-page" id="platform-main" tabIndex={-1}>
        <div className="shell account-page__inner">
          <header className="account-page__heading">
            <span className="eyebrow">MI CUENTA · SEGURIDAD</span>
            <h1>Crear nueva contraseña</h1>
            <p>Usa esta pantalla después de abrir el enlace de recuperación enviado a tu correo.</p>
          </header>

          <div className="customer-auth-card">
            {hasRecoverySession ? (
              <CustomerPasswordRecoveryForm />
            ) : (
              <div className="auth-error" role="alert">
                Este enlace de recuperación no es válido, ya expiró o no pudo iniciar una sesión segura. Solicita uno nuevo desde Mi cuenta.
              </div>
            )}
            {!hasRecoverySession ? <Link className="button button--secondary" href="/mi-cuenta">Volver a Mi cuenta</Link> : null}
          </div>
        </div>
      </main>
      <PlatformFooter />
    </div>
  );
}

