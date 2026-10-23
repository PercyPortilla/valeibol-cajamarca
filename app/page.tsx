import Link from "next/link";
import { PlatformFooter } from "@/components/platform/PlatformFooter";
import { PlatformHeader } from "@/components/platform/PlatformHeader";
import { PlatformResults } from "@/components/platform/PlatformResults";
import { PlatformSearchForm } from "@/components/platform/PlatformSearchForm";
import { sports } from "@/config/sports";
import { getPublicPlatformCatalog } from "@/lib/data/platformService";
import { groupCatalogByBusiness } from "@/lib/data/repositories/platformRepository";

export default async function PlatformHomePage() {
  const catalog = await getPublicPlatformCatalog();
  const businesses = groupCatalogByBusiness(catalog).slice(0, 6);

  return (
    <div className="platform-page platform-home">
      <PlatformHeader />
      <main id="platform-main" tabIndex={-1}>
        <section className="platform-home-hero">
          <div className="shell platform-home-hero__grid">
            <div className="platform-home-hero__copy">
              <span className="eyebrow">CANCHAS Y COMPLEJOS DEPORTIVOS</span>
              <h1>Encuentra dónde jugar. Reserva desde un solo lugar.</h1>
              <p>Explora negocios deportivos, sedes y canchas por ciudad y deporte. Valeibol Cajamarca es el primer complejo integrado a la plataforma.</p>
              <PlatformSearchForm />
            </div>
            <aside className="platform-home-hero__aside" aria-label="Cómo funciona">
              <span>01</span><strong>Busca</strong><p>Filtra por deporte y ciudad.</p>
              <span>02</span><strong>Compara</strong><p>Revisa sedes, canchas y precios.</p>
              <span>03</span><strong>Reserva</strong><p>Consulta disponibilidad real del negocio.</p>
            </aside>
          </div>
        </section>

        <section className="platform-section platform-home-sports">
          <div className="shell">
            <div className="platform-section__heading">
              <div><span className="eyebrow">DEPORTES</span><h2>¿Qué quieres jugar?</h2></div>
              <Link className="text-link" href="/buscar">Ver todas las canchas →</Link>
            </div>
            <div className="platform-sport-grid">
              {sports.filter((sport) => sport.active).map((sport) => (
                <Link className="platform-sport-card" key={sport.id} href={sport.slug === "voley" ? "/voley" : sport.slug === "futbol" ? "/futbol" : `/buscar?deporte=${sport.slug}`}>
                  <span>{sport.name.slice(0, 1)}</span>
                  <div><strong>{sport.name}</strong><small>Explorar canchas</small></div>
                  <b aria-hidden="true">→</b>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="platform-section platform-home-featured">
          <div className="shell">
            <div className="platform-section__heading">
              <div><span className="eyebrow">COMPLEJOS</span><h2>Complejos disponibles</h2><p>La oferta crecerá a medida que se incorporen nuevos negocios deportivos.</p></div>
            </div>
            <PlatformResults businesses={businesses} />
          </div>
        </section>

        <section className="platform-home-owner">
          <div className="shell platform-home-owner__inner">
            <div><span className="eyebrow">PARA PROPIETARIOS</span><h2>Administra reservas, precios y operación desde un solo panel.</h2><p>La misma plataforma pública se conecta con las herramientas operativas de cada negocio.</p></div>
            <Link className="button button--primary" href="/propietario">Ir al panel propietario</Link>
          </div>
        </section>
      </main>
      <PlatformFooter />
    </div>
  );
}
