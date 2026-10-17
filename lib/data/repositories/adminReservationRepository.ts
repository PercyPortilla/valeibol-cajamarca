import type { AdminReservation } from "@/lib/admin/reservations";

export interface AdminReservationRepository {
  list(limit?: number, includeArchived?: boolean): Promise<AdminReservation[]>;
}

export class AdminReservationRepositoryError extends Error {
  constructor(
    public readonly code: "unauthorized" | "network" | "unknown",
    message: string,
  ) {
    super(message);
    this.name = "AdminReservationRepositoryError";
  }
}
