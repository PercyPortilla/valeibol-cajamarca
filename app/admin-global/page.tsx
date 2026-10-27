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

export default async function PlatformAdminPage({ searchParams }: { searchParams: Promise<{ page?: string; reviewStatus?: string; reviewPage?: string }> }) {
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

  return (
    <main className="global-admin-page">
      <div className="shell global-admin-shell">
        <header className="global-admin-header">
          <div>
            <span className="eyebrow">CAXAS SPORT CENTER · ADMINISTRACIÓN PRINCIPAL</span>
            <h1>Control de la plataforma</h1>
            <p>Vista reservada al equipo ADMIN global de Caxas Sport Center. Desde aquí puedes supervisar la plataforma y entrar al panel operativo de cualquier negocio mediante selección explícita.</p>
          </div>
          <div className="global-admin-account">
            <div><small>Sesión global</small><strong>{context.displayName ?? context.email ?? "Administrador"}</strong></div>
            <CustomerLogoutButton />
          </div>
        </header>

        <nav className="global-admin-links" aria-label="Navegación global">
          <Link href="/buscar">Ver plataforma pública</Link>
          <span>Selecciona “Administrar negocio” para entrar al panel operativo de una cancha o complejo.</span>
        </nav>

        <section className="global-admin-metrics" aria-label="Métricas globales">
          <article><span>Negocios activos</span><strong>{summary ? toNumber(summary.businesses_active) : 0}</strong><small>de {summary ? toNumber(summary.businesses_total) : 0}</small></article>
          <article><span>Sedes activas</span><strong>{summary ? toNumber(summary.venues_active) : 0}</strong></article>
          <article><span>Canchas activas</span><strong>{summary ? toNumber(summary.courts_active) : 0}</strong></article>
          <article><span>Usuarios</span><strong>{summary ? toNumber(summary.users_total) : 0}</strong></article>
          <article><span>Reservas</span><strong>{summary ? toNumber(summary.reservations_total) : 0}</strong></article>
        </section>

        <PlatformAdminBusinessOnboarding />

        <PlatformAdminSportManagement sports={platformSports} loadFailed={Boolean(sportsResult.error)} />

        <PlatformAdminReviewModeration
          reviews={reviews}
          status={reviewStatus}
          currentPage={reviewPage}
          hasNext={reviewHasNext}
          loadFailed={Boolean(reviewsResult.error)}
          businessPage={page}
        />

        <PlatformAdminBusinessList
          businesses={businesses}
          totalBusinesses={totalBusinesses}
          currentPage={page}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
        />

        <p className="global-admin-footnote">Los dueños y administradores de negocio nunca reciben esta vista principal por su rol tenant. Solo las cuentas ADMIN globales autorizadas de Caxas Sport Center pueden verla y supervisar negocios mediante selección explícita.</p>
      </div>
    </main>
  );
}
