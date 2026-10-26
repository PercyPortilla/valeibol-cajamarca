import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { requireAdminContext } from "@/lib/auth/server";
import { isLocalDevAdminUserId } from "@/lib/auth/localDev";
import { createPhase7Repository } from "@/lib/data/phase7Service";
import {
  Phase7RepositoryError,
  type AdminCustomerCursor,
  type AdminCustomerHistoryCursor,
} from "@/lib/data/repositories/phase7Repository";
import { formatAdminDateTime, formatMoney, lightingLabel, reservationStatusLabel, reservationStatusTone } from "@/lib/admin/reservations";
import { netHeightLabel } from "@/lib/booking";
import type { AdminCustomerSummary } from "@/lib/admin/phase7";

function isUuid(value: string | undefined) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function customerCursor(params: { cursorCreated?: string; cursorCustomerId?: string }): AdminCustomerCursor | null {
  if (!params.cursorCreated || !isUuid(params.cursorCustomerId)) return null;
  const createdAt = new Date(params.cursorCreated);
  if (Number.isNaN(createdAt.getTime())) return null;
  return { createdAt: createdAt.toISOString(), id: params.cursorCustomerId!.toLowerCase() };
}

function historyCursor(params: { historyCreated?: string; historyId?: string }): AdminCustomerHistoryCursor | null {
  if (!params.historyCreated || !isUuid(params.historyId)) return null;
  const createdAt = new Date(params.historyCreated);
  if (Number.isNaN(createdAt.getTime())) return null;
  return { createdAt: createdAt.toISOString(), id: params.historyId!.toLowerCase() };
}

function customersHref(options?: {
  cursor?: AdminCustomerCursor | null;
  customerId?: string | null;
  history?: AdminCustomerHistoryCursor | null;
}) {
  const params = new URLSearchParams();
  if (options?.cursor) {
    params.set("cursorCreated", options.cursor.createdAt);
    params.set("cursorCustomerId", options.cursor.id);
  }
  if (options?.customerId) params.set("cliente", options.customerId);
  if (options?.history) {
    params.set("historyCreated", options.history.createdAt);
    params.set("historyId", options.history.id);
  }
  const query = params.toString();
  return query ? `/admin/clientes?${query}` : "/admin/clientes";
}

