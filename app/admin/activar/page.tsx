import Link from "next/link";
import { AdminInviteActivation } from "@/components/admin/AdminInviteActivation";
import { BrandLogo } from "@/components/brand/BrandLogo";

export default function AdminInviteActivationPage() {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="admin-activate-title">
        <Link className="auth-back" href="/">← Volver a la web pública</Link>
        <div className="brand brand--auth">
          <BrandLogo context="auth" />
          <span className="brand-context-label">Administración · activación de acceso</span>
        </div>
        <div className="auth-card__title">
          <span className="eyebrow">INVITACIÓN PRIVADA</span>
          <h1 id="admin-activate-title">Activa tu acceso administrativo.</h1>
          <p>Esta pantalla solo se utiliza después de una invitación enviada por un propietario. Crea tu contraseña para finalizar.</p>
        </div>
        <AdminInviteActivation />
        <p className="auth-note">Después de activarte, los siguientes ingresos se realizan con correo y contraseña.</p>
      </section>
    </main>
  );
}

