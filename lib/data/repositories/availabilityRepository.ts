import type { AvailabilityWeekSnapshot } from "@/lib/availability";

export type AvailabilityWeekQuery = {
  businessSlug: string;
  referenceDateKey: string;
  todayDateKey: string;
};

export interface AvailabilityRepository {
  getWeek(query: AvailabilityWeekQuery): Promise<AvailabilityWeekSnapshot>;
}
