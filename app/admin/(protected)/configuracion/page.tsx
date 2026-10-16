import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { AdminAccessManagement } from "@/components/admin/AdminAccessManagement";
import { AdminAccountSecurity } from "@/components/admin/AdminAccountSecurity";
import { AdminSiteContentEditor } from "@/components/admin/AdminSiteContentEditor";
import { businessConfig } from "@/config/business";
import { requireAdminContext } from "@/lib/auth/server";
import { isLocalDevAdminUserId } from "@/lib/auth/localDev";
import { createSiteContentRepository } from "@/lib/data/siteContentService";
import { defaultSiteContent } from "@/lib/siteContent";

export default async function AdminConfigurationPage() {
  const context = await requireAdminContext();
  const localMode = isLocalDevAdminUserId(context.userId);
  let content = defaultSiteContent();
  try {
    content = await createSiteContentRepository({ local: localMode }).getAdminContent();
  } catch {
    // La configuraciÃ³n base queda disponible para editar incluso si Supabase aÃºn no tiene la migraciÃ³n aplicada.
  }

  return (
    <>
      <header className="admin-topbar">
        <div>
          <span className="eyebrow">CONFIGURACIÃ“N</span>
          <h1>Datos del negocio</h1>
          <p className="admin-subtitle">Resumen de la configuraciÃ³n activa utilizada por la web y el panel.</p>
        </div>
        <Badge tone={localMode ? "warning" : "success"}>{localMode ? "Modo local" : "Conectado"}</Badge>
      </header>

      <div className="admin-config-grid">
        <Card className="admin-config-card">
          <span className="metric-label">Negocio</span>
          <h2>{businessConfig.name}</h2>
          <dl className="phase7-rule-meta">
            <div><dt>DirecciÃ³n</dt><dd>{businessConfig.address}</dd></div>
            <div><dt>TelÃ©fono</dt><dd>{businessConfig.phone}</dd></div>
            <div><dt>Zona horaria</dt><dd>{businessConfig.timezone}</dd></div>
            <div><dt>Moneda</dt><dd>{businessConfig.currency}</dd></div>
          </dl>
        </Card>

        <Card className="admin-config-card">
          <span className="metric-label">OperaciÃ³n</span>
          <h2>Cancha y tarifas</h2>
          <p>{localMode ? "En modo local los cambios son temporales y se reinician al reiniciar el servidor." : "Las operaciones del panel usan el backend configurado y sus validaciones."}</p>
          <div className="admin-config-actions">
            <Link className="button button--secondary" href="/admin/precios">Administrar precios</Link>
            <Link className="button button--ghost" href="/admin/disponibilidad">Administrar disponibilidad</Link>
          </div>
        </Card>
      </div>

      <div className="admin-config-content-block">
        <AdminAccountSecurity email={context.email} localMode={localMode} />
      </div>

      {context.role === "owner" ? (
        <div className="admin-config-content-block">
          <AdminAccessManagement currentUserId={context.userId} localMode={localMode} />
        </div>
      ) : null}

      <div className="admin-config-content-block">
        <AdminSiteContentEditor content={content} role={context.role} localMode={localMode} />
      </div>
    </>
  );
}

