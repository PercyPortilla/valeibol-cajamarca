import Link from "next/link";
import { CustomerAuthForm } from "@/components/account/CustomerAuthForm";
import { CustomerLogoutButton } from "@/components/account/CustomerLogoutButton";
import { PlatformFooter } from "@/components/platform/PlatformFooter";
import { PlatformHeader } from "@/components/platform/PlatformHeader";
import { Badge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/booking";
import { createServerSupabaseClient, hasPublicSupabaseServerConfig } from "@/lib/data/supabase/server";
import type { Database } from "@/lib/data/supabase/database.types";
import type { Metadata } from "next";
import { VerifiedReviewForm } from "@/components/account/VerifiedReviewForm";
import { BusinessCard } from "@/components/platform/BusinessCard";
import { getPublicPlatformCatalog } from "@/lib/data/platformService";
import { groupCatalogByBusiness, type PlatformBusinessCard } from "@/lib/data/repositories/platformRepository";
import { CustomerReservationActions } from "@/components/account/CustomerReservationActions";
import { CustomerReservationClaimForm } from "@/components/account/CustomerReservationClaimForm";
import { CustomerProfileForm } from "@/components/account/CustomerProfileForm";
import { CustomerReservationCancellationRequest } from "@/components/account/CustomerReservationCancellationRequest";
import { CustomerReservationRescheduleRequest } from "@/components/account/CustomerReservationRescheduleRequest";
import { CustomerBusinessRescheduleProposal } from "@/components/account/CustomerBusinessRescheduleProposal";
import { CustomerNotificationCenter } from "@/components/account/CustomerNotificationCenter";
import { normalizePublicBusinessPhone } from "@/lib/data/publicBusinessContactService";
import { buildWhatsAppChatHref } from "@/lib/whatsapp/links";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Mi cuenta",
  robots: { index: false, follow: false },
};

type CustomerReservation = Database["public"]["Functions"]["get_my_reservations_page"]["Returns"][number];
type ReviewableReservation = Database["public"]["Functions"]["get_my_reviewable_reservations"]["Returns"][number];

const NOTIFICATION_PAGE_SIZE = 40;
const RESERVATION_PAGE_SIZE = 20;

type NotificationCursor = { createdAt: string; id: string };
type ReservationCursor = { createdAt: string; id: string };

function isUuid(value: string | undefined) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function notificationCursor(params: { notificationCreated?: string; notificationId?: string }): NotificationCursor | null {
  if (!params.notificationCreated || !isUuid(params.notificationId)) return null;
  const createdAt = new Date(params.notificationCreated);
  if (Number.isNaN(createdAt.getTime())) return null;
  return { createdAt: createdAt.toISOString(), id: params.notificationId!.toLowerCase() };
}

function reservationCursor(params: { reservationCreated?: string; reservationId?: string }): ReservationCursor | null {
  if (!params.reservationCreated || !isUuid(params.reservationId)) return null;
  const createdAt = new Date(params.reservationCreated);
  if (Number.isNaN(createdAt.getTime())) return null;
  return { createdAt: createdAt.toISOString(), id: params.reservationId!.toLowerCase() };
}

function accountHref({ notification, reservation, anchor }: {
  notification?: NotificationCursor | null;
  reservation?: ReservationCursor | null;
  anchor: string;
}) {
  const params = new URLSearchParams();
  if (notification) {
    params.set("notificationCreated", notification.createdAt);
    params.set("notificationId", notification.id);
  }
  if (reservation) {
    params.set("reservationCreated", reservation.createdAt);
    params.set("reservationId", reservation.id);
  }
  const query = params.toString();
  return `/mi-cuenta${query ? `?${query}` : ""}#${anchor}`;
}

function formatReservationDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "America/Lima" }).format(new Date(value));
}

function formatReservationTime(value: string) {
  return new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Lima" }).format(new Date(value));
}

