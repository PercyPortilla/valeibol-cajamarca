export const SERVICE_ICON_OPTIONS = [
  { key: "court", label: "Cancha" },
  { key: "clock", label: "Reserva por hora" },
  { key: "lighting", label: "Iluminación" },
  { key: "cooling", label: "Cooling break" },
  { key: "music", label: "Música" },
  { key: "tv", label: "TV" },
  { key: "snacks", label: "Bebidas y snacks" },
  { key: "toilets", label: "Baños" },
  { key: "changing", label: "Vestidores" },
  { key: "crowd", label: "Público" },
  { key: "net", label: "Altura de malla" },
  { key: "ball", label: "Balones" },
] as const;

export type ServiceIconKey = (typeof SERVICE_ICON_OPTIONS)[number]["key"];

export type IconKey = ServiceIconKey | "calendar" | "check" | "location" | "phone" | "whatsapp";

export function isServiceIconKey(value: string): value is ServiceIconKey {
  return SERVICE_ICON_OPTIONS.some((option) => option.key === value);
}
