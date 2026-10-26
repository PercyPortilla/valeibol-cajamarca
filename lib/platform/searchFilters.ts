export function normalizeSearchDate(value: string | null | undefined) {
  const candidate = value?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return "";
  const [year, month, day] = candidate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return "";
  return candidate;
}

export function normalizeSearchTime(value: string | null | undefined) {
  const candidate = value?.trim() ?? "";
  if (!/^\d{2}:\d{2}$/.test(candidate)) return "";
  const [hour, minute] = candidate.split(":").map(Number);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
  return candidate;
}