export default async function AdminCustomersPage({ searchParams }: {
  searchParams: Promise<{
    cliente?: string;
    cursorCreated?: string;
    cursorCustomerId?: string;
    historyCreated?: string;
    historyId?: string;
  }>;
}) {
  const context = await requireAdminContext();
  const params = await searchParams;
  const { cliente } = params;
  const cursor = customerCursor(params);
  const customerHistoryCursor = historyCursor(params);
  const repository = createPhase7Repository({ local: isLocalDevAdminUserId(context.userId) });

  try {
    const customerPage = await repository.listCustomersPage({ limit: 30, cursor });
    const customers = customerPage.items;
    let selected: AdminCustomerSummary | null = null;
    let selectedMissing = false;
    if (isUuid(cliente)) {
      try {
        selected = await repository.getCustomer(cliente!);
      } catch (error) {
        if (error instanceof Phase7RepositoryError && error.code === "not_found") selectedMissing = true;
        else throw error;
      }
    }
    const historyPage = selected
      ? await repository.getCustomerHistoryPage(selected.id, { limit: 25, cursor: customerHistoryCursor })
      : { items: [], nextCursor: null };
    const history = historyPage.items;
    const tenantIsEmpty = customers.length === 0 && !cursor && !selected && !selectedMissing;

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

        {tenantIsEmpty ? (
          <EmptyState title="Todavía no hay clientes reales" detail="Los clientes aparecerán aquí cuando existan solicitudes o reservas reales. No se generan registros ficticios." />
        ) : (
          <div className="phase7-customer-layout">
            <section className="phase7-customer-list" aria-label="Clientes">
              {customers.length === 0 && cursor ? (
                <EmptyState title="No hay más clientes en esta página" detail="El cursor ya no devuelve resultados. Vuelve al inicio para continuar navegando el directorio." />
              ) : null}
              {customers.length === 0 && !cursor && selectedMissing ? (
                <EmptyState title="No hay clientes visibles" detail="La selección solicitada ya no está disponible dentro de este negocio." />
              ) : null}
              {customers.map((customer) => (
                <Card className={selected?.id === customer.id ? "phase7-customer-card phase7-customer-card--selected" : "phase7-customer-card"} key={customer.id}>
                  <div className="phase7-card-head">
                    <div><strong>{customer.fullName}</strong><span>{customer.phoneE164 ?? "Sin WhatsApp registrado"}</span></div>
                    <Badge tone="neutral">Cliente</Badge>
                  </div>
                  <dl className="phase7-mini-stats">
                    <div><dt>Reservas</dt><dd>{customer.reservationCount}</dd></div>
                    <div><dt>Activas</dt><dd>{customer.activeReservationCount}</dd></div>
                    <div><dt>Completadas</dt><dd>{customer.completedReservationCount}</dd></div>
                    <div><dt>Valor completado*</dt><dd>{formatMoney(customer.completedValue, customer.currency)}</dd></div>
                  </dl>
                  <small>Última actividad: {formatAdminDateTime(customer.lastActivityAt, context.timezone)}</small>
                  <Link className="button button--secondary button--small" href={customersHref({ cursor, customerId: customer.id })}>Ver historial</Link>
                </Card>
              ))}
              {customers.length > 0 ? <p className="phase7-footnote">* Valor acumulado de reservas completadas; es una métrica operativa del historial.</p> : null}
              {cursor || customerPage.nextCursor ? (
                <nav className="admin-reservation-actions" aria-label="Paginación del directorio de clientes">
                  {cursor ? <Link className="button button--ghost" href="/admin/clientes">Volver al inicio</Link> : null}
                  {customerPage.nextCursor ? <Link className="button button--ghost" href={customersHref({ cursor: customerPage.nextCursor })}>Ver más clientes →</Link> : null}
                </nav>
              ) : null}
            </section>

            <section className="phase7-customer-history" aria-live="polite">
              {selectedMissing ? (
                <Card>
                  <h2>Cliente no disponible</h2>
                  <p>El cliente seleccionado ya no existe, fue archivado o no pertenece a este negocio.</p>
                  <Link className="button button--ghost" href={customersHref({ cursor })}>Volver al directorio</Link>
                </Card>
              ) : !selected ? (
                <Card><h2>Historial</h2><p>Selecciona un cliente para revisar sus reservas reales.</p></Card>
              ) : (
                <>
                  <div className="section-heading section-heading--compact">
                    <div><span className="eyebrow">HISTORIAL PRIVADO</span><h2>{selected.fullName}</h2><p>{selected.phoneE164 ?? "Sin WhatsApp registrado"}</p></div>
                    <Link className="button button--ghost" href={customersHref({ cursor })}>Cerrar</Link>
                  </div>
                  {history.length === 0 ? (
                    <EmptyState
                      title={customerHistoryCursor ? "No hay más reservas en esta página" : "Sin reservas asociadas"}
                      detail={customerHistoryCursor ? "Vuelve al inicio del historial para seguir navegando las reservas del cliente." : "El cliente existe, pero aún no tiene historial de reservas visible."}
                    />
                  ) : history.map((item) => (
                    <article className="phase7-history-row" key={item.id}>
                      <div><strong>{item.courtName}</strong><span>{formatAdminDateTime(item.startAt, context.timezone)} → {formatAdminDateTime(item.endAt, context.timezone)}</span></div>
                      <div><Badge tone={reservationStatusTone(item.status)}>{reservationStatusLabel(item.status)}</Badge><span>{lightingLabel(item.lighting)} · Red {netHeightLabel(item.netHeightCm)}</span></div>
                      <div><span>{formatMoney(item.hourlyRate, item.currency)}/h</span><strong>{formatMoney(item.totalAmount, item.currency)}</strong></div>
                    </article>
                  ))}
                  {customerHistoryCursor || historyPage.nextCursor ? (
                    <nav className="admin-reservation-actions" aria-label="Paginación del historial del cliente">
                      {customerHistoryCursor ? <Link className="button button--ghost" href={customersHref({ cursor, customerId: selected.id })}>Volver al inicio del historial</Link> : null}
                      {historyPage.nextCursor ? <Link className="button button--ghost" href={customersHref({ cursor, customerId: selected.id, history: historyPage.nextCursor })}>Ver reservas más antiguas →</Link> : null}
                    </nav>
                  ) : null}
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
