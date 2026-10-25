import { createServerSupabaseClient } from "./supabase/server.ts";
import type { Database } from "./supabase/database.types.ts";
import { parseInventorySports, parseInventoryVenues, type AdminBusinessStructure } from "../admin/inventory.ts";

export async function getAdminBusinessStructure(): Promise<AdminBusinessStructure> {
  const client = await createServerSupabaseClient();
  const [structureResult, bookingSettingsResult, readinessResult] = await Promise.all([
    client.rpc("get_admin_business_structure"),
    client.rpc("get_admin_booking_settings"),
    client.rpc("get_admin_publication_readiness"),
  ]);
  if (structureResult.error || bookingSettingsResult.error || readinessResult.error) throw new Error("inventory_load_failed");
  type Row = Database["public"]["Functions"]["get_admin_business_structure"]["Returns"][number];
  type BookingSettingsRow = Database["public"]["Functions"]["get_admin_booking_settings"]["Returns"][number];
  type ReadinessRow = Database["public"]["Functions"]["get_admin_publication_readiness"]["Returns"][number];
  const row = ((structureResult.data ?? []) as Row[])[0];
  const bookingSettings = ((bookingSettingsResult.data ?? []) as BookingSettingsRow[])[0];
  const readiness = ((readinessResult.data ?? []) as ReadinessRow[])[0];
  if (!row || !bookingSettings || !readiness) throw new Error("inventory_not_found");
  return {
    businessId: row.business_id,
    slug: row.business_slug,
    name: row.business_name,
    city: row.city,
    country: row.country,
    address: row.address,
    phone: row.phone,
    currency: row.currency,
    timezone: row.timezone,
    bookingIncrementMinutes: bookingSettings.booking_increment_minutes,
    configurationStatus: row.configuration_status,
    publicationReadiness: {
      hasActiveVenue: readiness.has_active_venue,
      hasActiveCourt: readiness.has_active_court,
      activeCourtsReady: readiness.active_courts_ready,
      activeCourtCount: Number(readiness.active_court_count),
    },
    sports: parseInventorySports(row.sports),
    venues: parseInventoryVenues(row.venues),
  };
}
