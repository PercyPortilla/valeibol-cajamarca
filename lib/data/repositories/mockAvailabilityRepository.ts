import { businessConfig } from "@/config/business";
import { demoBusiness, demoCourt } from "@/lib/data/demoPlatform";
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
      businessId: demoBusiness.id,
      source: "mock-provisional",
      sourceLabel: "Disponibilidad provisional · Supabase no configurado",
      isProvisional: true,
      courts: [
        {
          courtId: demoCourt.id,
          courtName: demoCourt.name,
          timezone: businessConfig.timezone,
          days: buildCalendarDays(query.referenceDateKey, query.todayDateKey),
        },
      ],
    };
  }
}
