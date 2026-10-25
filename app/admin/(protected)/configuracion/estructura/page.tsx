import Link from "next/link";
import { AdminBusinessStructureManager } from "@/components/admin/AdminBusinessStructureManager";
import { Badge } from "@/components/ui/Badge";
import { businessConfig } from "@/config/business";
import { sports } from "@/config/sports";
import { requireAdminContext } from "@/lib/auth/server";
import { isLocalDevAdminUserId } from "@/lib/auth/localDev";
import type { AdminBusinessStructure } from "@/lib/admin/inventory";
import { DEMO_BUSINESS_ID, DEMO_COURT_ID, DEMO_COURT_NAME, DEMO_VENUE_ID } from "@/lib/data/demoPlatform";
import { getAdminBusinessStructure } from "@/lib/data/inventoryService";
import { businessTodayDateKey } from "@/lib/availability";

const localWeek = [
  [1, businessConfig.availability.weeklySchedule.monday],
  [2, businessConfig.availability.weeklySchedule.tuesday],
  [3, businessConfig.availability.weeklySchedule.wednesday],
  [4, businessConfig.availability.weeklySchedule.thursday],
  [5, businessConfig.availability.weeklySchedule.friday],
  [6, businessConfig.availability.weeklySchedule.saturday],
  [7, businessConfig.availability.weeklySchedule.sunday],
] as const;

function localStructure(): AdminBusinessStructure {
  return {
    businessId: DEMO_BUSINESS_ID, slug: businessConfig.slug, name: businessConfig.name, city: businessConfig.city,
    country: businessConfig.country, address: businessConfig.address, phone: businessConfig.phone, currency: businessConfig.currency,
    timezone: businessConfig.timezone, bookingIncrementMinutes: businessConfig.availability.slotMinutes, configurationStatus: "provisional",
    publicationReadiness: { hasActiveVenue: true, hasActiveCourt: true, activeCourtsReady: true, activeCourtCount: 1 },
    sports: sports.filter((sport) => sport.active).map((sport) => ({ sportId: sport.id, slug: sport.slug, name: sport.name })),
    venues: [{ venueId: DEMO_VENUE_ID, slug: "sede-principal", name: `${businessConfig.name} ${businessConfig.city}`, city: businessConfig.city, address: businessConfig.address, latitude: null, longitude: null, isActive: true,
      courts: [{
        courtId: DEMO_COURT_ID, slug: "cancha-demo", name: DEMO_COURT_NAME, surface: "Cancha cubierta",
        sportId: sports[0].id, sportSlug: sports[0].slug, sportName: sports[0].name, isActive: true,
        hoursConfigured: true, pricingConfigured: true,
        operatingHours: localWeek.map(([weekday, schedule]) => ({
          weekday,
          isOpen: schedule.enabled,
          opensAt: schedule.enabled ? schedule.opensAt : null,
          closesAt: schedule.enabled ? schedule.closesAt : null,
          effectiveFrom: "1970-01-01",
          effectiveUntil: null,
          configurationStatus: "provisional" as const,
        })),
      }] }],
  };
}

export default async function AdminStructurePage() {
  const context = await requireAdminContext();
  const localMode = isLocalDevAdminUserId(context.userId);
  let structure: AdminBusinessStructure;
  try { structure = localMode ? localStructure() : await getAdminBusinessStructure(); }
  catch { return <div className="state-box state-box--error" role="alert"><strong>No pudimos cargar la estructura del negocio.</strong><span>Recarga la página antes de realizar cambios.</span></div>; }
  const canManage = context.role === "owner" || context.role === "admin";
  const businessToday = businessTodayDateKey(new Date(), context.timezone);
  return <><header className="admin-topbar"><div><span className="eyebrow">CONFIGURACIÓN · ESTRUCTURA</span><h1>Negocio, sedes y canchas</h1><p className="admin-subtitle">Gestiona el inventario real de {context.businessName} sin editar la base de datos manualmente.</p></div><Badge tone={canManage ? "success" : "neutral"}>{canManage ? "Puede editar" : "Solo lectura"}</Badge></header><div className="admin-config-actions"><Link className="button button--ghost" href="/admin/configuracion">← Configuración</Link><Link className="button button--secondary" href="/admin/precios">Tarifas</Link></div><AdminBusinessStructureManager structure={structure} businessToday={businessToday} canManage={canManage} localMode={localMode} /></>;
}
