import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/States";
import { requireAdminContext } from "@/lib/auth/server";
import { isLocalDevAdminUserId } from "@/lib/auth/localDev";
import { METRIC_DEFINITIONS } from "@/lib/admin/phase7";
import { formatMoney } from "@/lib/admin/reservations";
import { businessTodayDateKey } from "@/lib/availability";
import { createPhase7Repository } from "@/lib/data/phase7Service";
import { Phase7RepositoryError } from "@/lib/data/repositories/phase7Repository";

function validDate(value: string | undefined) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null; }
function monthStart(today: string) { return `${today.slice(0, 7)}-01`; }

export default async function AdminIncomePage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const context = await requireAdminContext();
  const params = await searchParams;
  const today = businessTodayDateKey(new Date(), context.timezone);
  const from = validDate(params.from) ?? monthStart(today);
  const to = validDate(params.to) ?? today;

  try {
    const metrics = await createPhase7Repository({ local: isLocalDevAdminUserId(context.userId) }).getOperationalMetrics(from, to);
    return (
      <>
        <header className="admin-topbar">
          <div>
            <span className="eyebrow">ACTIVIDAD · NO CONTABILIDAD DE PAGOS</span>
            <h1>Valor de reservas y actividad</h1>
            <p className="admin-subtitle">Sin módulo de pagos, estos importes representan valor autoritativo de reservas. No se presentan como dinero cobrado.</p>
          </div>
          <Badge tone="info">Cobros fuera de la plataforma</Badge>
        </header>

        <form className="phase7-period-filter" method="get">
          <label className="field"><span className="field__label">Desde</span><input className="field__control" type="date" name="from" defaultValue={from} /></label>
          <label className="field"><span className="field__label">Hasta</span><input className="field__control" type="date" name="to" defaultValue={to} /></label>
          <button className="button button--secondary" type="submit">Aplicar periodo</button>
          {context.role === "owner" || context.role === "admin" ? (
            <a className="button button--ghost" href={`/api/admin/export.xlsx?from=${from}&to=${to}`}>Exportar Excel</a>
          ) : null}
          <span>{metrics.timezone}</span>
        </form>

        <div className="phase7-metric-grid">
          <Card><span className="metric-label">Valor confirmado/programado</span><strong>{formatMoney(metrics.confirmedValue, metrics.currency)}</strong><small>{METRIC_DEFINITIONS.confirmedValue}</small></Card>
          <Card><span className="metric-label">Valor completado</span><strong>{formatMoney(metrics.completedValue, metrics.currency)}</strong><small>{METRIC_DEFINITIONS.completedValue}</small></Card>
          <Card><span className="metric-label">Horas reservadas</span><strong>{metrics.reservedHours.toFixed(1)} h</strong><small>{METRIC_DEFINITIONS.reservedHours}</small></Card>
          <Card><span className="metric-label">Ocupación de agenda</span><strong>{metrics.occupancyPercent.toFixed(1)}%</strong><small>{METRIC_DEFINITIONS.occupancyPercent}</small></Card>
        </div>

        <div className="phase7-activity-grid">
          <Card>
            <h2>Reservas por estado</h2>
            <dl className="phase7-state-breakdown">
              <div><dt>Total en periodo</dt><dd>{metrics.reservationCount}</dd></div>
              <div><dt>Pendientes</dt><dd>{metrics.pendingCount}</dd></div>
              <div><dt>Confirmadas</dt><dd>{metrics.confirmedCount}</dd></div>
              <div><dt>Completadas</dt><dd>{metrics.completedCount}</dd></div>
              <div><dt>Canceladas</dt><dd>{metrics.cancelledCount}</dd></div>
            </dl>
          </Card>
          <Card>
            <h2>Capacidad y bloqueo</h2>
            <dl className="phase7-state-breakdown">
              <div><dt>Capacidad abierta</dt><dd>{metrics.openCapacityHours.toFixed(1)} h</dd></div>
              <div><dt>Agenda ocupada</dt><dd>{metrics.agendaOccupiedHours.toFixed(1)} h</dd></div>
              <div><dt>Horas pending</dt><dd>{metrics.pendingHours.toFixed(1)} h</dd></div>
              <div><dt>Horas confirmed/completed</dt><dd>{metrics.reservedHours.toFixed(1)} h</dd></div>
            </dl>
          </Card>
        </div>

        <Card className="phase7-payments-pending"><Badge tone="neutral">WhatsApp</Badge><h2>Coordinación económica fuera de la web</h2><p>Cualquier adelanto o pago se acuerda directamente entre el negocio y el cliente por WhatsApp. Estas métricas no acreditan cobros.</p></Card>
      </>
    );
  } catch (error) {
    return <ErrorState title={error instanceof Phase7RepositoryError ? error.message : `No pudimos calcular las métricas de ${context.businessName}.`} />;
  }
}

