import Link from "next/link";
import { notFound } from "next/navigation";
import { AvailabilityCalendar } from "@/components/availability/AvailabilityCalendar";
import { PlatformFooter } from "@/components/platform/PlatformFooter";
import { PlatformHeader } from "@/components/platform/PlatformHeader";
import { getPublicPlatformCatalog } from "@/lib/data/platformService";

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
      <div className="platform-page">
        <PlatformHeader />
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

  return (
    <div className="platform-page">
      <PlatformHeader />
      <main id="platform-main" tabIndex={-1}>
        <section className="platform-reservation-hero">
          <div className="shell">
            <span className="eyebrow">RESERVAR</span>
            <h1>{selectedCourt.businessName}</h1>
            <p>{selectedCourt.venueName} · {selectedCourt.courtName} · {selectedCourt.sportName}</p>
          </div>
        </section>
        <section className="platform-reservation-section">
          <div className="shell">
            <AvailabilityCalendar
              businessSlug={selectedCourt.businessSlug}
              initialCourtId={selectedCourt.courtId}
              courtSports={courtSports}
            />
          </div>
        </section>
      </main>
      <PlatformFooter />
    </div>
  );
}
