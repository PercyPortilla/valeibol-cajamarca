import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { AdminAccessManagement } from "@/components/admin/AdminAccessManagement";
import { AdminAccountSecurity } from "@/components/admin/AdminAccountSecurity";
import { AdminSiteContentEditor } from "@/components/admin/AdminSiteContentEditor";
import { requireAdminContext } from "@/lib/auth/server";
import { isLocalDevAdminUserId } from "@/lib/auth/localDev";
import { createSiteContentRepository } from "@/lib/data/siteContentService";
import { defaultSiteContent } from "@/lib/siteContent";

export default async function AdminConfigurationPage() {
  const context = await requireAdminContext();
  const localMode = isLocalDevAdminUserId(context.userId);
  let content = defaultSiteContent();
  let contentLoadFailed = false;
  try {
    content = await createSiteContentRepository({ local: localMode }).getAdminContent();
  } catch {
    contentLoadFailed = true;
  }

  return (
    <>
      <header className="admin-topbar">
        <div>
          <span className="eyebrow">CONFIGURACIÓN</span>
          <h1>Datos del negocio</h1>
          <p className="admin-subtitle">Resumen de la configuración activa utilizada por la web y el panel.</p>
        </div>
        <Badge tone={contentLoadFailed ? "danger" : localMode ? "warning" : "success"}>
          {contentLoadFailed ? "Error de conexión" : localMode ? "Modo local" : "Conectado"}
        </Badge>
      </header>

      <div className="admin-config-grid">
        <Card className="admin-config-card">
          <span className="metric-label">Negocio</span>
          <h2>{context.businessName}</h2>
          <dl className="phase7-rule-meta">
            <div><dt>Negocio</dt><dd>{context.businessName}</dd></div>
            <div><dt>Zona horaria</dt><dd>{context.timezone}</dd></div>
            <div><dt>Identificador</dt><dd>{context.businessId}</dd></div>
          </dl>
          <div className="admin-config-actions"><Link className="button button--secondary" href="/admin/configuracion/estructura">Negocio, sedes y canchas</Link></div>
        </Card>

        <Card className="admin-config-card">
          <span className="metric-label">Operación</span>
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
          <AdminAccessManagement currentUserId={context.userId} businessName={context.businessName} localMode={localMode} />
        </div>
      ) : null}

      <div className="admin-config-content-block">
        {contentLoadFailed ? (
          <div className="state-box state-box--error" role="alert">
            <strong>No pudimos cargar la configuración remota.</strong>
            <span>No se habilita el editor para evitar reemplazar por accidente servicios, galería o paleta con valores de respaldo. Recarga la página y vuelve a intentarlo.</span>
          </div>
        ) : (
          <AdminSiteContentEditor content={content} role={context.role} localMode={localMode} />
        )}
      </div>
    </>
  );
}



