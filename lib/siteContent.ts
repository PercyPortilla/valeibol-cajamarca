import { isServiceIconKey, type ServiceIconKey } from "./icons.ts";

export type SiteService = {
  id: string;
  icon: ServiceIconKey;
  title: string;
  description: string;
  sortOrder: number;
  isVisible: boolean;
};

export type SiteGalleryItem = {
  id: string;
  title: string;
  imageUrl: string;
  altText: string;
  sortOrder: number;
  isVisible: boolean;
};

export type SiteTheme = {
  presetId: "classic" | "competitive" | "night" | "custom";
  navy: string;
  blue: string;
  blueDark: string;
  red: string;
  redDark: string;
  yellow: string;
  canvas: string;
};

export type SiteContent = {
  services: SiteService[];
  gallery: SiteGalleryItem[];
  theme: SiteTheme;
  updatedAt: string | null;
  source: "supabase" | "local" | "default";
};

export const SITE_THEME_PRESETS: Array<{ id: Exclude<SiteTheme["presetId"], "custom">; name: string; description: string; theme: SiteTheme }> = [
  {
    id: "classic",
    name: "Mi Valeibol clásico",
    description: "Azul, rojo y amarillo inspirados directamente en la marca.",
    theme: { presetId: "classic", navy: "#0C2B4A", blue: "#155FA8", blueDark: "#0F4B88", red: "#B72F34", redDark: "#92252A", yellow: "#F4C430", canvas: "#F3F7FB" },
  },
  {
    id: "competitive",
    name: "Competitivo",
    description: "Azules más vivos con rojo deportivo y superficies muy claras.",
    theme: { presetId: "competitive", navy: "#112A46", blue: "#0B6EBD", blueDark: "#084C8A", red: "#B9343A", redDark: "#8E282E", yellow: "#F5C842", canvas: "#F5F8FC" },
  },
  {
    id: "night",
    name: "Noche",
    description: "Más contraste y profundidad para una identidad deportiva nocturna.",
    theme: { presetId: "night", navy: "#071A2B", blue: "#286FC2", blueDark: "#174E8C", red: "#B83238", redDark: "#8C262B", yellow: "#F4C64E", canvas: "#EAF0F6" },
  },
];

export const DEFAULT_SITE_THEME: SiteTheme = { ...SITE_THEME_PRESETS[0].theme };

export const DEFAULT_SITE_SERVICES: SiteService[] = [
  { id: "covered-court", icon: "court", title: "Cancha techada", description: "Espacio cubierto para jugar con mayor comodidad durante todo el turno.", sortOrder: 10, isVisible: true },
  { id: "hourly-booking", icon: "clock", title: "Reserva por hora", description: "Elige un bloque disponible y organiza tu partido o entrenamiento.", sortOrder: 20, isVisible: true },
  { id: "lighting", icon: "lighting", title: "Iluminación automática", description: "La iluminación se aplica automáticamente según el horario de tu reserva.", sortOrder: 30, isVisible: true },
  { id: "cooling-break", icon: "cooling", title: "Zona de cooling break", description: "Espacio para descansar e hidratarse entre sets o durante pausas del juego.", sortOrder: 40, isVisible: true },
  { id: "music-choice", icon: "music", title: "Música a elección", description: "Ambientación musical para acompañar tu turno de juego.", sortOrder: 50, isVisible: true },
  { id: "tv-zone", icon: "tv", title: "Zona TV", description: "Área con TV para acompañantes y momentos de descanso.", sortOrder: 60, isVisible: true },
  { id: "snack-store", icon: "snacks", title: "Tienda de bebidas y snacks", description: "Bebidas y snacks disponibles para jugadores y acompañantes.", sortOrder: 70, isVisible: true },
  { id: "restrooms", icon: "toilets", title: "Baños para hombres y mujeres", description: "Servicios higiénicos diferenciados para mayor comodidad.", sortOrder: 80, isVisible: true },
  { id: "changing-rooms", icon: "changing", title: "Vestidores", description: "Espacio para cambiarse antes o después del juego.", sortOrder: 90, isVisible: true },
  { id: "spectator-zone", icon: "crowd", title: "Zona para público", description: "Área destinada a acompañantes y espectadores.", sortOrder: 100, isVisible: true },
  { id: "net-height", icon: "net", title: "Altura de malla a elección", description: "Ajustamos la altura de la malla según el tipo de juego que necesites.", sortOrder: 110, isVisible: true },
  { id: "pro-balls", icon: "ball", title: "Balones profesionales", description: "Balones de vóley profesionales disponibles para el turno.", sortOrder: 120, isVisible: true },
];

