import {
  buildCalendarDaysFromOperatingDays,
  getWeekDateKeys,
  type AvailabilityWeekSnapshot,
  type PublicBusyInterval,
  type PublicOperatingDay,
} from "@/lib/availability";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";
import type { Database, Json } from "@/lib/data/supabase/database.types";
import type {
  AvailabilityRepository,
  AvailabilityWeekQuery,
} from "./availabilityRepository";

function parseBusyIntervals(value: Json): PublicBusyInterval[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || Array.isArray(entry) || typeof entry !== "object") return [];
    const startAt = entry.startAt;
    const endAt = entry.endAt;
    const kind = entry.kind;

    if (
      typeof startAt !== "string" ||
      typeof endAt !== "string" ||
      (kind !== "reservation" && kind !== "block")
    ) {
      return [];
    }

    return [{ startAt, endAt, kind } satisfies PublicBusyInterval];
  });
}

export class SupabaseAvailabilityRepository implements AvailabilityRepository {
  async getWeek(query: AvailabilityWeekQuery): Promise<AvailabilityWeekSnapshot> {
    const client = createPublicBrowserSupabaseClient();
    const weekDateKeys = getWeekDateKeys(query.referenceDateKey);
    const from = weekDateKeys[0];
    const to = weekDateKeys[weekDateKeys.length - 1];

    const { data, error } = await client.rpc("get_public_availability", {
      p_business_slug: query.businessSlug,
      p_from: from,
      p_to: to,
    });

    if (error) {
      throw new Error("availability_unavailable");
    }

    type PublicAvailabilityRow = Database["public"]["Functions"]["get_public_availability"]["Returns"][number];
    const rows = (data ?? []) as PublicAvailabilityRow[];
    const grouped = new Map<
      string,
      {
        courtName: string;
        timezone: string;
        days: PublicOperatingDay[];
      }
    >();

    for (const row of rows) {
      const current: { courtName: string; timezone: string; days: PublicOperatingDay[] } =
        grouped.get(row.court_id) ?? {
          courtName: row.court_name,
          timezone: row.business_timezone,
          days: [],
        };

      current.days.push({
        date: row.calendar_date,
        isOpen: row.is_open,
        opensAt: row.opens_at?.slice(0, 5) ?? null,
        closesAt: row.closes_at?.slice(0, 5) ?? null,
        scheduleStatus: row.schedule_status,
        busyIntervals: parseBusyIntervals(row.busy_intervals),
      });

      grouped.set(row.court_id, current);
    }

    const courts = [...grouped.entries()].map(([courtId, court]) => ({
      courtId,
      courtName: court.courtName,
      timezone: court.timezone,
      days: buildCalendarDaysFromOperatingDays(
        court.days.sort((a, b) => a.date.localeCompare(b.date)),
        query.todayDateKey,
        court.timezone,
      ),
    }));

    const isProvisional = rows.length === 0 || rows.some((row) => row.schedule_status === "provisional");

    return {
      businessId: rows[0]?.business_id ?? null,
      source: "supabase",
      sourceLabel: isProvisional
        ? "Supabase conectado · horario aún provisional"
        : "Supabase conectado · horario confirmado",
      isProvisional,
      courts,
    };
  }
}

