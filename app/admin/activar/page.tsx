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
          <p>Activa tu cuenta desde la invitación por correo o, si recibiste una clave provisional del administrador global, sustitúyela por una contraseña personal.</p>
        </div>
        <AdminInviteActivation />
        <p className="auth-note">¿Recibiste una clave temporal? <Link href="/admin/activar?modo=temporal">Activar acceso con clave provisional</Link>. Después de activarte, entra con tu correo y contraseña personal.</p>
      </section>
    </main>
  );
}

