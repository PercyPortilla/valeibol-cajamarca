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
          <h1 id="admin-activate-title">Configura o recupera tu contraseña.</h1>
          <p>Desde el enlace de recuperación puedes guardar una contraseña nueva. Si recibiste una invitación o una clave provisional, completa la activación de tu cuenta aquí.</p>
        </div>
        <AdminInviteActivation />
        <p className="auth-note">¿Recibiste una clave temporal? <Link href="/admin/activar?modo=temporal">Activar acceso con clave provisional</Link>. Después de activarte, entra con tu correo y contraseña personal.</p>
      </section>
    </main>
  );
}

