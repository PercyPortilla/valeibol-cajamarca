import Link from "next/link";
import { AdminInviteActivation } from "@/components/admin/AdminInviteActivation";
import { PlatformAdminBrand } from "@/components/brand/PlatformAdminBrand";

export default function AdminInviteActivationPage() {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="admin-activate-title">
        <Link className="auth-back" href="/">← Volver a la web pública</Link>
        <div className="brand brand--auth">
          <PlatformAdminBrand context="auth" />
          <span className="brand-context-label">Administración · activación de acceso</span>
        </div>
        <div className="auth-card__title">
          <span className="eyebrow">ACCESO SEGURO</span>
          <h1 id="admin-activate-title">Configura tu contraseña de acceso.</h1>
          <p>Después de abrir un enlace de invitación o recuperación enviado a tu correo, crea una nueva contraseña para entrar al panel.</p>
        </div>
        <AdminInviteActivation />
        <p className="auth-note">Después de activarte, los siguientes ingresos se realizan con correo y contraseña.</p>
      </section>
    </main>
  );
}

