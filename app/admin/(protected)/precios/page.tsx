import { AdminPricingForm } from "@/components/admin/AdminPricingForm";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { requireAdminContext } from "@/lib/auth/server";
import { isLocalDevAdminUserId } from "@/lib/auth/localDev";
import { lightingModeLabel, pricingTemporalLabel, pricingTemporalStatus } from "@/lib/admin/phase7";
import { formatMoney } from "@/lib/admin/reservations";
import { createPhase7Repository } from "@/lib/data/phase7Service";
import { Phase7RepositoryError } from "@/lib/data/repositories/phase7Repository";

function formatDate(value: string | null) {
  if (!value) return "Sin fecha final";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export default async function AdminPricingPage() {
  const context = await requireAdminContext();
  try {
    const rules = await createPhase7Repository({ local: isLocalDevAdminUserId(context.userId) }).listPricingRules();
    return (
      <>
        <header className="admin-topbar">
          <div><span className="eyebrow">TARIFAS VERSIONADAS</span><h1>Precios</h1><p className="admin-subtitle">Las reservas guardan su tarifa histórica. Cambiar una vigencia futura no reescribe reservas existentes.</p></div>
          <Badge tone="info">{context.timezone}</Badge>
        </header>

        {rules.length === 0 ? <EmptyState title="No existen tarifas configuradas" detail="Configura pricing_rules antes de aceptar reservas reales." /> : (
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
              <AdminPricingForm rules={rules} role={context.role} />
            </Card>
          </>
        )}
      </>
    );
  } catch (error) {
    return <ErrorState title={error instanceof Phase7RepositoryError ? error.message : "No pudimos cargar las tarifas."} />;
  }
}
