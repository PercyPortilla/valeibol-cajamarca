import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import type { Database } from "@/lib/data/supabase/database.types";
import {
  AdminReservationRepositoryError,
  type AdminReservationRepository,
} from "./adminReservationRepository";
import type { AdminReservation } from "@/lib/admin/reservations";

function toNumber(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

export class SupabaseAdminReservationRepository implements AdminReservationRepository {
  async list(limit = 100): Promise<AdminReservation[]> {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("get_admin_reservation_requests", {
      p_limit: Math.max(1, Math.min(limit, 200)),
    });

    if (error) {
      const normalized = error.message.toLowerCase();
      if (error.code === "42501" || normalized.includes("authentication") || normalized.includes("profile")) {
        throw new AdminReservationRepositoryError("unauthorized", "No tienes permiso para ver estas solicitudes.");
      }
      if (normalized.includes("fetch") || normalized.includes("network")) {
        throw new AdminReservationRepositoryError("network", "No pudimos conectar con Supabase.");
      }
      throw new AdminReservationRepositoryError("unknown", "No pudimos cargar las solicitudes.");
    }

    type Row = Database["public"]["Functions"]["get_admin_reservation_requests"]["Returns"][number];
    return ((data ?? []) as Row[]).map((row) => ({
      id: row.reservation_id,
      businessId: row.business_id,
      courtId: row.court_id,
      courtName: row.court_name,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerPhoneE164: row.customer_phone_e164,
      startAt: row.start_at,
      endAt: row.end_at,
      status: row.status,
      lighting: row.lighting,
      netHeightCm: row.net_height_cm,
      hourlyRate: toNumber(row.hourly_rate),
      totalAmount: toNumber(row.total_amount),
      currency: row.currency,
      source: row.source,
      createdAt: row.created_at,
    }));
  }
}
