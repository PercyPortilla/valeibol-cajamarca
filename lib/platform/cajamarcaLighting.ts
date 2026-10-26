export const CAJAMARCA_TIME_ZONE = "America/Lima";

const cajamarcaClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: CAJAMARCA_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function getCajamarcaClock(date: Date = new Date()) {
  const parts = cajamarcaClock.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return { hour, minute };
}

export function isCajamarcaLightingTime(date: Date = new Date()) {
  const { hour } = getCajamarcaClock(date);
  return hour >= 18 || hour < 6;
}