export const DEFAULT_SITE_GALLERY: SiteGalleryItem[] = [
  { id: "gallery-1", title: "Vista general", imageUrl: "", altText: "Vista general de las instalaciones de Valeibol", sortOrder: 10, isVisible: true },
  { id: "gallery-2", title: "Cancha", imageUrl: "", altText: "Cancha de vóley de Valeibol", sortOrder: 20, isVisible: true },
  { id: "gallery-3", title: "Zona de juego", imageUrl: "", altText: "Red y zona de juego de Valeibol", sortOrder: 30, isVisible: true },
  { id: "gallery-4", title: "Ingreso", imageUrl: "", altText: "Ingreso de Valeibol", sortOrder: 40, isVisible: true },
];

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanImageUrl(value: unknown) {
  const url = cleanText(value, 1200);
  if (!url) return "";
  if (/^\/uploads\/local-gallery\/[A-Za-z0-9._-]+$/.test(url)) return url;
  if (/^\/images\/[A-Za-z0-9._/-]+$/.test(url)) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function cleanHex(value: unknown, fallback: string) {
  const color = cleanText(value, 7).toUpperCase();
  return /^#[0-9A-F]{6}$/.test(color) ? color : fallback;
}

function channelToLinear(value: number) {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const rgb = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  return 0.2126 * channelToLinear(rgb[0]) + 0.7152 * channelToLinear(rgb[1]) + 0.0722 * channelToLinear(rgb[2]);
}

export function contrastRatio(a: string, b: string) {
  const lighter = Math.max(luminance(a), luminance(b));
  const darker = Math.min(luminance(a), luminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

function mixHex(foreground: string, background: string, foregroundWeight: number) {
  const weight = Math.max(0, Math.min(1, foregroundWeight));
  const fg = cleanHex(foreground, "#000000");
  const bg = cleanHex(background, "#FFFFFF");
  const channels = [1, 3, 5].map((offset) => {
    const a = Number.parseInt(fg.slice(offset, offset + 2), 16);
    const b = Number.parseInt(bg.slice(offset, offset + 2), 16);
    return Math.round(a * weight + b * (1 - weight)).toString(16).padStart(2, "0").toUpperCase();
  });
  return `#${channels.join("")}`;
}

function accessibleMixHex(foreground: string, backgrounds: string[], startingWeight = 0.68) {
  for (let weight = startingWeight; weight <= 1.001; weight += 0.04) {
    const candidate = mixHex(foreground, backgrounds[0] ?? "#FFFFFF", Math.min(1, weight));
    if (backgrounds.every((background) => contrastRatio(candidate, background) >= 4.5)) return candidate;
  }
  return cleanHex(foreground, "#102A46");
}

const LEGACY_SERVICE_ICONS: Record<string, ServiceIconKey> = {
  "⌂": "court",
  "◷": "clock",
  "☼": "lighting",
  "❄": "cooling",
  "♫": "music",
  "▣": "tv",
  "▤": "snacks",
  "◉": "toilets",
  "▥": "changing",
  "◎": "crowd",
  "↕": "net",
  "◌": "ball",
};

function normalizeServiceIcon(value: unknown): ServiceIconKey {
  const icon = cleanText(value, 32);
  if (isServiceIconKey(icon)) return icon;
  return LEGACY_SERVICE_ICONS[icon] ?? "ball";
}

export function normalizeSiteServices(value: unknown): SiteService[] {
  if (!Array.isArray(value)) return DEFAULT_SITE_SERVICES.map((item) => ({ ...item }));
  const result = value.slice(0, 24).flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const record = raw as Record<string, unknown>;
    const id = cleanText(record.id, 80) || `service-${index + 1}`;
    const rawTitle = cleanText(record.title, 80);
    const rawDescription = cleanText(record.description, 220);
    const usesLegacyLightingCopy = id === "lighting" && rawTitle === "Iluminación opcional";
    const title = usesLegacyLightingCopy ? "Iluminación automática" : rawTitle;
    const description = usesLegacyLightingCopy && rawDescription === "Juega de día o de noche con la tarifa correspondiente."
      ? "La iluminación se aplica automáticamente según el horario de tu reserva."
      : rawDescription;
    if (!title || !description) return [];
    return [{
      id,
      icon: normalizeServiceIcon(record.icon),
      title,
      description,
      sortOrder: Number.isFinite(Number(record.sortOrder)) ? Math.max(0, Math.min(9999, Number(record.sortOrder))) : (index + 1) * 10,
      isVisible: record.isVisible !== false,
    }];
  });
  return result.sort((a, b) => a.sortOrder - b.sortOrder);
}

export function normalizeSiteGallery(value: unknown): SiteGalleryItem[] {
  if (!Array.isArray(value)) return DEFAULT_SITE_GALLERY.map((item) => ({ ...item }));
  return value.slice(0, 16).flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const record = raw as Record<string, unknown>;
    const title = cleanText(record.title, 100);
    if (!title) return [];
    return [{
      id: cleanText(record.id, 80) || `gallery-${index + 1}`,
      title,
      imageUrl: cleanImageUrl(record.imageUrl),
      altText: cleanText(record.altText, 180) || title,
      sortOrder: Number.isFinite(Number(record.sortOrder)) ? Math.max(0, Math.min(9999, Number(record.sortOrder))) : (index + 1) * 10,
      isVisible: record.isVisible !== false,
    }];
  }).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function normalizeSiteTheme(value: unknown): SiteTheme {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_SITE_THEME };
  const record = value as Record<string, unknown>;
  const presetId = record.presetId === "classic" || record.presetId === "competitive" || record.presetId === "night" || record.presetId === "custom"
    ? record.presetId
    : "custom";
  return {
    presetId,
    navy: cleanHex(record.navy, DEFAULT_SITE_THEME.navy),
    blue: cleanHex(record.blue, DEFAULT_SITE_THEME.blue),
    blueDark: cleanHex(record.blueDark, DEFAULT_SITE_THEME.blueDark),
    red: cleanHex(record.red, DEFAULT_SITE_THEME.red),
    redDark: cleanHex(record.redDark, DEFAULT_SITE_THEME.redDark),
    yellow: cleanHex(record.yellow, DEFAULT_SITE_THEME.yellow),
    canvas: cleanHex(record.canvas, DEFAULT_SITE_THEME.canvas),
  };
}

