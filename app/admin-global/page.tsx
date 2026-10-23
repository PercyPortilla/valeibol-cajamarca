import Link from "next/link";
import { PlatformAdminBusinessList, type PlatformAdminBusiness } from "@/components/platform-admin/PlatformAdminBusinessList";
import { CustomerLogoutButton } from "@/components/account/CustomerLogoutButton";
import { requirePlatformAdminContext } from "@/lib/auth/platformAdmin";
import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import type { Database } from "@/lib/data/supabase/database.types";

function toNumber(value: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function PlatformAdminPage() {
  const context = await requirePlatformAdminContext();
  const client = await createServerSupabaseClient();
  const [summaryResult, businessesResult] = await Promise.all([
    client.rpc("get_platform_admin_summary"),
    client.rpc("get_platform_admin_businesses", { p_limit: 200 }),
  ]);

  if (summaryResult.error || businessesResult.error) {
    throw new Error("No pudimos cargar el panel administrativo global.");
  }

  type SummaryRow = Database["public"]["Functions"]["get_platform_admin_summary"]["Returns"][number];
  type BusinessRow = Database["public"]["Functions"]["get_platform_admin_businesses"]["Returns"][number];
  const summary = (summaryResult.data as SummaryRow[] | null)?.[0];
  const businesses: PlatformAdminBusiness[] = ((businessesResult.data ?? []) as BusinessRow[]).map((row) => ({
    businessId: row.business_id,
    slug: row.slug,
    name: row.name,
    city: row.city,
    country: row.country,
    isActive: row.is_active,
    ownerUserId: row.owner_user_id,
    venueCount: toNumber(row.venue_count),
    courtCount: toNumber(row.court_count),
    reservationCount: toNumber(row.reservation_count),
  }));

  return (
    <main className="global-admin-page">
      <div className="shell global-admin-shell">
        <header className="global-admin-header">
          <div>
            <span className="eyebrow">ADMINISTRACIÓN GLOBAL</span>
            <h1>Control de plataforma</h1>
            <p>Vista cross-tenant reservada al rol ADMIN global. No es el panel operativo de una cancha.</p>
          </div>
          <div className="global-admin-account">
            <div><small>Sesión global</small><strong>{context.displayName ?? context.email ?? "Administrador"}</strong></div>
            <CustomerLogoutButton />
          </div>
        </header>

        <nav className="global-admin-links" aria-label="Navegación global">
          <Link href="/buscar">Ver plataforma pública</Link>
          <Link href="/admin">Panel de negocio</Link>
        </nav>

        <section className="global-admin-metrics" aria-label="Métricas globales">
          <article><span>Negocios activos</span><strong>{summary ? toNumber(summary.businesses_active) : 0}</strong><small>de {summary ? toNumber(summary.businesses_total) : 0}</small></article>
          <article><span>Sedes activas</span><strong>{summary ? toNumber(summary.venues_active) : 0}</strong></article>
          <article><span>Canchas activas</span><strong>{summary ? toNumber(summary.courts_active) : 0}</strong></article>
          <article><span>Usuarios</span><strong>{summary ? toNumber(summary.users_total) : 0}</strong></article>
          <article><span>Reservas</span><strong>{summary ? toNumber(summary.reservations_total) : 0}</strong></article>
          <article><span>Reportes de pago</span><strong>{summary ? toNumber(summary.payment_reports_total) : 0}</strong></article>
        </section>

        <PlatformAdminBusinessList businesses={businesses} />

        <p className="global-admin-footnote">El rol ADMIN global no se asigna automáticamente a administradores de negocios. Su alta requiere una acción privilegiada explícita fuera del cliente.</p>
      </div>
    </main>
  );
}
