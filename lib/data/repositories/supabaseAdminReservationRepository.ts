import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import type { Database } from "@/lib/data/supabase/database.types";
import {
  AdminReservationRepositoryError,
  type AdminReservationCursor,
  type AdminReservationPage,
  type AdminReservationRepository,
  type AdminReservationView,
} from "./adminReservationRepository";
import type { AdminReservation } from "@/lib/admin/reservations";

function toNumber(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

function mapReservationRow(row: Database["public"]["Functions"]["get_admin_reservation_requests"]["Returns"][number]): AdminReservation {
  return {
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
    archivedAt: row.archived_at,
  };
}

function throwRepositoryError(error: { code?: string; message: string }): never {
  const normalized = error.message.toLowerCase();
  if (error.code === "42501" || normalized.includes("authentication") || normalized.includes("profile")) {
    throw new AdminReservationRepositoryError("unauthorized", "No tienes permiso para ver estas solicitudes.");
  }
  if (normalized.includes("fetch") || normalized.includes("network")) {
    throw new AdminReservationRepositoryError("network", "No pudimos conectar con Supabase.");
  }
  throw new AdminReservationRepositoryError("unknown", "No pudimos cargar las solicitudes.");
}

export class SupabaseAdminReservationRepository implements AdminReservationRepository {
  async list(limit = 100, includeArchived = false): Promise<AdminReservation[]> {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("get_admin_reservation_requests", {
      p_limit: Math.max(1, Math.min(limit, 200)),
      p_include_archived: includeArchived,
    });

    if (error) throwRepositoryError(error);

    type Row = Database["public"]["Functions"]["get_admin_reservation_requests"]["Returns"][number];
    return ((data ?? []) as Row[]).map(mapReservationRow);
  }

  async listPage(options: {
    view: AdminReservationView;
    limit?: number;
    cursor?: AdminReservationCursor | null;
  }): Promise<AdminReservationPage> {
    const client = await createServerSupabaseClient();
    const limit = Math.max(1, Math.min(options.limit ?? 40, 100));
    const cursor = options.cursor ?? null;
    const { data, error } = await client.rpc("get_admin_reservations_page", {
      p_view: options.view,
      p_limit: limit + 1,
      p_cursor_start_at: cursor?.startAt ?? null,
      p_cursor_created_at: cursor?.createdAt ?? null,
      p_cursor_id: cursor?.id ?? null,
    });

    if (error) throwRepositoryError(error);

    type Row = Database["public"]["Functions"]["get_admin_reservations_page"]["Returns"][number];
    const mapped = ((data ?? []) as Row[]).map((row) => mapReservationRow(row));
    const items = mapped.slice(0, limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor: mapped.length > limit && last
        ? { startAt: last.startAt, createdAt: last.createdAt, id: last.id }
        : null,
    };
  }
}
