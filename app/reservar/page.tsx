import Link from "next/link";
import { notFound } from "next/navigation";
import { AvailabilityCalendar } from "@/components/availability/AvailabilityCalendar";
import { PlatformFooter } from "@/components/platform/PlatformFooter";
import { PlatformHeader } from "@/components/platform/PlatformHeader";
import { getPublicPlatformCatalog } from "@/lib/data/platformService";
import { getPublicBusinessContact } from "@/lib/data/publicBusinessContactService";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Consultar horarios por WhatsApp",
  robots: { index: false, follow: true },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ReservationPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const businessSlug = first(params.negocio).trim();
  const requestedCourtId = first(params.cancha).trim();

  if (!businessSlug) {
    return (
      <div className="platform-page platform-public-premium platform-public-premium--reservation">
        <PlatformHeader premium />
        <main className="platform-section" id="platform-main" tabIndex={-1}>
          <div className="shell platform-reservation-empty">
            <span className="eyebrow">RESERVAS</span>
            <h1>Primero elige un complejo y una cancha</h1>
            <p>La disponibilidad y las tarifas pertenecen a cada negocio. Busca una cancha para continuar.</p>
            <Link className="button button--primary" href="/buscar">Buscar canchas</Link>
          </div>
        </main>
        <PlatformFooter />
      </div>
    );
  }

  const catalog = await getPublicPlatformCatalog({ businessSlug });
  if (catalog.length === 0) notFound();

  const selectedCourt = requestedCourtId
    ? catalog.find((item) => item.courtId === requestedCourtId)
    : catalog[0];
  if (!selectedCourt) notFound();

  const courtSports = Object.fromEntries(catalog.map((item) => [item.courtId, item.sportSlug]));
  const publicContact = await getPublicBusinessContact(selectedCourt.businessSlug);

  return (
    <div className="platform-page platform-public-premium platform-public-premium--reservation">
      <PlatformHeader premium />
      <main id="platform-main" tabIndex={-1}>
        <section className="platform-reservation-hero">
          <div className="shell platform-reservation-hero__grid">
            <div className="platform-reservation-hero__copy">
              <nav aria-label="Volver al complejo" className="platform-reservation-back">
                <Link href={`/complejo/${encodeURIComponent(selectedCourt.businessSlug)}`}>← Volver al complejo</Link>
              </nav>
              <span className="eyebrow">CONSULTA POR WHATSAPP</span>
              <h1>Encuentra el momento para jugar.</h1>
              <p className="platform-reservation-hero__lead">{selectedCourt.businessName}</p>
              <p>{selectedCourt.venueName} · {selectedCourt.courtName} · {selectedCourt.sportName}</p>
              <p>Consulta los bloques horarios y coordina directamente con el negocio. No necesitas crear una cuenta.</p>
            </div>
            <aside className="platform-reservation-process" aria-label="Cómo consultar tu horario">
              <span>ASÍ FUNCIONA</span>
              <ol>
                <li><b>01</b><div><strong>Explora</strong><small>Elige la fecha y la cancha.</small></div></li>
                <li><b>02</b><div><strong>Consulta</strong><small>Selecciona un bloque con opción de contacto.</small></div></li>
                <li><b>03</b><div><strong>Confirma</strong><small>El negocio confirma horario y tarifa por WhatsApp.</small></div></li>
              </ol>
            </aside>
          </div>
        </section>
        <section className="platform-reservation-section">
          <div className="shell">
            <div className="platform-reservation-section__heading">
              <span className="eyebrow">AGENDA DEL COMPLEJO</span>
              <h2>Consulta tu horario</h2>
              <p>La disponibilidad puede cambiar. Abrir WhatsApp inicia una conversación, no crea una reserva automáticamente.</p>
            </div>
            <AvailabilityCalendar
              businessSlug={selectedCourt.businessSlug}
              businessName={selectedCourt.businessName}
              businessTimezone={selectedCourt.businessTimezone}
              initialCourtId={selectedCourt.courtId}
              courtSports={courtSports}
              contactPhoneE164={publicContact.phoneE164}
            />
          </div>
        </section>
      </main>
      <PlatformFooter />
    </div>
  );
}
