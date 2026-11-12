import { addDays } from "../availability.ts";
import type { AdminBoardSlot } from "./schedule.ts";

export type AdminBoardViewMode = "day" | "three" | "week";
export type AdminBoardStatusFilter = "all" | "free" | "busy";

export function visibleBoardDates(weekFrom: string, selectedDate: string, mode: AdminBoardViewMode): string[] {
  const week = Array.from({ length: 7 }, (_, index) => addDays(weekFrom, index));
  const index = Math.max(0, week.indexOf(selectedDate));
  if (mode === "week") return week;
  if (mode === "day") return [week[index]];
  return week.slice(Math.min(index, 4), Math.min(index, 4) + 3);
}

export function slotMatchesAdminFilter(slot: AdminBoardSlot, filter: AdminBoardStatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "free") return slot.status === "available";
  return ["pending", "confirmed", "completed", "blocked"].includes(slot.status);
}
