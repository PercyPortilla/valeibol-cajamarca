import type { AdminReservation } from "@/lib/admin/reservations";

export type AdminReservationView = "active" | "completed" | "cancelled" | "archived";

export type AdminReservationCursor = {
  startAt: string;
  createdAt: string;
  id: string;
};

export type AdminReservationPage = {
  items: AdminReservation[];
  nextCursor: AdminReservationCursor | null;
};

export interface AdminReservationRepository {
  list(limit?: number, includeArchived?: boolean): Promise<AdminReservation[]>;
  listPage(options: {
    view: AdminReservationView;
    limit?: number;
    cursor?: AdminReservationCursor | null;
  }): Promise<AdminReservationPage>;
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