function reservationStatusMeta(
  status: CustomerReservation["status"],
  closureKind: CustomerReservation["closure_kind"],
  isExpiredPending: CustomerReservation["is_expired_pending"],
) {
  if (status === "confirmed") return { label: "Confirmada", tone: "success" as const, detail: "El negocio confirmó tu reserva. Para cambios o cancelación, coordina directamente con el negocio." };
  if (status === "completed") return { label: "Completada", tone: "info" as const, detail: "La reserva ya finalizó." };
  if (status === "pending" && isExpiredPending) return { label: "Vencida", tone: "danger" as const, detail: "El horario ya pasó y esta solicitud ya no puede confirmarse. El negocio debe cerrarla como expirada." };
  if (status === "cancelled" && closureKind === "business_rejection") return { label: "Rechazada", tone: "danger" as const, detail: "El negocio no aceptó esta solicitud de reserva. El horario quedó liberado." };
  if (status === "cancelled" && closureKind === "customer_withdrawal") return { label: "Retirada", tone: "neutral" as const, detail: "Retiraste esta solicitud antes de que el negocio la confirmara." };
  if (status === "cancelled" && closureKind === "request_expiration") return { label: "Expirada", tone: "neutral" as const, detail: "La solicitud venció sin ser confirmada por el negocio." };
  if (status === "cancelled" && closureKind === "confirmed_cancellation") return { label: "Cancelada", tone: "danger" as const, detail: "Esta reserva fue cancelada después de su confirmación." };
  if (status === "cancelled") return { label: "Cancelada", tone: "danger" as const, detail: "Esta reserva fue cancelada." };
  return { label: "Pendiente", tone: "warning" as const, detail: "Esperando confirmación del negocio. Si no aparece la opción de retiro, coordina el estado directamente con el negocio." };
}

function reservationMode(reservation: CustomerReservation) {
  const lighting = reservation.lighting === "with_lights" ? "Con luz" : "Sin luz";
  return reservation.net_height_cm === null ? lighting : `${lighting} · Red ${reservation.net_height_cm} cm`;
}

