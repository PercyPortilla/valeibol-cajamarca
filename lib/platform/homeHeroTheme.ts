export type HomeSportVisual = "multi" | "football" | "volleyball" | "basketball" | "futsal" | "tennis";

export type HomeSportTheme = {
  visual: HomeSportVisual;
  accent: string;
  accentSoft: string;
};

const defaultTheme: HomeSportTheme = {
  visual: "multi",
  accent: "#E6E9EC",
  accentSoft: "rgba(230,233,236,.16)",
};

export const sportTheme: Record<string, HomeSportTheme> = {
  futbol: { visual: "football", accent: "#79C267", accentSoft: "rgba(121,194,103,.18)" },
  football: { visual: "football", accent: "#79C267", accentSoft: "rgba(121,194,103,.18)" },
  voley: { visual: "volleyball", accent: "#62B8E8", accentSoft: "rgba(98,184,232,.18)" },
  volleyball: { visual: "volleyball", accent: "#62B8E8", accentSoft: "rgba(98,184,232,.18)" },
  basquet: { visual: "basketball", accent: "#E6944C", accentSoft: "rgba(230,148,76,.18)" },
  basketball: { visual: "basketball", accent: "#E6944C", accentSoft: "rgba(230,148,76,.18)" },
  futsal: { visual: "futsal", accent: "#45C4D6", accentSoft: "rgba(69,196,214,.18)" },
  tenis: { visual: "tennis", accent: "#A8C95F", accentSoft: "rgba(168,201,95,.18)" },
  tennis: { visual: "tennis", accent: "#A8C95F", accentSoft: "rgba(168,201,95,.18)" },
};

export function getHomeSportTheme(slug: string | null | undefined) {
  return slug ? sportTheme[slug] ?? defaultTheme : defaultTheme;
}

export function isNightSlot(selectedTime: string | null | undefined) {
  if (!selectedTime || !/^\d{2}:\d{2}$/.test(selectedTime)) return false;
  const [hour, minute] = selectedTime.split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return false;
  return hour >= 18;
}

