import Link from "next/link";
import { CustomerAuthForm } from "@/components/account/CustomerAuthForm";
import { CustomerLogoutButton } from "@/components/account/CustomerLogoutButton";
import { PaymentReportForm } from "@/components/account/PaymentReportForm";
import { PlatformFooter } from "@/components/platform/PlatformFooter";
import { PlatformHeader } from "@/components/platform/PlatformHeader";
import { Badge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/booking";
import { createServerSupabaseClient, hasPublicSupabaseServerConfig } from "@/lib/data/supabase/server";
import type { Database } from "@/lib/data/supabase/database.types";
import { getPublicPaymentMethods } from "@/lib/data/paymentService";
import { paymentMethodLabel, paymentStatusLabel, type PublicPaymentMethod } from "@/lib/payments";

function formatReservationDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" }).format(new Date(value));
}

export default async function CustomerAccountPage() {
  let userEmail: string | null = null;
  let reservations: Database["public"]["Functions"]["get_my_reservations"]["Returns"] = [];
  let payments: Database["public"]["Functions"]["get_my_payments"]["Returns"] = [];
  const methodsByBusiness: Record<string, PublicPaymentMethod[]> = {};

  if (hasPublicSupabaseServerConfig()) {
    try {
      const supabase = await createServerSupabaseClient();
      const { data } = await supabase.auth.getUser();
      userEmail = data.user?.email ?? null;
      if (data.user) {
        const { data: history, error } = await supabase.rpc("get_my_reservations");
        if (!error) reservations = history ?? [];
        const { data: paymentHistory, error: paymentError } = await supabase.rpc("get_my_payments");
        if (!paymentError) payments = paymentHistory ?? [];
      }
    } catch {
      userEmail = null;
    }
  }

  if (userEmail) {
    const slugs = [...new Set(reservations.map((reservation) => reservation.business_slug))];
    await Promise.all(slugs.map(async (slug) => { methodsByBusiness[slug] = await getPublicPaymentMethods(slug); }));
  }

  const paymentsByReservation = new Map(payments.map((payment) => [payment.reservation_id, payment]));

  return (
    <div className="platform-page">
      <PlatformHeader />
      <main className="account-page" id="platform-main" tabIndex={-1}>
        <div className="shell account-page__inner">
          <header className="account-page__heading">
            <span className="eyebrow">MI CUENTA</span>
            <h1>{userEmail ? "Tus reservas" : "Accede a tu cuenta"}</h1>
            <p>{userEmail ? "Consulta las reservas vinculadas a tu sesión. Las reservas guest siguen funcionando sin cuenta." : "Crea una cuenta o inicia sesión para conservar un historial personal de nuevas reservas."}</p>
          </header>

          {!userEmail ? <CustomerAuthForm /> : (
            <>
              <div className="account-user-bar"><div><small>Sesión iniciada</small><strong>{userEmail}</strong></div><CustomerLogoutButton /></div>
              {reservations.length === 0 ? (
                <div className="account-empty"><h2>Aún no tienes reservas vinculadas</h2><p>Puedes seguir reservando como siempre; cuando reserves con esta sesión activa, aparecerá aquí.</p><Link className="button button--primary" href="/buscar">Buscar canchas</Link></div>
              ) : (
                <div className="account-reservation-list">
                  {reservations.map((reservation) => (
                    <article className="account-reservation-card" key={reservation.reservation_id}>
                      <div><Badge tone={reservation.status === "confirmed" || reservation.status === "completed" ? "success" : reservation.status === "cancelled" ? "danger" : "warning"}>{reservation.status}</Badge><h2>{reservation.business_name}</h2><p>{reservation.court_name} · {reservation.sport_name}</p></div>
                      <dl><div><dt>Inicio</dt><dd>{formatReservationDate(reservation.start_at)}</dd></div><div><dt>Total</dt><dd>{formatMoney(Number(reservation.total_amount), reservation.currency)}</dd></div></dl>
                      <div className="account-reservation-actions">
                        <Link href={`/complejo/${encodeURIComponent(reservation.business_slug)}`}>Ver complejo →</Link>
                        {paymentsByReservation.get(reservation.reservation_id) ? (
                          <div className="payment-status-pill">
                            <small>{paymentMethodLabel(paymentsByReservation.get(reservation.reservation_id)!.method)}</small>
                            <strong>{paymentStatusLabel(paymentsByReservation.get(reservation.reservation_id)!.status)}</strong>
                          </div>
                        ) : reservation.status !== "cancelled" ? (
                          <PaymentReportForm reservationId={reservation.reservation_id} methods={methodsByBusiness[reservation.business_slug] ?? []} />
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <PlatformFooter />
    </div>
  );
}
