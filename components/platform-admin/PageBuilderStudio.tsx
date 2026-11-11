"use client";

import { useMemo, useState, type CSSProperties, type ChangeEvent } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { SERVICE_ICON_OPTIONS, type ServiceIconKey } from "@/lib/icons";
import { SITE_THEME_PRESETS, isAccessibleSiteTheme, isValidSiteThemeInput, normalizeSiteTheme, normalizeSiteLogoUrl, normalizeSiteExternalUrl, normalizeSiteExtraSections, type SiteContent, type SiteGalleryItem, type SiteService, type SiteTheme } from "@/lib/siteContent";
import type { PageBuilderBusiness, PageBuilderState } from "@/lib/platform/pageBuilder";
import { BuilderHistoryPanel, BuilderSectionsPanel, BuilderTemplatePanel } from "./PageBuilderV2Tools";

type Panel = "plantillas" | "identidad" | "bloques" | "galeria" | "colores" | "historial";
type Viewport = "desktop" | "mobile";
type Message = { tone: "success" | "error" | "notice"; text: string };

const PANELS: Array<{ id: Panel; name: string; number: string }> = [
  { id: "plantillas", name: "Plantillas", number: "00" },
  { id: "identidad", name: "Portada", number: "01" },
  { id: "bloques", name: "Secciones", number: "02" },
  { id: "galeria", name: "Imágenes", number: "03" },
  { id: "colores", name: "Estilo", number: "04" },
  { id: "historial", name: "Versiones", number: "05" },
];

function ordered<T extends { sortOrder: number }>(items: T[]) {
  return items.map((item, index) => ({ ...item, sortOrder: (index + 1) * 10 }));
}

function move<T extends { sortOrder: number }>(items: T[], index: number, delta: -1 | 1) {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return ordered(next);
}

const THEME_KEYS: Array<[keyof Pick<SiteTheme, "navy" | "blue" | "blueDark" | "red" | "redDark" | "yellow" | "canvas">, string]> = [
  ["navy", "Texto principal"], ["blue", "Botones"], ["blueDark", "Botones al pasar"],
  ["red", "Acento"], ["redDark", "Acento oscuro"], ["yellow", "Destacados"], ["canvas", "Fondo"],
];

