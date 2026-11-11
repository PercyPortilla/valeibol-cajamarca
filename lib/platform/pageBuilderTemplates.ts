import {
  SITE_THEME_PRESETS, normalizeSiteTheme,
  type SiteTheme,
} from "../siteContent.ts";

/** Copy is deliberately generic: a template must never invent courts or services. */
export const PAGE_BUILDER_TEMPLATES = [
  { id: "futbol", name: "Fútbol", subtitle: "Editorial de cancha", layout: "gallery-first", palette: "competitive", intro: "Descubre nuestros espacios deportivos y consulta directamente por horarios y reservas." },
  { id: "voley", name: "Vóley", subtitle: "Club y comunidad", layout: "services-first", palette: "classic", intro: "Explora las instalaciones y conoce la propuesta deportiva antes de coordinar tu visita." },
  { id: "basquet", name: "Básquet", subtitle: "Energía nocturna", layout: "gallery-first", palette: "night", intro: "Encuentra información del complejo y consulta por las opciones disponibles para entrenar o jugar." },
  { id: "multideporte", name: "Multideporte", subtitle: "Para cualquier disciplina", layout: "services-first", palette: "competitive", intro: "Conoce los espacios, servicios y actividades publicados por nuestro complejo deportivo." },
] as const;

export type PageTemplateId = (typeof PAGE_BUILDER_TEMPLATES)[number]["id"];

export function applyPageBuilderTemplate(current: SiteTheme, templateId: PageTemplateId): SiteTheme {
  const template = PAGE_BUILDER_TEMPLATES.find((item) => item.id === templateId);
  if (!template) return normalizeSiteTheme(current);
  const preset = SITE_THEME_PRESETS.find((item) => item.id === template.palette);
  const layout = normalizeSiteTheme(current).sectionLayout ?? ["services", "gallery"];
  const others = layout.filter((item) => item !== "gallery" && item !== "services");
  const firstTwo = template.layout === "gallery-first" ? ["gallery", "services"] : ["services", "gallery"];
  return normalizeSiteTheme({
    ...current,
    ...preset?.theme,
    pageIntro: template.intro,
    servicesHeading: current.servicesHeading || "Servicios del complejo",
    galleryHeading: current.galleryHeading || "Explora nuestras instalaciones",
    sectionOrder: template.layout,
    sectionLayout: [...firstTwo, ...others],
  });
}
