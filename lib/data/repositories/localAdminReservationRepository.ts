import type { AdminReservationRepository } from "./adminReservationRepository.ts";
import { getLocalAdminState } from "../localAdminStore.ts";

export class LocalAdminReservationRepository implements AdminReservationRepository {
  async list(limit = 100) {
    return getLocalAdminState().reservations
      .slice()
      .sort((a, b) => b.startAt.localeCompare(a.startAt))
      .slice(0, Math.max(1, Math.min(limit, 200)));
  }
}
