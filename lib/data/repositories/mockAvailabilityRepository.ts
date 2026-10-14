import { businessConfig } from "@/config/business";
import {
  buildCalendarDays,
  type AvailabilityWeekSnapshot,
} from "@/lib/availability";
import type {
  AvailabilityRepository,
  AvailabilityWeekQuery,
} from "./availabilityRepository";

export class MockAvailabilityRepository implements AvailabilityRepository {
  async getWeek(query: AvailabilityWeekQuery): Promise<AvailabilityWeekSnapshot> {
    return {
      businessId: null,
      source: "mock-provisional",
      sourceLabel: "Modo demostración · Supabase no configurado",
      isProvisional: true,
      courts: [
        {
          courtId: "mock-court",
          courtName: "Cancha demo (provisional)",
          timezone: businessConfig.timezone,
          days: buildCalendarDays(query.referenceDateKey, query.todayDateKey),
        },
      ],
    };
  }
}
