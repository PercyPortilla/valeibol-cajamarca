import Link from "next/link";
import { CustomerAuthForm } from "@/components/account/CustomerAuthForm";
import { CustomerLogoutButton } from "@/components/account/CustomerLogoutButton";
import { PlatformFooter } from "@/components/platform/PlatformFooter";
import { PlatformHeader } from "@/components/platform/PlatformHeader";
import { Badge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/booking";
import { createServerSupabaseClient, hasPublicSupabaseServerConfig } from "@/lib/data/supabase/server";
import type { Database } from "@/lib/data/supabase/database.types";

export const dynamic = "force-dynamic";

type CustomerReservation = Database["public"]["Functions"]["get_my_reservations"]["Returns"][number];

function formatReservationDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "America/Lima" }).format(new Date(value));
}

function formatReservationTime(value: string) {
  return new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Lima" }).format(new Date(value));
}

function reservationStatusMeta(status: CustomerReservation["status"]) {
  if (status === "confirmed") return { label: "Confirmada", tone: "success" as const, detail: "El negocio confirmó tu reserva." };
  if (status === "completed") return { label: "Completada", tone: "info" as const, detail: "La reserva ya finalizó." };
  if (status === "cancelled") return { label: "Cancelada", tone: "danger" as const, detail: "Esta reserva fue cancelada." };
  return { label: "Pendiente", tone: "warning" as const, detail: "Esperando confirmación del negocio." };
}

function reservationMode(reservation: CustomerReservation) {
  const lighting = reservation.lighting === "with_lights" ? "Con luz" : "Sin luz";
  return reservation.net_height_cm === null ? lighting : `${lighting} · Red ${reservation.net_height_cm} cm`;
}

export default async function CustomerAccountPage() {
  let userEmail: string | null = null;
  let reservations: Database["public"]["Functions"]["get_my_reservations"]["Returns"] = [];
  let historyLoadFailed = false;

  if (hasPublicSupabaseServerConfig()) {
    try {
      const supabase = await createServerSupabaseClient();
      const { data } = await supabase.auth.getUser();
      userEmail = data.user?.email ?? null;
      if (data.user) {
        const { data: history, error } = await supabase.rpc("get_my_reservations");
        if (error) historyLoadFailed = true;
        else reservations = history ?? [];
      }
    } catch {
      userEmail = null;
    }
  }

  return (
    <div className="platform-page">
      <PlatformHeader />
      <main className="account-page" id="platform-main" tabIndex={-1}>
        <div className="shell account-page__inner">
          <header className="account-page__heading">
            <span className="eyebrow">MI CUENTA</span>
            <h1>Mi cuenta</h1>
            <p>{userEmail ? "Consulta tus reservas y su estado. Las coordinaciones adicionales se realizan directamente con el negocio por WhatsApp." : "Inicia sesión o crea una cuenta para conservar el historial de las reservas que hagas con tu sesión activa."}</p>
          </header>

          {!userEmail ? <CustomerAuthForm /> : (
            <>
              <div className="account-user-bar">
                <div><small>Sesión iniciada</small><strong>{userEmail}</strong></div>
                <div className="account-user-actions"><Link className="button button--secondary" href="/buscar">Buscar cancha</Link><CustomerLogoutButton /></div>
              </div>
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
                      const status = reservationStatusMeta(reservation.status);
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
                          <div className="account-reservation-actions"><Link href={`/complejo/${encodeURIComponent(reservation.business_slug)}`}>Ver complejo →</Link></div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
      <PlatformFooter />
    </div>
  );
}
