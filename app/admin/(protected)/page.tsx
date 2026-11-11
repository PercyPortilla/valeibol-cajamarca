import Link from "next/link";
import { Badge } from "../../../components/ui/Badge.tsx";
import { Card } from "../../../components/ui/Card.tsx";
import { requireAdminContext } from "../../../lib/auth/server.ts";
import { isLocalDevAdminUserId } from "../../../lib/auth/localDev.ts";
import { canPerformPhase7Operation } from "../../../lib/admin/phase7.ts";
import { businessTodayDateKey } from "../../../lib/availability.ts";
import { formatMoney } from "../../../lib/admin/reservations.ts";
import { createPhase7Repository } from "../../../lib/data/phase7Service.ts";
import { getAdminBusinessStructure } from "../../../lib/data/inventoryService.ts";

export default async function AdminDashboardPage() {
  const context = await requireAdminContext();
  const today = businessTodayDateKey(new Date(), context.timezone);
  const monthFrom = `${today.slice(0, 7)}-01`;
  let metrics = null;
  let setup = null;
  try {
    metrics = await createPhase7Repository({ local: isLocalDevAdminUserId(context.userId) }).getOperationalMetrics(monthFrom, today);
  } catch {
    // La navegación operativa permanece disponible si la consulta de métricas falla.
  }
  if (!isLocalDevAdminUserId(context.userId) && context.role !== "staff") {
    try { setup = await getAdminBusinessStructure(); } catch { /* El panel conserva accesos seguros sin esta RPC. */ }
  }

  return (
    <>
      <header className="admin-topbar">
        <div>
          <span className="eyebrow">TU PANEL / {context.businessName}</span>
          <h1>¿Qué necesitas hacer hoy?</h1>
          <p className="admin-subtitle">Gestiona las canchas y reservas de {context.businessName} desde aquí. Los importes muestran valor de reservas, no dinero cobrado.</p>
        </div>
        <Badge tone="success">{context.roleLabel}</Badge>
      </header>

      <section className="admin-start-panel" aria-label="Accesos principales">
        <div><span className="eyebrow">ACCESOS PRINCIPALES</span><h2>Las tareas importantes, a un clic.</h2>
          <p>La pizarra y las reservas conservan las funciones de operación de Valeibol, con datos exclusivos de tu negocio.</p></div>
        <div className="admin-start-panel__links">
          <Link className="button button--primary" href="/admin/disponibilidad">Abrir pizarra semanal ↗</Link>
          <Link className="button button--secondary" href="/admin/reservas">Gestionar reservas ↗</Link>
          {context.role !== "staff" ? <Link className="button button--secondary" href="/admin/centro">Configurar y diseñar negocio ↗</Link> : null}
        </div>
      </section>
      {setup?.configurationStatus === "provisional" && context.role !== "staff" ? (
        <section className="admin-readiness-banner" aria-label="Configuración pendiente">
          <div><strong>Tu negocio todavía está en preparación.</strong><p>Para hacerlo visible debes tener una sede activa, una cancha con horarios y ambas tarifas vigentes. Todo se completa desde el Centro de gestión.</p></div>
          <Link className="button button--primary" href="/admin/centro">Completar configuración ↗</Link>
        </section>
      ) : null}

      {metrics ? (
        <div className="admin-status-grid phase7-summary-grid">
          <Card className="admin-status-card"><span className="metric-label">Valor confirmado · mes</span><strong>{formatMoney(metrics.confirmedValue, metrics.currency)}</strong><small>No equivale a cobro recibido.</small></Card>
          <Card className="admin-status-card"><span className="metric-label">Valor completado · mes</span><strong>{formatMoney(metrics.completedValue, metrics.currency)}</strong><small>Reservas completed; no acredita cobro recibido.</small></Card>
          <Card className="admin-status-card"><span className="metric-label">Horas reservadas · mes</span><strong>{metrics.reservedHours.toFixed(1)} h</strong><small>Confirmed + completed.</small></Card>
          <Card className="admin-status-card"><span className="metric-label">Ocupación de agenda · mes</span><strong>{metrics.occupancyPercent.toFixed(1)}%</strong><small>Incluye intervalos que bloquean agenda.</small></Card>
        </div>
      ) : (
        <Card className="admin-status-card"><span className="metric-label">Resumen</span><strong>No disponible</strong><small>No pudimos cargar las métricas operativas en este momento.</small></Card>
      )}

      <div className="admin-dashboard-actions phase7-dashboard-actions">
        <Card className="admin-board admin-readonly-callout"><div><Badge tone="success">Operativa</Badge><h2>Pizarra semanal</h2><p>Agenda, pending, confirmaciones, cancelaciones y bloqueos.</p></div><Link className="button button--primary" href="/admin/disponibilidad">Abrir pizarra</Link></Card>
        <Card className="admin-board admin-readonly-callout"><div><Badge tone="info">Clientes</Badge><h2>Clientes</h2><p>Datos privados, historial y agregados derivados de reservas reales.</p></div><Link className="button button--secondary" href="/admin/clientes">Ver clientes</Link></Card>
        <Card className="admin-board admin-readonly-callout"><div><Badge tone="info">Precios</Badge><h2>Precios</h2><p>Tarifas vigentes/versionadas. {canPerformPhase7Operation(context.role, "manage_pricing") ? "Tu rol puede administrar vigencias." : "Tu rol mantiene permisos limitados."}</p></div><Link className="button button--secondary" href="/admin/precios">Ver precios</Link></Card>
        <Card className="admin-board admin-readonly-callout"><div><Badge tone="info">Operativo</Badge><h2>Actividad y valor</h2><p>Métricas por periodo con semántica operativa rigurosa.</p></div><Link className="button button--secondary" href="/admin/ingresos">Ver actividad</Link></Card>
      </div>
    </>
  );
}