export function PageBuilderStudio({ business, initialContent, initialBuilderState, mode = "global" }: {
  business: PageBuilderBusiness;
  initialContent: SiteContent;
  initialBuilderState: PageBuilderState;
  mode?: "global" | "tenant";
}) {
  const initialWork = initialBuilderState.draft ?? initialContent;
  const [panel, setPanel] = useState<Panel>("plantillas");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [logoUrl, setLogoUrl] = useState(initialWork.logoUrl);
  const [services, setServices] = useState(initialWork.services);
  const [gallery, setGallery] = useState(initialWork.gallery);
  const [theme, setTheme] = useState(initialWork.theme);
  const [saved, setSaved] = useState(JSON.stringify({ logoUrl: initialWork.logoUrl, services: initialWork.services, gallery: initialWork.gallery, theme: normalizeSiteTheme(initialWork.theme) }));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [lastSaved, setLastSaved] = useState(initialBuilderState.draftUpdatedAt);
  const [draftVersion, setDraftVersion] = useState(initialBuilderState.draftVersion);
  const [draftPublished, setDraftPublished] = useState(initialBuilderState.draftPublished);
  const [publishedAt, setPublishedAt] = useState(initialBuilderState.publishedAt);
  const [revisions, setRevisions] = useState(initialBuilderState.revisions);
  const [working, setWorking] = useState(false);

  const isDirty = JSON.stringify({ logoUrl, services, gallery, theme }) !== saved;
  const needsSave = isDirty || draftVersion === 0;
  const canPublish = !needsSave && !draftPublished && draftVersion > 0 && !saving && !working && !uploading;
  const extras = theme.extraSections ?? [];
  const extrasValid = extras.length <= 8 && normalizeSiteExtraSections(extras).length === extras.length
    && extras.every((section) => (!section.buttonUrl.trim() || Boolean(normalizeSiteExternalUrl(section.buttonUrl)))
      && (!section.imageUrl.trim() || Boolean(normalizeSiteLogoUrl(section.imageUrl))));
  const contentValid = services.every((item) => item.title.trim() && item.description.trim())
    && gallery.every((item) => item.title.trim());
  const themeValid = isValidSiteThemeInput(theme) && isAccessibleSiteTheme(normalizeSiteTheme(theme))
    && extrasValid && contentValid;
  const visibleServices = services.filter((item) => item.isVisible && item.title.trim() && item.description.trim());
  const visibleGallery = gallery.filter((item) => item.isVisible && item.imageUrl.trim());
  const previewStyle = {
    "--studio-page-ink": theme.navy,
    "--studio-page-blue": theme.blue,
    "--studio-page-red": theme.red,
    "--studio-page-yellow": theme.yellow,
    "--studio-page-canvas": theme.canvas,
  } as CSSProperties;
  const coverImage = visibleGallery[0]?.imageUrl;
  const isPublishedCandidate = business.isActive && business.configurationStatus === "confirmed";

  const sitePath = `/complejo/${encodeURIComponent(business.slug)}`;
  const endpoint = `/api/admin-global/page-builder/${encodeURIComponent(business.id)}`;
  const datesLabel = useMemo(() => lastSaved ? new Date(lastSaved).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short", timeZone: "America/Lima" }) : "Sin cambios guardados", [lastSaved]);

  function loadContent(content: SiteContent) {
    setLogoUrl(content.logoUrl);
    setServices(content.services);
    setGallery(content.gallery);
    setTheme(content.theme);
    setSaved(JSON.stringify({ logoUrl: content.logoUrl, services: content.services, gallery: content.gallery, theme: normalizeSiteTheme(content.theme) }));
  }

  async function refreshBuilderState() {
    const response = await fetch(endpoint, { method: "GET", cache: "no-store" });
    const body = await response.json() as { ok?: boolean; state?: PageBuilderState; message?: string };
    if (!response.ok || !body.ok || !body.state) throw new Error(body.message || "No pudimos actualizar el estado del estudio.");
    const state = body.state;
    setDraftVersion(state.draftVersion);
    setDraftPublished(state.draftPublished);
    setLastSaved(state.draftUpdatedAt);
    setPublishedAt(state.publishedAt);
    setRevisions(state.revisions);
    loadContent(state.draft ?? state.published ?? initialContent);
    return state;
  }

  function updateTheme(patch: Partial<SiteTheme>) {
    setTheme((current) => ({ ...current, ...patch, presetId: "custom" }));
    setMessage(null);
  }

  function changeService(index: number, patch: Partial<SiteService>) {
    setServices((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item));
    setMessage(null);
  }

  function changeGallery(index: number, patch: Partial<SiteGalleryItem>) {
    setGallery((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item));
    setMessage(null);
  }

  function addService() {
    if (services.length >= 24) return;
    const id = `service-${Date.now()}`;
    setServices((current) => [...current, { id, icon: "ball", title: "Nuevo servicio", description: "Describe el servicio real que ofrece este negocio.", sortOrder: (current.length + 1) * 10, isVisible: true }]);
    setMessage(null);
  }

  function addGallery() {
    if (gallery.length >= 16) return;
    const id = `gallery-${Date.now()}`;
    setGallery((current) => [...current, { id, title: "Nueva imagen", altText: "Instalaciones del complejo deportivo", imageUrl: "", sortOrder: (current.length + 1) * 10, isVisible: true }]);
    setMessage(null);
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>, target: "logo" | number) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    event.currentTarget.value = "";
    const key = target === "logo" ? "logo" : `gallery-${target}`;
    setUploading(key);
    setMessage(null);
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await fetch(`${endpoint}/media`, { method: "POST", body: data, cache: "no-store" });
      const payload = await response.json() as { ok?: boolean; url?: string; message?: string };
      if (!response.ok || !payload.ok || !payload.url) throw new Error(payload.message || "No se pudo subir la imagen.");
      if (target === "logo") setLogoUrl(payload.url);
      else changeGallery(target, { imageUrl: payload.url });
      setMessage({ tone: "notice", text: "Imagen subida. Pulsa «Guardar borrador» para incorporarla al diseño, sin publicarla todavía." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "No se pudo subir la imagen." });
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    if (saving || working || uploading || !needsSave) return;
    if (!themeValid) {
      setPanel("colores");
      if (!extrasValid || !contentValid) setPanel("bloques");
      setMessage({ tone: "error", text: "Revisa los colores, los títulos, las descripciones y los enlaces HTTPS antes de guardar." });
      return;
    }
    const payload = { logoUrl: logoUrl.trim(), services: ordered(services), gallery: ordered(gallery), theme: normalizeSiteTheme(theme) };
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: payload, expectedVersion: draftVersion, expectedPublishedAt: publishedAt }),
        cache: "no-store",
      });
      const data = await response.json() as { ok?: boolean; message?: string; data?: { draftVersion: number; draftUpdatedAt: string } };
      if (!response.ok || !data.ok) throw new Error(data.message || "No fue posible guardar los cambios.");
      setServices(payload.services);
      setGallery(payload.gallery);
      setLogoUrl(payload.logoUrl);
      setTheme(payload.theme);
      setSaved(JSON.stringify(payload));
      setLastSaved(data.data?.draftUpdatedAt ?? new Date().toISOString());
      setDraftVersion(data.data?.draftVersion ?? draftVersion + 1);
      setDraftPublished(false);
      setMessage({ tone: "success", text: "Borrador guardado. La página pública NO ha cambiado. Revisa la vista previa y pulsa «Publicar diseño» cuando esté listo." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Error al guardar los cambios." });
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!canPublish || !window.confirm("¿Publicar este diseño? Sustituirá el contenido visual de la página pública de este complejo. Las reservas y canchas no se modifican.")) return;
    setWorking(true);
    setMessage(null);
    try {
      const response = await fetch(endpoint, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: draftVersion }), cache: "no-store",
      });
      const body = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || !body.ok) throw new Error(body.message || "No se pudo publicar el diseño.");
      await refreshBuilderState();
      setMessage({ tone: "success", text: isPublishedCandidate
        ? "Diseño publicado. Ya está conectado a la página pública del complejo."
        : "Diseño publicado en su configuración. El negocio continúa en preparación hasta completar su activación y canchas." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "No se pudo publicar el diseño." });
    } finally { setWorking(false); }
  }

  async function restore(revisionId: string) {
    if (working || saving || uploading || !window.confirm("¿Recuperar esta versión como borrador? Se reemplazará el borrador actual, pero el sitio público NO cambiará.")) return;
    setWorking(true);
    setMessage(null);
    try {
      const response = await fetch(endpoint, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionId, expectedVersion: draftVersion }), cache: "no-store",
      });
      const body = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || !body.ok) throw new Error(body.message || "No se pudo recuperar la versión.");
      await refreshBuilderState();
      setPanel("bloques");
      setMessage({ tone: "success", text: "Versión recuperada como borrador. Revísala antes de publicarla." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "No se pudo recuperar la versión." });
    } finally { setWorking(false); }
  }

  async function discardDraft() {
    if (!draftVersion || working || saving || uploading || !window.confirm("¿Descartar el borrador completo y recuperar la versión pública actual? Esta operación no se puede deshacer si aún no has publicado sus cambios.")) return;
    setWorking(true);
    setMessage(null);
    try {
      const response = await fetch(endpoint, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: draftVersion }), cache: "no-store",
      });
      const body = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || !body.ok) throw new Error(body.message || "No se pudo descartar el borrador.");
      await refreshBuilderState();
      setPanel("identidad");
      setMessage({ tone: "notice", text: "Borrador descartado. El contenido publicado no se ha modificado." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "No se pudo descartar el borrador." });
    } finally { setWorking(false); }
  }

  const servicePreview = theme.showServices === false ? null : (
    <section className="studio-preview__section" key="services">
      <span className="studio-preview__overline">SERVICIOS</span>
      <h3>{theme.servicesHeading || `Lo que ofrece ${business.name}`}</h3>
      {visibleServices.length ? <div className="studio-preview__services">{visibleServices.map((item) => <article key={item.id}><span aria-hidden="true"><Icon name={item.icon} size={19} /></span><strong>{item.title}</strong><small>{item.description}</small></article>)}</div> : <p className="studio-preview__empty">Añade servicios reales para mostrar esta sección.</p>}
    </section>
  );
  const galleryPreview = theme.showGallery === false ? null : (
    <section className="studio-preview__section" key="gallery">
      <span className="studio-preview__overline">GALERÍA</span>
      <h3>{theme.galleryHeading || "Conoce las instalaciones"}</h3>
      {visibleGallery.length ? <div className="studio-preview__photos">{visibleGallery.map((item) => <figure key={item.id}><div style={{ backgroundImage: `url(${item.imageUrl})` }} role="img" aria-label={item.altText} /><figcaption>{item.title}</figcaption></figure>)}</div> : <p className="studio-preview__empty">Sube fotos auténticas de las instalaciones.</p>}
    </section>
  );
  const customPreviewSections = (theme.extraSections ?? []).filter((section) => section.isVisible).map((section) => [
    section.id,
    <section className="studio-preview__section studio-preview__custom" key={section.id}>
      <span className="studio-preview__overline">SOBRE NOSOTROS</span>
      <h3>{section.title}</h3>
      {section.imageUrl ? <div className="studio-preview__custom-image" role="img" aria-label={section.title} style={{ backgroundImage: `url("${section.imageUrl.replaceAll('"', '%22')}")` }} /> : null}
      {section.description ? <p>{section.description}</p> : null}
      {section.buttonLabel && section.buttonUrl ? <span className="studio-preview__fake-cta">{section.buttonLabel} ↗</span> : null}
    </section>,
  ] as const);
  const previewSections = new Map<string, React.ReactNode>([
    ["services", servicePreview], ["gallery", galleryPreview], ...customPreviewSections,
  ]);
  const visibleLayout = normalizeSiteTheme(theme).sectionLayout ?? ["services", "gallery"];

  return (
    <div className="studio-workspace">
      <header className="studio-heading">
        <div>
          <div className="studio-heading__eyebrow"><span className="studio-live-dot" /> EDITOR VISUAL / PÁGINA HIJA</div>
          <h1>Diseña <em>tu página.</em></h1>
          <p><strong>{business.name}</strong><span aria-hidden="true"> / </span>{business.slug}</p>
        </div>
        <div className="studio-heading__actions">
          {mode === "global"
            ? <Link href="/admin-global#admin-alta-negocio" className="studio-muted-action">+ Crear otra página</Link>
            : <Link href="/admin/configuracion" className="studio-muted-action">← Configuración del negocio</Link>}
          {isPublishedCandidate ? <a href={sitePath} className="studio-muted-action" target="_blank" rel="noreferrer">Ver sitio público ↗</a> : <span className="studio-draft-state">EN PREPARACIÓN</span>}
          {mode === "global"
            ? <form action="/api/admin-global/select-business" method="post">
                <input type="hidden" name="businessId" value={business.id}/>
                <button className="studio-muted-action" type="submit">Canchas y publicación ↗</button>
              </form>
            : <Link href="/admin/configuracion/estructura" className="studio-muted-action">Canchas y publicación ↗</Link>}
          <button className="studio-save" type="button" onClick={() => void save()} disabled={!needsSave || saving || working || Boolean(uploading)}>{saving ? "Guardando…" : needsSave ? "Guardar borrador" : "Borrador guardado"}<span aria-hidden="true">↓</span></button>
          <button className="studio-publish" type="button" onClick={() => void publish()} disabled={!canPublish}>{working ? "Procesando…" : draftPublished ? "Publicado" : "Publicar diseño ↗"}</button>
        </div>
      </header>

      <div className="studio-layout">
        <aside className="studio-panel" aria-label="Herramientas de edición">
          <div className="studio-panel__intro"><span>HERRAMIENTAS</span><strong>Contenido y diseño</strong><small>Selecciona una categoría para editar.</small></div>
          <nav className="studio-tabs" aria-label="Secciones del editor">
            {PANELS.map((item) => <button type="button" key={item.id} className={panel === item.id ? "studio-tab studio-tab--active" : "studio-tab"} onClick={() => setPanel(item.id)} aria-current={panel === item.id ? "page" : undefined}><span>{item.number}</span>{item.name}</button>)}
          </nav>
          <div className="studio-panel__body">
            {panel === "plantillas" ? <BuilderTemplatePanel theme={theme} onChange={(next) => { setTheme(next); setMessage(null); }} /> : null}
            {panel === "identidad" ? <>
              <div className="studio-group-heading"><span>01 / PORTADA</span><h2>Primera impresión</h2><p>El nombre legal del complejo no cambia; estos textos personalizan su presentación pública.</p></div>
              <label className="studio-field"><span>Título principal</span><input maxLength={100} value={theme.pageHeadline ?? ""} placeholder={business.name} onChange={(event) => updateTheme({ pageHeadline: event.target.value })}/><small>Deja vacío para usar el nombre del negocio.</small></label>
              <label className="studio-field"><span>Descripción de portada</span><textarea rows={4} maxLength={240} value={theme.pageIntro ?? ""} placeholder="Invita a conocer tus instalaciones y consultar horarios." onChange={(event) => updateTheme({ pageIntro: event.target.value })}/></label>
              <div className="studio-divider" />
              <div className="studio-group-heading"><span>IDENTIDAD DEL NEGOCIO</span><h2>Logo</h2></div>
              <div className="studio-logo-drop"><div className="studio-logo-drop__visual">{logoUrl ? <span style={{ backgroundImage: `url(${logoUrl})` }} role="img" aria-label="Logo actual" /> : <b>+</b>}</div><label className="studio-upload"><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={Boolean(uploading)} onChange={(event) => void uploadImage(event, "logo")}/>{uploading === "logo" ? "Subiendo…" : "Subir logo"}</label></div>
              <label className="studio-field"><span>O usa una URL pública</span><input type="url" maxLength={1200} placeholder="https://..." value={logoUrl} onChange={(event) => { setLogoUrl(event.target.value); setMessage(null); }}/></label>
              {logoUrl ? <button className="studio-text-button" type="button" onClick={() => setLogoUrl("")}>Quitar logo</button> : null}
              <p className="studio-small-note">La imagen de portada pública se toma de la primera foto visible de tu galería. No se generan fotos ficticias.</p>
            </> : null}

            {panel === "bloques" ? <>
              <div className="studio-group-heading"><span>02 / SECCIONES</span><h2>Organiza el contenido</h2><p>Elige qué secciones aparecen y en qué orden. Las canchas y sus precios reales se mantienen independientes.</p></div>
              <BuilderSectionsPanel theme={theme} onChange={updateTheme} galleryUrls={gallery.filter((item) => item.imageUrl).map((item) => ({ title: item.title, url: item.imageUrl }))}/>
              <label className="studio-switch"><input type="checkbox" checked={theme.showServices !== false} onChange={(event) => updateTheme({ showServices: event.target.checked })}/><span>Mostrar servicios</span></label>
              <label className="studio-field"><span>Título de servicios</span><input value={theme.servicesHeading ?? ""} maxLength={96} placeholder={`Lo que ofrece ${business.name}`} onChange={(event) => updateTheme({ servicesHeading: event.target.value })}/></label>
              <label className="studio-switch"><input type="checkbox" checked={theme.showGallery !== false} onChange={(event) => updateTheme({ showGallery: event.target.checked })}/><span>Mostrar galería</span></label>
              <label className="studio-field"><span>Título de galería</span><input value={theme.galleryHeading ?? ""} maxLength={96} placeholder="Conoce las instalaciones" onChange={(event) => updateTheme({ galleryHeading: event.target.value })}/></label>
              <div className="studio-divider" />
              <div className="studio-row-heading"><h2>Servicios <span>{services.length}/24</span></h2><button type="button" onClick={addService} disabled={services.length >= 24}>+ Añadir</button></div>
              {services.length === 0 ? <p className="studio-small-note">Todavía no hay servicios registrados. Agrega únicamente los que realmente ofrece el complejo.</p> : null}
              <div className="studio-edit-list">{services.map((service, index) => (
                <article className="studio-edit-item" key={service.id}>
                  <div className="studio-edit-item__top"><span>Servicio {String(index + 1).padStart(2, "0")}</span><div><button type="button" disabled={index === 0} onClick={() => setServices((current) => move(current, index, -1))} aria-label="Subir servicio">↑</button><button type="button" disabled={index === services.length - 1} onClick={() => setServices((current) => move(current, index, 1))} aria-label="Bajar servicio">↓</button><button type="button" onClick={() => setServices((current) => ordered(current.filter((_, i) => i !== index)))} aria-label="Eliminar servicio">×</button></div></div>
                  <label className="studio-field"><span>Nombre</span><input maxLength={80} value={service.title} onChange={(event) => changeService(index, { title: event.target.value })}/></label>
                  <label className="studio-field"><span>Descripción</span><textarea rows={2} maxLength={220} value={service.description} onChange={(event) => changeService(index, { description: event.target.value })}/></label>
                  <div className="studio-edit-item__bottom"><label className="studio-field"><span>Icono</span><select value={service.icon} onChange={(event) => changeService(index, { icon: event.target.value as ServiceIconKey })}>{SERVICE_ICON_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label><label className="studio-switch"><input type="checkbox" checked={service.isVisible} onChange={(event) => changeService(index, { isVisible: event.target.checked })}/><span>Visible</span></label></div>
                </article>
              ))}</div>
            </> : null}

            {panel === "galeria" ? <>
              <div className="studio-group-heading"><span>03 / BIBLIOTECA VISUAL</span><h2>Imágenes del complejo</h2><p>Sube tus fotografías o pega una URL. La primera foto visible será la portada si el complejo no tiene otra configurada.</p></div>
              <div className="studio-row-heading"><h2>Galería <span>{gallery.length}/16</span></h2><button type="button" onClick={addGallery} disabled={gallery.length >= 16}>+ Añadir foto</button></div>
              {gallery.length === 0 ? <div className="studio-empty-media"><span>▧</span><strong>Tu galería empieza aquí.</strong><p>Agrega una foto y guárdala para mostrarla en la página hija.</p></div> : null}
              <div className="studio-edit-list">{gallery.map((item, index) => (
                <article className="studio-edit-item" key={item.id}>
                  <div className="studio-edit-item__top"><span>Imagen {String(index + 1).padStart(2, "0")}{index === 0 ? " · Portada" : ""}</span><div><button type="button" disabled={index === 0} onClick={() => setGallery((current) => move(current, index, -1))} aria-label="Subir foto">↑</button><button type="button" disabled={index === gallery.length - 1} onClick={() => setGallery((current) => move(current, index, 1))} aria-label="Bajar foto">↓</button><button type="button" onClick={() => setGallery((current) => ordered(current.filter((_, i) => i !== index)))} aria-label="Eliminar foto">×</button></div></div>
                  <div className="studio-photo-line"><div className="studio-photo-thumb" style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : undefined} role="img" aria-label={item.altText || "Foto sin imagen"}>{!item.imageUrl ? "+" : null}</div><label className="studio-upload"><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={Boolean(uploading)} onChange={(event) => void uploadImage(event, index)}/>{uploading === `gallery-${index}` ? "Subiendo…" : "Subir foto"}</label></div>
                  <label className="studio-field"><span>Nombre de la imagen</span><input maxLength={100} value={item.title} onChange={(event) => changeGallery(index, { title: event.target.value })}/></label>
                  <label className="studio-field"><span>URL de imagen</span><input type="url" maxLength={1200} placeholder="https://..." value={item.imageUrl} onChange={(event) => changeGallery(index, { imageUrl: event.target.value })}/></label>
                  <label className="studio-field"><span>Descripción accesible</span><input maxLength={180} value={item.altText} onChange={(event) => changeGallery(index, { altText: event.target.value })}/></label>
                  <label className="studio-switch"><input type="checkbox" checked={item.isVisible} onChange={(event) => changeGallery(index, { isVisible: event.target.checked })}/><span>Visible en la página</span></label>
                </article>
              ))}</div>
            </> : null}

            {panel === "colores" ? <>
              <div className="studio-group-heading"><span>04 / SISTEMA VISUAL</span><h2>Tu identidad, tus colores</h2><p>La marca madre es cromada y violeta, pero cada negocio conserva una paleta totalmente independiente.</p></div>
              <div className="studio-visual-styles" role="group" aria-label="Estilos premium para la página pública">
                {([
                  ["signature", "Signature", "Deportivo elegante"],
                  ["noir", "Noir Luxe", "Oscuro y exclusivo"],
                  ["editorial", "Editorial", "Luz y tipografía"],
                  ["stadium", "Stadium", "Energía deportiva"],
                  ["glass", "Glass Studio", "Cristal y profundidad"],
                ] as const).map(([id,name,description])=>(
                  <button key={id} type="button"
                    className={(theme.visualStyle??"signature")===id ? "studio-visual-style studio-visual-style--selected":"studio-visual-style"}
                    onClick={()=>updateTheme({visualStyle:id})} aria-pressed={(theme.visualStyle??"signature")===id}>
                    <span className={`studio-visual-style__art studio-visual-style__art--${id}`}>
                      <i/><b>{name}</b><small>SPORTCENTER</small>
                    </span>
                    <strong>{name}</strong><small>{description}</small>
                  </button>
                ))}
              </div>
              <p className="studio-small-note">Selecciona una dirección de arte para la página hija. Conservarás tu logo, fotos, servicios y colores.</p>
              <div className="studio-divider" />
              <div className="studio-presets">{SITE_THEME_PRESETS.map((preset) => <button type="button" key={preset.id} className={theme.presetId === preset.id ? "studio-preset studio-preset--active" : "studio-preset"} onClick={() => { setTheme((current) => ({ ...current, ...preset.theme })); setMessage(null); }}><span>{[preset.theme.blue, preset.theme.red, preset.theme.yellow, preset.theme.canvas].map((color, index) => <i key={index} style={{ background: color }} />)}</span><strong>{preset.name}</strong></button>)}</div>
              <div className="studio-divider" />
              <div className="studio-row-heading"><h2>Colores personalizados</h2></div>
              <div className="studio-color-list">{THEME_KEYS.map(([key, label]) => <label className="studio-color-input" key={key}><span>{label}</span><div><input type="color" aria-label={`Elegir ${label}`} value={/^#[0-9a-f]{6}$/i.test(theme[key]) ? theme[key] : "#000000"} onChange={(event) => updateTheme({ [key]: event.target.value.toUpperCase() })}/><input aria-label={`Código de ${label}`} maxLength={7} value={theme[key]} onChange={(event) => updateTheme({ [key]: event.target.value.toUpperCase() })}/></div></label>)}</div>
              {!themeValid ? <p className="studio-validation" role="alert">La paleta necesita códigos #RRGGBB y contraste suficiente para que los botones y textos se lean correctamente.</p> : <p className="studio-small-note">Contraste validado. La previsualización usa los colores de este negocio.</p>}
            </> : null}
            {panel === "historial" ? <BuilderHistoryPanel revisions={revisions} onRestore={(id) => void restore(id)} busy={working || saving || Boolean(uploading)} /> : null}
            {panel === "historial" && draftVersion > 0 ? <button className="studio-discard" type="button" disabled={working || saving || Boolean(uploading)} onClick={() => void discardDraft()}>Descartar borrador actual</button> : null}
          </div>
        </aside>

        <section className="studio-canvas" aria-label="Vista previa en vivo de la página">
          <div className="studio-canvas__toolbar"><div><span className="studio-live-dot"/><strong>VISTA PREVIA EN VIVO</strong><small>Los cambios aún no guardados solo aparecen aquí</small></div><div className="studio-viewport" role="group" aria-label="Tamaño de pantalla"><button type="button" className={viewport === "desktop" ? "active" : ""} onClick={() => setViewport("desktop")}>Escritorio</button><button type="button" className={viewport === "mobile" ? "active" : ""} onClick={() => setViewport("mobile")}>Móvil</button></div></div>
          <div className="studio-canvas__surface">
            <div className={`studio-preview studio-preview--${theme.visualStyle ?? "signature"} ${viewport === "mobile" ? "studio-preview--mobile" : ""}`} style={previewStyle}>
              <div className="studio-preview__header"><div className="studio-preview__brand">{logoUrl ? <div role="img" aria-label="Logo del complejo" style={{ backgroundImage: `url(${logoUrl})` }}/> : <span>◇</span>}<b>{business.name}</b></div><span>COMPLEJO DEPORTIVO</span></div>
              <div className="studio-preview__hero" style={coverImage ? { backgroundImage: `linear-gradient(90deg, rgba(9,14,25,.85), rgba(9,14,25,.37)), url(${coverImage})` } : undefined}>
                <span>CAJAMARCA · COMPLEJOS DEPORTIVOS</span>
                <h2>{theme.pageHeadline || business.name}</h2>
                <p>{theme.pageIntro || "Conoce las instalaciones y consulta directamente con el complejo antes de coordinar tu partido."}</p>
                <span className="studio-preview__fake-cta">Consultar canchas <b>↗</b></span>
              </div>
              <div className="studio-preview__meta"><span>{business.city || "Ubicación por configurar"}{business.country ? `, ${business.country}` : ""}</span><span>Diseño de página hija</span></div>
              {visibleLayout.map((sectionId) => previewSections.get(sectionId) ?? null)}
              <div className="studio-preview__footer"><strong>{business.name}</strong><span>Diseño conectado a Caxas SportCenter</span></div>
            </div>
          </div>
          <div className="studio-canvas__legend"><span>◈ La vista previa es una maqueta visual; la página real también incluye sus sedes, canchas, precios y contacto configurados.</span><span>{viewport === "desktop" ? "VISTA DE ESCRITORIO" : "VISTA MÓVIL"}</span></div>
        </section>
      </div>

      <footer className="studio-statusbar">
        <div><span className={`studio-statusbar__mark ${needsSave || !draftPublished ? "studio-statusbar__mark--dirty" : ""}`}/><strong>{needsSave ? "Cambios sin guardar" : draftPublished ? "Diseño publicado" : "Borrador pendiente de publicación"}</strong><small>Último borrador: {datesLabel}</small></div>
        <div>{message ? <p role={message.tone === "error" ? "alert" : "status"} className={`studio-feedback studio-feedback--${message.tone}`}>{message.text}</p> : <p className="studio-statusbar__notice">Tus borradores son privados. La página pública solo cambia cuando pulsas «Publicar diseño».</p>}
          <button type="button" disabled={!needsSave || saving || working || Boolean(uploading)} onClick={() => void save()}>{saving ? "Guardando…" : "Guardar borrador"}</button>
          <button type="button" className="studio-statusbar__publish" disabled={!canPublish} onClick={() => void publish()}>{working ? "Procesando…" : draftPublished ? "Publicado" : "Publicar diseño"}</button>
        </div>
      </footer>
    </div>
  );
}
