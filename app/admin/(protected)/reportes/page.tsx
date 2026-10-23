import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { requireAdminContext } from "@/lib/auth/server";
import { isLocalDevAdminUserId } from "@/lib/auth/localDev";
import { businessTodayDateKey } from "@/lib/availability";
import { createPhase7Repository } from "@/lib/data/phase7Service";
import { formatMoney } from "@/lib/admin/reservations";

export default async function AdminReportsPage() {
  const context = await requireAdminContext();
  const today = businessTodayDateKey();
  const from = `${today.slice(0, 7)}-01`;
  const metrics = await createPhase7Repository({ local: isLocalDevAdminUserId(context.userId) }).getOperationalMetrics(from, today);

  return (
    <>
      <header className="admin-topbar">
        <div>
          <span className="eyebrow">REPORTES OPERATIVOS</span>
          <h1>Resumen del mes</h1>
          <p className="admin-subtitle">Indicadores derivados de reservas y agenda. No representan cobros recibidos.</p>
        </div>
        <div className="admin-config-actions">
          <Badge tone="info">{from} → {today}</Badge>
          {context.role === "owner" || context.role === "admin" ? (
            <a className="button button--secondary" href={`/api/admin/export.xlsx?from=${from}&to=${today}`}>
              Exportar Excel
            </a>
          ) : null}
        </div>
      </header>

      <div className="phase7-metric-grid">
        <Card><span className="metric-label">Reservas</span><strong>{metrics.reservationCount}</strong><small>Total del periodo, incluidas canceladas.</small></Card>
        <Card><span className="metric-label">Valor confirmado</span><strong>{formatMoney(metrics.confirmedValue, metrics.currency)}</strong><small>Reservas confirmadas; no acredita cobro recibido.</small></Card>
        <Card><span className="metric-label">Horas reservadas</span><strong>{metrics.reservedHours.toFixed(1)} h</strong><small>Confirmed + completed.</small></Card>
        <Card><span className="metric-label">Ocupación</span><strong>{metrics.occupancyPercent.toFixed(1)}%</strong><small>Agenda ocupada / capacidad abierta.</small></Card>
      </div>

      <div className="admin-dashboard-actions phase7-dashboard-actions admin-report-links">
        <Card className="admin-board admin-readonly-callout"><div><Badge tone="info">Detalle</Badge><h2>Actividad por periodo</h2><p>Filtra fechas y revisa estados, horas y valor de reservas.</p></div><Link className="button button--secondary" href="/admin/ingresos">Abrir actividad</Link></Card>
        <Card className="admin-board admin-readonly-callout"><div><Badge tone="info">Clientes</Badge><h2>Historial de clientes</h2><p>Consulta reservas y valor completado por cliente.</p></div><Link className="button button--secondary" href="/admin/clientes">Abrir clientes</Link></Card>
        <Card className="admin-board admin-readonly-callout"><div><Badge tone="info">Agenda</Badge><h2>Reservas y disponibilidad</h2><p>Revisa la agenda semanal y las solicitudes activas.</p></div><Link className="button button--secondary" href="/admin/disponibilidad">Abrir agenda</Link></Card>
      </div>
    </>
  );
}
