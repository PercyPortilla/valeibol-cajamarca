import Link from "next/link";
import { AdminScheduleBoard } from "../../../../components/admin/AdminScheduleBoard.tsx";
import { Badge } from "../../../../components/ui/Badge.tsx";
import { EmptyState, ErrorState } from "../../../../components/ui/States.tsx";
import { requireAdminContext } from "../../../../lib/auth/server.ts";
import { addDays, businessTodayDateKey, formatWeekRange } from "../../../../lib/availability.ts";
import { getAdminWeekRange } from "../../../../lib/admin/schedule.ts";
import type { AdminPricingRule } from "../../../../lib/admin/phase7.ts";
import { createAdminOperationsRepository } from "../../../../lib/data/adminOperationsService.ts";
import { AdminOperationsRepositoryError } from "../../../../lib/data/repositories/adminOperationsRepository.ts";
import { createPhase7Repository } from "../../../../lib/data/phase7Service.ts";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function validDateKey(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export default async function AdminAvailabilityPage({ searchParams }: { searchParams: SearchParams }) {
  const context = await requireAdminContext();
  const params = await searchParams;
  const requested = validDateKey(firstValue(params.week));
  const today = businessTodayDateKey();
  const range = getAdminWeekRange(requested ?? today);

  let snapshot;
  try {
    snapshot = await createAdminOperationsRepository().getSchedule(range.from, range.to, context.timezone);
  } catch (error) {
    return (
      <>
        <header className="admin-topbar"><div><span className="eyebrow">DISPONIBILIDAD</span><h1>Pizarra administrativa</h1></div></header>
        <ErrorState title={error instanceof AdminOperationsRepositoryError ? error.message : "No pudimos cargar la pizarra administrativa."} />
      </>
    );
  }

  let pricingRules: AdminPricingRule[] = [];
  try {
    pricingRules = await createPhase7Repository().listPricingRules();
  } catch {
    pricingRules = [];
  }

  const weekKeys = Array.from({ length: 7 }, (_, index) => addDays(range.from, index));
  const isProvisional = snapshot.courts.some((court) => court.days.some((day) => day.scheduleStatus === "provisional"));

  return (
    <>
      <header className="admin-topbar admin-topbar--schedule">
        <div>
          <span className="eyebrow">OPERACIÓN DE AGENDA</span>
          <h1>Pizarra administrativa</h1>
          <p className="admin-subtitle">Reserva, confirma, cancela y bloquea horarios con validación real en PostgreSQL. La PII existe únicamente dentro de este panel protegido.</p>
        </div>
        <div className="admin-topbar__badges">
          <Badge tone={isProvisional ? "warning" : "success"}>{isProvisional ? "Horario provisional" : "Horario confirmado"}</Badge>
          <Badge tone="info">{context.roleLabel}</Badge>
        </div>
      </header>

      <div className="admin-week-navigation" aria-label="Navegación semanal administrativa">
        <Link className="button button--ghost" href={`/admin/disponibilidad?week=${addDays(range.from, -7)}`}>← Semana anterior</Link>
        <div><strong>{formatWeekRange(weekKeys)}</strong><small>{context.timezone}</small></div>
        <Link className="button button--secondary" href="/admin/disponibilidad">HOY</Link>
        <Link className="button button--ghost" href={`/admin/disponibilidad?week=${addDays(range.from, 7)}`}>Semana siguiente →</Link>
      </div>

      {snapshot.courts.length === 0 ? (
        <EmptyState title="No hay canchas activas" detail="Configura al menos una cancha y sus horarios antes de operar la agenda." />
      ) : (
        <AdminScheduleBoard snapshot={snapshot} timezone={context.timezone} role={context.role} pricingRules={pricingRules} />
      )}
    </>
  );
}
