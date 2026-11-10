import Link from "next/link";
import { PlatformAdminBusinessList, type PlatformAdminBusiness } from "@/components/platform-admin/PlatformAdminBusinessList";
import { CustomerLogoutButton } from "@/components/account/CustomerLogoutButton";
import { requirePlatformAdminContext } from "@/lib/auth/platformAdmin";
import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import type { Database, ReviewModerationStatus } from "@/lib/data/supabase/database.types";
import type { Metadata } from "next";
import { PlatformAdminReviewModeration, type PlatformAdminReview } from "@/components/platform-admin/PlatformAdminReviewModeration";
import { PlatformAdminBusinessOnboarding } from "@/components/platform-admin/PlatformAdminBusinessOnboarding";
import { PlatformAdminSportManagement, type PlatformAdminSport } from "@/components/platform-admin/PlatformAdminSportManagement";
import { GlobalAdminMetricIcon } from "@/components/platform-admin/GlobalAdminMetricIcon";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Administración principal · Caxas SportCenter",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 25;
const REVIEW_PAGE_SIZE = 25;

function toNumber(value: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toPage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function toReviewStatus(value: string | undefined): ReviewModerationStatus {
  return value === "published" || value === "rejected" || value === "hidden" ? value : "pending";
}

export default async function PlatformAdminPage({ searchParams }: { searchParams: Promise<{ page?: string; reviewStatus?: string; reviewPage?: string; selectionError?: string }> }) {
  const context = await requirePlatformAdminContext();
  const client = await createServerSupabaseClient();
  const params = await searchParams;
  const reviewStatus = toReviewStatus(params.reviewStatus);
  const reviewPage = toPage(params.reviewPage);
  const [summaryResult, reviewsResult, sportsResult] = await Promise.all([
    client.rpc("get_platform_admin_summary"),
    client.rpc("get_platform_admin_reviews_page", {
      p_status: reviewStatus,
      p_limit: REVIEW_PAGE_SIZE + 1,
      p_offset: (reviewPage - 1) * REVIEW_PAGE_SIZE,
    }),
    client.rpc("get_platform_admin_sports"),
  ]);

  if (summaryResult.error) {
    throw new Error("No pudimos cargar el panel administrativo global.");
  }

  type SummaryRow = Database["public"]["Functions"]["get_platform_admin_summary"]["Returns"][number];
  const summary = (summaryResult.data as SummaryRow[] | null)?.[0];
  const totalBusinesses = summary ? toNumber(summary.businesses_total) : 0;
  const totalPages = Math.max(1, Math.ceil(totalBusinesses / PAGE_SIZE));
  const page = Math.min(toPage(params.page), totalPages);
  const businessesResult = await client.rpc("get_platform_admin_businesses_page", {
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });

  if (businessesResult.error) {
    throw new Error("No pudimos cargar los negocios de la administración global.");
  }

  type BusinessRow = Database["public"]["Functions"]["get_platform_admin_businesses_page"]["Returns"][number];
  const businesses: PlatformAdminBusiness[] = ((businessesResult.data ?? []) as BusinessRow[]).map((row) => ({
    businessId: row.business_id,
    slug: row.slug,
    name: row.name,
    city: row.city,
    country: row.country,
    isActive: row.is_active,
    configurationStatus: row.configuration_status,
    currency: row.currency,
    timezone: row.timezone,
    venueCount: toNumber(row.venue_count),
    courtCount: toNumber(row.court_count),
    reservationCount: toNumber(row.reservation_count),
  }));
  const reviewRows = reviewsResult.error ? [] : (reviewsResult.data ?? []) as PlatformAdminReview[];
  const reviews = reviewRows.slice(0, REVIEW_PAGE_SIZE);
  const reviewHasNext = reviewRows.length > REVIEW_PAGE_SIZE;
  type SportRow = Database["public"]["Functions"]["get_platform_admin_sports"]["Returns"][number];
  const platformSports: PlatformAdminSport[] = sportsResult.error ? [] : ((sportsResult.data ?? []) as SportRow[]).map((row) => ({
    sportId: row.sport_id,
    slug: row.slug,
    name: row.name,
    icon: row.icon,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    activeCourtCount: toNumber(row.active_court_count),
    courtCount: toNumber(row.court_count),
  }));
  const businessesActive = summary ? toNumber(summary.businesses_active) : 0;
  const businessShare = totalBusinesses > 0 ? Math.round((businessesActive / totalBusinesses) * 100) : 0;
  const sportsByCourts = [...platformSports]
    .filter((item) => item.isActive)
    .sort((a, b) => b.activeCourtCount - a.activeCourtCount)
    .slice(0, 5);
  const sportBarMaximum = Math.max(1, ...sportsByCourts.map((item) => item.activeCourtCount));

  return (
    <main className="global-admin-page">
      <div className="shell global-admin-shell">
        <header className="global-admin-header">
          <div className="global-admin-header__copy">
            <div className="global-admin-header__statusline">
              <span className="eyebrow">CAXAS / COMMAND CENTER</span>
              <span className="global-admin-header__verified"><i aria-hidden="true" /> ACCESO GLOBAL VERIFICADO</span>
            </div>
            <h1>Control de la <span>plataforma.</span></h1>
            <p>Vista reservada al equipo ADMIN global de Caxas Sport Center. Supervisa negocios, canchas y actividad real desde un solo lugar; los accesos a cada negocio permanecen separados y protegidos.</p>
            <div className="global-admin-header__actions">
              <a href="#admin-negocios" className="global-admin-header__cta">Explorar negocios <span aria-hidden="true">↗</span></a>
              <a href="#admin-alta-negocio" className="global-admin-header__cta global-admin-header__cta--secondary">Crear negocio <span aria-hidden="true">+</span></a>
            </div>
          </div>
          <div className="global-admin-account">
            <div><small>Sesión global</small><strong>{context.displayName ?? context.email ?? "Administrador"}</strong></div>
            <CustomerLogoutButton />
          </div>
        </header>

        <nav className="global-admin-links" aria-label="Navegación global">
          <a href="#admin-overview" aria-label="Ir al resumen global">Resumen <span aria-hidden="true">↗</span></a>
          <a href="#admin-negocios">Negocios <span aria-hidden="true">↗</span></a>
          <a href="#admin-deportes">Deportes <span aria-hidden="true">↗</span></a>
          <a href="#admin-resenas">Reseñas <span aria-hidden="true">↗</span></a>
          <a href="#admin-alta-negocio">Nuevo negocio <span aria-hidden="true">+</span></a>
          <Link href="/buscar">Web pública <span aria-hidden="true">↗</span></Link>
        </nav>

        <section className="global-admin-overview" id="admin-overview" aria-labelledby="admin-overview-title">
          <div className="global-admin-overview__heading">
            <div>
              <span className="eyebrow">PULSO DE LA PLATAFORMA</span>
              <h2 id="admin-overview-title">Tu operación, en perspectiva.</h2>
            </div>
            <span className="global-admin-data-note">Datos reales · resumen de esta consulta</span>
          </div>
          <div className="global-admin-metrics" aria-label="Métricas globales">
            <article className="global-admin-metric">
              <div className="global-admin-metric__top"><span>Negocios activos</span><GlobalAdminMetricIcon kind="businesses" /></div>
              <strong>{businessesActive}</strong><small>de {totalBusinesses} registrados</small>
            </article>
            <article className="global-admin-metric">
              <div className="global-admin-metric__top"><span>Sedes activas</span><GlobalAdminMetricIcon kind="venues" /></div>
              <strong>{summary ? toNumber(summary.venues_active) : 0}</strong><small>En los complejos publicados</small>
            </article>
            <article className="global-admin-metric">
              <div className="global-admin-metric__top"><span>Canchas activas</span><GlobalAdminMetricIcon kind="courts" /></div>
              <strong>{summary ? toNumber(summary.courts_active) : 0}</strong><small>Del inventario operativo</small>
            </article>
            <article className="global-admin-metric">
              <div className="global-admin-metric__top"><span>Usuarios</span><GlobalAdminMetricIcon kind="users" /></div>
              <strong>{summary ? toNumber(summary.users_total) : 0}</strong><small>Total registrado</small>
            </article>
            <article className="global-admin-metric">
              <div className="global-admin-metric__top"><span>Reservas</span><GlobalAdminMetricIcon kind="reservations" /></div>
              <strong>{summary ? toNumber(summary.reservations_total) : 0}</strong><small>Total histórico registrado</small>
            </article>
          </div>
          <div className="global-admin-command-grid">
            <section className="global-admin-command-panel global-admin-command-panel--pulse" aria-labelledby="admin-business-health-title">
              <span className="eyebrow">ESTADO DEL CATÁLOGO</span>
              <h3 id="admin-business-health-title">Negocios en operación</h3>
              <div className="global-admin-activation">
                <strong>{businessShare}<small>%</small></strong>
                <span>de negocios activos</span>
              </div>
              <div className="global-admin-progress" role="progressbar" aria-label="Proporción de negocios activos" aria-valuemin={0} aria-valuemax={100} aria-valuenow={businessShare}>
                <span style={{ width: `${businessShare}%` }} />
              </div>
              <p>{totalBusinesses === 0 ? "Todavía no hay negocios registrados." : `${businessesActive} de ${totalBusinesses} negocios figuran activos en la plataforma.`}</p>
              <a href="#admin-negocios">Gestionar negocios <span aria-hidden="true">↗</span></a>
            </section>
            <section className="global-admin-command-panel global-admin-command-panel--sports" aria-labelledby="admin-sport-chart-title">
              <span className="eyebrow">INVENTARIO POR DISCIPLINA</span>
              <h3 id="admin-sport-chart-title">Canchas habilitadas</h3>
              {sportsResult.error ? (
                <p role="alert">No fue posible cargar los datos deportivos para esta visualización.</p>
              ) : sportsByCourts.length === 0 ? (
                <p>No hay disciplinas activas registradas todavía.</p>
              ) : (
                <div className="global-admin-sport-bars">
                  {sportsByCourts.map((sport) => (
                    <div className="global-admin-sport-bar" key={sport.sportId}>
                      <div><span>{sport.name}</span><strong>{sport.activeCourtCount}</strong></div>
                      <div className="global-admin-sport-bar__track" aria-hidden="true">
                        <span style={{ width: `${(sport.activeCourtCount / sportBarMaximum) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p>Cuenta canchas marcadas como activas por deporte; no representa disponibilidad en tiempo real.</p>
            </section>
            <section className="global-admin-command-panel global-admin-command-panel--actions" aria-labelledby="admin-quick-title">
              <span className="eyebrow">ACCESOS DIRECTOS</span>
              <h3 id="admin-quick-title">Centro de acciones</h3>
              <a href="#admin-alta-negocio"><span>01</span><strong>Incorporar negocio</strong><b aria-hidden="true">↗</b></a>
              <a href="#admin-negocios"><span>02</span><strong>Administrar complejos</strong><b aria-hidden="true">↗</b></a>
              <a href="#admin-resenas"><span>03</span><strong>Revisar reseñas</strong><b aria-hidden="true">↗</b></a>
              <a href="#admin-deportes"><span>04</span><strong>Editar deportes</strong><b aria-hidden="true">↗</b></a>
            </section>
          </div>
        </section>

        <div className="global-admin-section-anchor" id="admin-negocios">
          {params.selectionError === "scope" ? (
            <p role="alert" className="auth-error">SC-02: El servidor validó tu sesión global, pero Supabase no confirmó el acceso al negocio seleccionado. No se modificaron roles ni permisos. Comunica este código para completar el diagnóstico.</p>
          ) : null}
          <PlatformAdminBusinessList
            businesses={businesses}
            totalBusinesses={totalBusinesses}
            currentPage={page}
            totalPages={totalPages}
            pageSize={PAGE_SIZE}
          />
        </div>
        <div className="global-admin-section-anchor" id="admin-alta-negocio"><PlatformAdminBusinessOnboarding /></div>
        <div className="global-admin-section-anchor" id="admin-deportes"><PlatformAdminSportManagement sports={platformSports} loadFailed={Boolean(sportsResult.error)} /></div>
        <div className="global-admin-section-anchor" id="admin-resenas"><PlatformAdminReviewModeration
          reviews={reviews}
          status={reviewStatus}
          currentPage={reviewPage}
          hasNext={reviewHasNext}
          loadFailed={Boolean(reviewsResult.error)}
          businessPage={page}
        /></div>

        <p className="global-admin-footnote">Los dueños y administradores de negocio nunca reciben esta vista principal por su rol tenant. Solo las cuentas ADMIN globales autorizadas de Caxas Sport Center pueden verla y supervisar negocios mediante selección explícita.</p>
      </div>
    </main>
  );
}
