import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { requireAdminContext } from "@/lib/auth/server";
import { createPhase7Repository } from "@/lib/data/phase7Service";
import { Phase7RepositoryError } from "@/lib/data/repositories/phase7Repository";
import { formatAdminDateTime, formatMoney, lightingLabel, reservationStatusLabel, reservationStatusTone } from "@/lib/admin/reservations";

function isUuid(value: string | undefined) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const context = await requireAdminContext();
  const { cliente } = await searchParams;
  const repository = createPhase7Repository();

  try {
    const customers = await repository.listCustomers(200);
    const selected = isUuid(cliente) ? customers.find((customer) => customer.id === cliente) ?? null : null;
    const history = selected ? await repository.getCustomerHistory(selected.id, 100) : [];

    return (
      <>
        <header className="admin-topbar">
          <div>
            <span className="eyebrow">CLIENTES · DATOS REALES</span>
            <h1>Clientes e historial</h1>
            <p className="admin-subtitle">Información derivada exclusivamente de reservas de {context.businessName}. La PII permanece dentro del panel protegido.</p>
          </div>
          <Badge tone="success">{context.roleLabel}</Badge>
        </header>

        {customers.length === 0 ? (
          <EmptyState title="Todavía no hay clientes reales" detail="Los clientes aparecerán aquí cuando existan solicitudes o reservas reales. No se generan registros ficticios." />
        ) : (
          <div className="phase7-customer-layout">
            <section className="phase7-customer-list" aria-label="Clientes">
              {customers.map((customer) => (
                <Card className={selected?.id === customer.id ? "phase7-customer-card phase7-customer-card--selected" : "phase7-customer-card"} key={customer.id}>
                  <div className="phase7-card-head">
                    <div><strong>{customer.fullName}</strong><span>{customer.phoneE164 ?? "Sin WhatsApp registrado"}</span></div>
                    <Badge tone={customer.marketingOptIn ? "success" : "neutral"}>{customer.marketingOptIn ? "Promos: sí" : "Promos: no"}</Badge>
                  </div>
                  <dl className="phase7-mini-stats">
                    <div><dt>Reservas</dt><dd>{customer.reservationCount}</dd></div>
                    <div><dt>Activas</dt><dd>{customer.activeReservationCount}</dd></div>
                    <div><dt>Completadas</dt><dd>{customer.completedReservationCount}</dd></div>
                    <div><dt>Valor completado*</dt><dd>{formatMoney(customer.completedValue, customer.currency)}</dd></div>
                  </dl>
                  <small>Última actividad: {formatAdminDateTime(customer.lastActivityAt, context.timezone)}</small>
                  <Link className="button button--secondary button--small" href={`/admin/clientes?cliente=${customer.id}`}>Ver historial</Link>
                </Card>
              ))}
              <p className="phase7-footnote">* Valor de reservas completed; no implica dinero cobrado porque aún no existe módulo de pagos.</p>
            </section>

            <section className="phase7-customer-history" aria-live="polite">
              {!selected ? (
                <Card><h2>Historial</h2><p>Selecciona un cliente para revisar sus reservas reales.</p></Card>
              ) : (
                <>
                  <div className="section-heading section-heading--compact">
                    <div><span className="eyebrow">HISTORIAL PRIVADO</span><h2>{selected.fullName}</h2><p>{selected.phoneE164 ?? "Sin WhatsApp registrado"}</p></div>
                    <Link className="button button--ghost" href="/admin/clientes">Cerrar</Link>
                  </div>
                  {history.length === 0 ? <EmptyState title="Sin reservas asociadas" detail="El cliente existe, pero aún no tiene historial de reservas visible." /> : history.map((item) => (
                    <article className="phase7-history-row" key={item.id}>
                      <div><strong>{item.courtName}</strong><span>{formatAdminDateTime(item.startAt, context.timezone)} → {formatAdminDateTime(item.endAt, context.timezone)}</span></div>
                      <div><Badge tone={reservationStatusTone(item.status)}>{reservationStatusLabel(item.status)}</Badge><span>{lightingLabel(item.lighting)}</span></div>
                      <div><span>{formatMoney(item.hourlyRate, item.currency)}/h</span><strong>{formatMoney(item.totalAmount, item.currency)}</strong></div>
                    </article>
                  ))}
                </>
              )}
            </section>
          </div>
        )}
      </>
    );
  } catch (error) {
    return <ErrorState title={error instanceof Phase7RepositoryError ? error.message : "No pudimos cargar Clientes."} />;
  }
}
