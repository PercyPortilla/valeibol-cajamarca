import type { AdminReservation } from "../../admin/reservations.ts";
import type {
  AdminReservationCursor,
  AdminReservationRepository,
  AdminReservationView,
} from "./adminReservationRepository.ts";
import { getLocalAdminState } from "../localAdminStore.ts";

function matchesView(item: AdminReservation, view: AdminReservationView) {
  if (view === "active") return item.archivedAt === null && (item.status === "pending" || item.status === "confirmed");
  if (view === "completed") return item.archivedAt === null && item.status === "completed";
  if (view === "cancelled") return item.archivedAt === null && item.status === "cancelled";
  return item.archivedAt !== null;
}

function compareReservationDesc(a: AdminReservation, b: AdminReservation) {
  return b.startAt.localeCompare(a.startAt)
    || b.createdAt.localeCompare(a.createdAt)
    || b.id.localeCompare(a.id);
}

function isAfterCursor(item: AdminReservation, cursor: AdminReservationCursor) {
  if (item.startAt !== cursor.startAt) return item.startAt < cursor.startAt;
  if (item.createdAt !== cursor.createdAt) return item.createdAt < cursor.createdAt;
  return item.id < cursor.id;
}

export class LocalAdminReservationRepository implements AdminReservationRepository {
  async list(limit = 100, includeArchived = false) {
    return getLocalAdminState().reservations
      .filter((item) => includeArchived || item.archivedAt === null)
      .slice()
      .sort((a, b) => b.startAt.localeCompare(a.startAt))
      .slice(0, Math.max(1, Math.min(limit, 200)));
  }

  async listPage(options: {
    view: AdminReservationView;
    limit?: number;
    cursor?: AdminReservationCursor | null;
  }) {
    const limit = Math.max(1, Math.min(options.limit ?? 40, 100));
    const cursor = options.cursor ?? null;
    const rows = getLocalAdminState().reservations
      .filter((item) => matchesView(item, options.view))
      .slice()
      .sort(compareReservationDesc)
      .filter((item) => !cursor || isAfterCursor(item, cursor));
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor: rows.length > limit && last
        ? { startAt: last.startAt, createdAt: last.createdAt, id: last.id }
        : null,
    };
  }
}
