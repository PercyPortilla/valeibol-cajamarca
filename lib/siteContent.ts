export type SiteService = {
  id: string;
  icon: string;
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

export type SiteContent = {
  services: SiteService[];
  gallery: SiteGalleryItem[];
  updatedAt: string | null;
  source: "supabase" | "local" | "default";
};

export const DEFAULT_SITE_SERVICES: SiteService[] = [
  { id: "covered-court", icon: "⌂", title: "Cancha techada", description: "Espacio cubierto para jugar con mayor comodidad durante todo el turno.", sortOrder: 10, isVisible: true },
  { id: "hourly-booking", icon: "◷", title: "Reserva por hora", description: "Elige un bloque disponible y organiza tu partido o entrenamiento.", sortOrder: 20, isVisible: true },
  { id: "lighting", icon: "☼", title: "Iluminación opcional", description: "Juega de día o de noche con la tarifa correspondiente.", sortOrder: 30, isVisible: true },
  { id: "cooling-break", icon: "❄", title: "Zona de cooling break", description: "Espacio para descansar e hidratarse entre sets o durante pausas del juego.", sortOrder: 40, isVisible: true },
  { id: "music-choice", icon: "♫", title: "Música a elección", description: "Ambientación musical para acompañar tu turno de juego.", sortOrder: 50, isVisible: true },
  { id: "tv-zone", icon: "▣", title: "Zona TV", description: "Área con TV para acompañantes y momentos de descanso.", sortOrder: 60, isVisible: true },
  { id: "snack-store", icon: "▤", title: "Tienda de bebidas y snacks", description: "Bebidas y snacks disponibles para jugadores y acompañantes.", sortOrder: 70, isVisible: true },
  { id: "restrooms", icon: "◉", title: "Baños para hombres y mujeres", description: "Servicios higiénicos diferenciados para mayor comodidad.", sortOrder: 80, isVisible: true },
  { id: "changing-rooms", icon: "▥", title: "Vestidores", description: "Espacio para cambiarse antes o después del juego.", sortOrder: 90, isVisible: true },
  { id: "spectator-zone", icon: "◎", title: "Zona para público", description: "Área destinada a acompañantes y espectadores.", sortOrder: 100, isVisible: true },
  { id: "net-height", icon: "↕", title: "Altura de malla a elección", description: "Ajustamos la altura de la malla según el tipo de juego que necesites.", sortOrder: 110, isVisible: true },
  { id: "pro-balls", icon: "◌", title: "Balones profesionales", description: "Balones de vóley profesionales disponibles para el turno.", sortOrder: 120, isVisible: true },
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
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

export function normalizeSiteServices(value: unknown): SiteService[] {
  if (!Array.isArray(value)) return DEFAULT_SITE_SERVICES.map((item) => ({ ...item }));
  const result = value.slice(0, 24).flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const record = raw as Record<string, unknown>;
    const id = cleanText(record.id, 80) || `service-${index + 1}`;
    const title = cleanText(record.title, 80);
    const description = cleanText(record.description, 220);
    if (!title || !description) return [];
    return [{
      id,
      icon: cleanText(record.icon, 8) || "•",
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

export function defaultSiteContent(): SiteContent {
  return {
    services: DEFAULT_SITE_SERVICES.map((item) => ({ ...item })),
    gallery: DEFAULT_SITE_GALLERY.map((item) => ({ ...item })),
    updatedAt: null,
    source: "default",
  };
}
