import Link from "next/link";
import { AdminPricingForm } from "@/components/admin/AdminPricingForm";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/States";
import { requireAdminContext } from "@/lib/auth/server";
import { isLocalDevAdminUserId } from "@/lib/auth/localDev";
import { lightingModeLabel, pricingTemporalLabel, pricingTemporalStatus } from "@/lib/admin/phase7";
import { formatMoney } from "@/lib/admin/reservations";
import { createPhase7Repository } from "@/lib/data/phase7Service";
import { Phase7RepositoryError } from "@/lib/data/repositories/phase7Repository";
import { getAdminBusinessStructure } from "@/lib/data/inventoryService";
import { businessTodayDateKey } from "@/lib/availability";

function formatDate(value: string | null) {
  if (!value) return "Sin fecha final";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export default async function AdminPricingPage() {
  const context = await requireAdminContext();
  try {
    const rules = await createPhase7Repository({ local: isLocalDevAdminUserId(context.userId) }).listPricingRules();
    const structure = !isLocalDevAdminUserId(context.userId) ? await getAdminBusinessStructure() : null;
    const courts = structure?.venues.flatMap((venue) => venue.courts.map((court) => ({
      id: court.courtId, name: court.name,
    }))) ?? [...new Map(rules.map((rule) => [rule.courtId, { id: rule.courtId, name: rule.courtName }])).values()];
    const canManage = context.role === "owner" || context.role === "admin";
    return (
      <>
        <header className="admin-topbar">
          <div><span className="eyebrow">TARIFAS VERSIONADAS</span><h1>Precios</h1><p className="admin-subtitle">Las reservas guardan su tarifa histórica. Cambiar una vigencia futura no reescribe reservas existentes.</p></div>
          <Badge tone="info">{context.timezone}</Badge>
        </header>

        {rules.length === 0 ? (
          <Card className="phase7-pricing-editor">
            <span className="eyebrow">PRIMEROS PASOS</span>
            <h2>{courts.length ? "Establece la primera tarifa" : "Primero crea una cancha"}</h2>
            <p>{courts.length
              ? "Ya tienes canchas registradas, pero ninguna tarifa vigente. Establece los precios iniciales para cada cancha y modalidad."
              : "Todavía no se han registrado canchas en este negocio. Crea una sede y una cancha con horario y tarifas con/sin luz. No necesitas editar pricing_rules manualmente."}</p>
            <ol className="admin-pricing-setup-steps">
              <li>Registra una sede física.</li>
              <li>Agrega una cancha, asigna su deporte y horario semanal.</li>
              <li>Configura sus tarifas con luz y sin luz.</li>
              <li>Vuelve a «Negocio, sedes y canchas» para publicar el negocio.</li>
            </ol>
            <Link href={courts.length ? "/admin/configuracion/estructura#courts-title" : "/admin/configuracion/estructura#venues-title"} className="button button--primary">
              {courts.length ? "Revisar canchas y horarios" : "Crear sede y cancha"} ↗
            </Link>
            {courts.length ? (
              <div className="admin-pricing-initial-form">
                <h3>También puedes configurar aquí las tarifas iniciales</h3>
                <AdminPricingForm rules={rules} courts={courts} businessToday={businessTodayDateKey(new Date(), context.timezone)} businessCurrency={structure?.currency ?? "PEN"} role={context.role}/>
              </div>
            ) : null}
            {!canManage ? <p>Tu rol es de solo lectura. Solicita al propietario o administrador del negocio que configure las canchas.</p> : null}
          </Card>
        ) : (
          <>
            <div className="phase7-pricing-grid">
              {rules.map((rule) => {
                const temporal = pricingTemporalStatus(rule);
                return (
                  <Card className={temporal === "current" ? "phase7-price-card phase7-price-card--current" : "phase7-price-card"} key={rule.id}>
                    <div className="phase7-card-head">
                      <div><strong>{rule.courtName}</strong><span>{lightingModeLabel(rule.lighting)}</span></div>
                      <Badge tone={temporal === "current" ? "success" : temporal === "future" ? "info" : "neutral"}>{pricingTemporalLabel(temporal)}</Badge>
                    </div>
                    <div className="phase7-price-value">{formatMoney(rule.hourlyRate, rule.currency)}<small>/hora</small></div>
                    <dl className="phase7-rule-meta">
                      <div><dt>Desde</dt><dd>{formatDate(rule.effectiveFrom)}</dd></div>
                      <div><dt>Hasta</dt><dd>{formatDate(rule.effectiveUntil)}</dd></div>
                    </dl>
                  </Card>
                );
              })}
            </div>

            <Card className="phase7-pricing-editor">
              <span className="eyebrow">PROGRAMAR CAMBIO</span>
              <h2>Nueva vigencia</h2>
              <p>Owner y admin pueden programar una nueva tarifa. Staff conserva lectura únicamente.</p>
              <AdminPricingForm rules={rules} courts={courts} businessToday={businessTodayDateKey(new Date(), context.timezone)} businessCurrency={structure?.currency ?? "PEN"} role={context.role} />
            </Card>
          </>
        )}
      </>
    );
  } catch (error) {
    return <ErrorState title={error instanceof Phase7RepositoryError ? error.message : "No pudimos cargar las tarifas."} />;
  }
}