export default async function CustomerAccountPage({ searchParams }: {
  searchParams: Promise<{ notificationCreated?: string; notificationId?: string; reservationCreated?: string; reservationId?: string }>;
}) {
  const params = await searchParams;
  const notificationPageCursor = notificationCursor(params);
  const reservationPageCursor = reservationCursor(params);
  let userEmail: string | null = null;
  let reservations: Database["public"]["Functions"]["get_my_reservations_page"]["Returns"] = [];
  let nextReservationCursor: ReservationCursor | null = null;
  let reviewableReservations: ReviewableReservation[] = [];
  let favoriteBusinessIds: string[] = [];
  let favoriteBusinesses: PlatformBusinessCard[] = [];
  let historyLoadFailed = false;
  let customerProfile: Database["public"]["Functions"]["get_my_customer_profile"]["Returns"][number] | null = null;
  let changeRequests: Database["public"]["Functions"]["get_my_latest_reservation_change_requests"]["Returns"] = [];
  let notifications: Database["public"]["Functions"]["get_my_notifications_page"]["Returns"] = [];
  let nextNotificationCursor: NotificationCursor | null = null;
  let notificationUnreadCount = 0;

  if (hasPublicSupabaseServerConfig()) {
    try {
      const supabase = await createServerSupabaseClient();
      const { data } = await supabase.auth.getUser();
      userEmail = data.user?.email ?? null;
      if (data.user) {
        const [historyResult, favoritesResult, reviewsResult, profileResult, notificationsResult, unreadResult] = await Promise.all([
          supabase.rpc("get_my_reservations_page", {
            p_limit: RESERVATION_PAGE_SIZE + 1,
            p_cursor_created_at: reservationPageCursor?.createdAt ?? null,
            p_cursor_id: reservationPageCursor?.id ?? null,
          }),
          supabase.rpc("get_my_favorite_business_ids"),
          supabase.rpc("get_my_reviewable_reservations"),
          supabase.rpc("get_my_customer_profile"),
          supabase.rpc("get_my_notifications_page", {
            p_limit: NOTIFICATION_PAGE_SIZE + 1,
            p_cursor_created_at: notificationPageCursor?.createdAt ?? null,
            p_cursor_id: notificationPageCursor?.id ?? null,
          }),
          supabase.rpc("get_my_notification_unread_count"),
        ]);
        if (historyResult.error) historyLoadFailed = true;
        else {
          const reservationsWithExtra = historyResult.data ?? [];
          reservations = reservationsWithExtra.slice(0, RESERVATION_PAGE_SIZE);
          if (reservationsWithExtra.length > RESERVATION_PAGE_SIZE) {
            const last = reservations.at(-1)!;
            nextReservationCursor = { createdAt: last.created_at, id: last.reservation_id };
          }
        }
        if (!favoritesResult.error) favoriteBusinessIds = (favoritesResult.data ?? []).map((item) => item.business_id);
        if (!reviewsResult.error) reviewableReservations = reviewsResult.data ?? [];
        if (!profileResult.error) customerProfile = profileResult.data?.[0] ?? null;
        if (!notificationsResult.error) {
          const notificationsWithExtra = notificationsResult.data ?? [];
          notifications = notificationsWithExtra.slice(0, NOTIFICATION_PAGE_SIZE);
          if (notificationsWithExtra.length > NOTIFICATION_PAGE_SIZE) {
            const last = notifications.at(-1)!;
            nextNotificationCursor = { createdAt: last.created_at, id: last.notification_id };
          }
        }
        if (!unreadResult.error && typeof unreadResult.data === "number") notificationUnreadCount = unreadResult.data;
        if (!historyLoadFailed && reservations.length) {
          const changeResult = await supabase.rpc("get_my_latest_reservation_change_requests", {
            p_reservation_ids: reservations.map((reservation) => reservation.reservation_id),
          });
          if (changeResult.error) {
            historyLoadFailed = true;
            reservations = [];
          } else {
            changeRequests = changeResult.data ?? [];
          }
        }
      }
    } catch {
      userEmail = null;
    }
  }

  if (userEmail && favoriteBusinessIds.length) {
    const favoriteSet = new Set(favoriteBusinessIds);
    favoriteBusinesses = groupCatalogByBusiness(await getPublicPlatformCatalog()).filter((business) => favoriteSet.has(business.businessId));
  }

  return (
    <div className="platform-page">
      <PlatformHeader />
      <main className="account-page" id="platform-main" tabIndex={-1}>
        <div className="shell account-page__inner">
          <header className="account-page__heading">
            <span className="eyebrow">MI CUENTA</span>
            <h1>Mi cuenta</h1>
            <p>{userEmail ? "Consulta tus reservas y su estado. Cuando un negocio publique WhatsApp, podrás contactarlo directamente desde la reserva para coordinaciones adicionales." : "Inicia sesión o crea una cuenta para conservar el historial de las reservas que hagas con tu sesión activa."}</p>
          </header>

          {!userEmail ? <CustomerAuthForm /> : (
            <>
              <div className="account-user-bar">
                <div><small>Sesión iniciada</small><strong>{userEmail}</strong></div>
                <div className="account-user-actions"><Link className="button button--secondary" href="/buscar">Buscar cancha</Link><CustomerLogoutButton /></div>
              </div>
              <CustomerNotificationCenter
                notifications={notifications}
                unreadCount={notificationUnreadCount}
                pageEnd={Boolean(notificationPageCursor) && notifications.length === 0}
              />
              {notificationPageCursor || nextNotificationCursor ? (
                <nav className="account-user-actions" aria-label="Paginación de notificaciones">
                  {notificationPageCursor ? <Link className="button button--secondary" href={accountHref({ reservation: reservationPageCursor, anchor: "customer-notifications-title" })}>Volver al inicio</Link> : null}
                  {nextNotificationCursor ? <Link className="button button--secondary" href={accountHref({ notification: nextNotificationCursor, reservation: reservationPageCursor, anchor: "customer-notifications-title" })}>Ver notificaciones más antiguas →</Link> : null}
                </nav>
              ) : null}
              <CustomerProfileForm email={userEmail} initialDisplayName={customerProfile?.display_name ?? ""} initialPhoneE164={customerProfile?.phone_e164 ?? ""} />
              <CustomerReservationClaimForm />
              <section className="account-favorites" aria-labelledby="account-favorites-title">
                <div className="account-section-heading"><div><span className="eyebrow">FAVORITOS</span><h2 id="account-favorites-title">Complejos guardados</h2><p>{favoriteBusinesses.length ? `${favoriteBusinesses.length} ${favoriteBusinesses.length === 1 ? "complejo guardado" : "complejos guardados"}.` : "Guarda complejos desde el marketplace para encontrarlos aquí."}</p></div></div>
                {favoriteBusinesses.length ? <div className="platform-results-grid">{favoriteBusinesses.map((business) => <BusinessCard key={business.businessId} business={business} />)}</div> : <div className="account-empty"><h3>Aún no tienes favoritos</h3><p>Usa el corazón de una ficha o complejo para guardarlo en tu cuenta.</p><Link className="button button--secondary" href="/buscar">Explorar complejos</Link></div>}
              </section>
              <section className="account-reviews" aria-labelledby="account-reviews-title">
                <div className="account-section-heading"><div><span className="eyebrow">TU EXPERIENCIA</span><h2 id="account-reviews-title">Reseñas verificadas</h2><p>Solo puedes reseñar reservas completadas y vinculadas a esta cuenta.</p></div></div>
                {reviewableReservations.length ? <div className="account-review-list">
                  {reviewableReservations.map((reservation) => (
                    <article className="account-review-card" key={reservation.reservation_id}>
                      <header><div><strong>{reservation.business_name}</strong><p>{reservation.court_name} · {reservation.sport_name}</p></div><time dateTime={reservation.start_at}>{formatReservationDate(reservation.start_at)}</time></header>
                      <VerifiedReviewForm
                        reservationId={reservation.reservation_id}
                        existing={reservation.review_id && reservation.rating && reservation.review_status ? {
                          reviewId: reservation.review_id,
                          rating: reservation.rating,
                          comment: reservation.comment,
                          status: reservation.review_status,
                        } : null}
                      />
                    </article>
                  ))}
                </div> : <div className="account-empty"><h3>No hay reservas completadas para reseñar</h3><p>Cuando una reserva confirmada termine y el negocio la marque como completada, aparecerá aquí.</p></div>}
              </section>
              <section className="account-reservations" aria-labelledby="account-reservations-title">
                <div className="account-section-heading">
                  <div><span className="eyebrow">HISTORIAL</span><h2 id="account-reservations-title">Tus reservas</h2><p>{historyLoadFailed ? "No pudimos actualizar el historial." : reservations.length === 1 ? "1 reserva vinculada a tu cuenta." : `${reservations.length} reservas vinculadas a tu cuenta.`}</p></div>
                </div>
                {historyLoadFailed ? (
                  <div className="account-empty account-empty--error"><h3>No pudimos cargar tu historial</h3><p>Tu sesión sigue activa. Vuelve a intentarlo sin crear una reserva nueva.</p><Link className="button button--secondary" href="/mi-cuenta">Reintentar</Link></div>
                ) : reservations.length === 0 ? (
                  <div className="account-empty"><h3>Aún no tienes reservas vinculadas</h3><p>Puedes reservar sin cuenta, pero solo las nuevas reservas hechas con esta sesión activa aparecerán en tu historial.</p><Link className="button button--primary" href="/buscar">Buscar canchas</Link></div>
                ) : (
                  <div className="account-reservation-list">
                    {reservations.map((reservation) => {
                      const status = reservationStatusMeta(reservation.status, reservation.closure_kind, reservation.is_expired_pending);
                      const needsBusinessContact = reservation.status === "confirmed" || (reservation.status === "pending" && !reservation.can_withdraw);
                      const contactPhone = needsBusinessContact ? normalizePublicBusinessPhone(reservation.business_phone) : null;
                      const contactHref = contactPhone ? buildWhatsAppChatHref(
                        contactPhone,
                        `Hola, escribo por mi reserva en ${reservation.court_name} para ${formatReservationDate(reservation.start_at)} a las ${formatReservationTime(reservation.start_at)}.`,
                      ) : null;
                      const cancellationRequest = changeRequests.find((request) => request.reservation_id === reservation.reservation_id && request.request_type === "cancellation");
                      const rescheduleRequest = changeRequests.find((request) => request.reservation_id === reservation.reservation_id && request.request_type === "reschedule" && request.initiator_kind === "customer");
                      const businessProposal = changeRequests.find((request) => request.reservation_id === reservation.reservation_id && request.request_type === "reschedule" && request.initiator_kind === "business" && request.request_status === "pending");
                      const cancellationCanWithdraw = cancellationRequest?.can_withdraw_request ?? false;
                      const rescheduleCanWithdraw = rescheduleRequest?.can_withdraw_request ?? false;
                      return (
                        <article className="account-reservation-card" key={reservation.reservation_id}>
                          <div className="account-reservation-card__identity">
                            <div className="account-reservation-status"><Badge tone={status.tone}>{status.label}</Badge><small>{status.detail}</small></div>
                            <h3>{reservation.business_name}</h3>
                            <p>{reservation.court_name} · {reservation.sport_name}</p>
                          </div>
                          <dl>
                            <div><dt>Fecha</dt><dd>{formatReservationDate(reservation.start_at)}</dd></div>
                            <div><dt>Horario</dt><dd>{formatReservationTime(reservation.start_at)}–{formatReservationTime(reservation.end_at)}</dd></div>
                            <div><dt>Modalidad</dt><dd>{reservationMode(reservation)}</dd></div>
                            <div><dt>Valor de reserva</dt><dd>{formatMoney(Number(reservation.total_amount), reservation.currency)}</dd></div>
                          </dl>
                          <div className="account-reservation-actions">
                            <Link href={`/complejo/${encodeURIComponent(reservation.business_slug)}`}>Ver complejo →</Link>
                            {reservation.can_withdraw ? (
                              <CustomerReservationActions reservationId={reservation.reservation_id} businessName={reservation.business_name} />
                            ) : null}
                            {businessProposal ? (
                              <CustomerBusinessRescheduleProposal
                                requestId={businessProposal.request_id}
                                currentCourtName={reservation.court_name}
                                currentStartAt={reservation.start_at}
                                currentEndAt={reservation.end_at}
                                requestedCourtName={businessProposal.requested_court_name}
                                requestedStartAt={businessProposal.requested_start_at}
                                requestedEndAt={businessProposal.requested_end_at}
                                requestedTotalAmount={businessProposal.requested_total_amount}
                                currency={reservation.currency}
                                proposalNote={businessProposal.proposal_note}
                                timezone={reservation.business_timezone}
                              />
                            ) : null}
                            {!businessProposal && (reservation.can_request_cancellation || cancellationRequest) ? <CustomerReservationCancellationRequest reservationId={reservation.reservation_id} requestId={cancellationRequest?.request_id ?? null} requestStatus={(cancellationRequest?.request_status as "pending" | "approved" | "rejected" | undefined) ?? null} resolutionKind={cancellationRequest?.resolution_kind ?? null} resolutionNote={cancellationRequest?.resolution_note ?? null} canWithdrawPending={cancellationCanWithdraw} canRequest={reservation.can_request_cancellation} /> : null}
                            {!businessProposal && (reservation.can_request_reschedule || rescheduleRequest) ? <CustomerReservationRescheduleRequest reservationId={reservation.reservation_id} requestId={rescheduleRequest?.request_id ?? null} businessSlug={reservation.business_slug} timezone={reservation.business_timezone} currentCourtId={reservation.court_id} requestStatus={(rescheduleRequest?.request_status as "pending" | "approved" | "rejected" | undefined) ?? null} resolutionKind={rescheduleRequest?.resolution_kind ?? null} resolutionNote={rescheduleRequest?.resolution_note ?? null} canWithdrawPending={rescheduleCanWithdraw} canRequest={reservation.can_request_reschedule} /> : null}
                            {contactHref ? (
                              <a className="account-whatsapp-contact" href={contactHref} target="_blank" rel="noreferrer">Contactar por WhatsApp ↗</a>
                            ) : needsBusinessContact ? (
                              <small className="account-contact-unavailable">Este negocio no publicó un WhatsApp de contacto.</small>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
                {reservationPageCursor || nextReservationCursor ? (
                  <nav className="account-user-actions" aria-label="Paginación del historial de reservas">
                    {reservationPageCursor ? <Link className="button button--secondary" href={accountHref({ notification: notificationPageCursor, anchor: "account-reservations-title" })}>Volver al inicio de reservas</Link> : null}
                    {nextReservationCursor ? <Link className="button button--secondary" href={accountHref({ notification: notificationPageCursor, reservation: nextReservationCursor, anchor: "account-reservations-title" })}>Ver reservas más antiguas →</Link> : null}
                  </nav>
                ) : null}
              </section>
            </>
          )}
        </div>
      </main>
      <PlatformFooter />
    </div>
  );
}