export function isValidSiteThemeInput(value: unknown): value is SiteTheme {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const validPreset = record.presetId === "classic"
    || record.presetId === "competitive"
    || record.presetId === "night"
    || record.presetId === "custom";
  if (!validPreset) return false;
  return ["navy", "blue", "blueDark", "red", "redDark", "yellow", "canvas"].every((key) => {
    const color = record[key];
    return typeof color === "string" && /^#[0-9A-Fa-f]{6}$/.test(color);
  });
}

export function isAccessibleSiteTheme(theme: SiteTheme) {
  const surface = mixHex(theme.canvas, "#FFFFFF", 0.45);
  const muted = accessibleMixHex(theme.navy, [theme.canvas, surface]);
  return contrastRatio(theme.red, "#FFFFFF") >= 4.5
    && contrastRatio(theme.redDark, "#FFFFFF") >= 4.5
    && contrastRatio(theme.blue, "#FFFFFF") >= 4.5
    && contrastRatio(theme.blueDark, "#FFFFFF") >= 4.5
    && contrastRatio(theme.navy, "#FFFFFF") >= 4.5
    && contrastRatio(theme.navy, theme.canvas) >= 4.5
    && contrastRatio(muted, theme.canvas) >= 4.5
    && contrastRatio(muted, surface) >= 4.5;
}

export function themeCssVariables(theme: SiteTheme) {
  const surface = mixHex(theme.canvas, "#FFFFFF", 0.45);
  const surfaceSoft = mixHex(theme.canvas, "#FFFFFF", 0.8);
  const muted = accessibleMixHex(theme.navy, [theme.canvas, surface]);
  return {
    "--brand-navy": theme.navy,
    "--brand-blue": theme.blue,
    "--brand-blue-dark": theme.blueDark,
    "--brand-red": theme.red,
    "--brand-red-dark": theme.redDark,
    "--brand-yellow": theme.yellow,
    "--brand-canvas": theme.canvas,
    "--brand-surface": surface,
    "--brand-surface-soft": surfaceSoft,
    "--brand-text": theme.navy,
    "--brand-muted": muted,
    "--brand-border": mixHex(theme.navy, theme.canvas, 0.18),
    "--brand-border-strong": mixHex(theme.navy, theme.canvas, 0.3),
    "--brand-focus": theme.blueDark,
    "--brand-blue-soft": mixHex(theme.blue, surface, 0.12),
    "--brand-red-soft": mixHex(theme.red, surface, 0.1),
    "--brand-yellow-soft": mixHex(theme.yellow, surface, 0.28),
    "--blue": theme.blue,
    "--blue-soft": mixHex(theme.blue, surface, 0.12),
    "--orange": theme.red,
    "--orange-2": theme.redDark,
    "--red": theme.red,
    "--red-soft": mixHex(theme.red, surface, 0.1),
  } as const;
}

export function defaultSiteContent(): SiteContent {
  return {
    services: DEFAULT_SITE_SERVICES.map((item) => ({ ...item })),
    gallery: DEFAULT_SITE_GALLERY.map((item) => ({ ...item })),
    theme: { ...DEFAULT_SITE_THEME },
    updatedAt: null,
    source: "default",
  };
}

