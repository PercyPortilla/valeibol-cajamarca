"use client";

import { useMemo, useState, type CSSProperties, type ChangeEvent } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { SERVICE_ICON_OPTIONS, type ServiceIconKey } from "@/lib/icons";
import { SITE_THEME_PRESETS, isAccessibleSiteTheme, isValidSiteThemeInput, normalizeSiteTheme, type SiteContent, type SiteGalleryItem, type SiteService, type SiteTheme } from "@/lib/siteContent";
import type { PageBuilderBusiness } from "@/lib/platform/pageBuilder";

type Panel = "identidad" | "bloques" | "galeria" | "colores";
type Viewport = "desktop" | "mobile";
type Message = { tone: "success" | "error" | "notice"; text: string };

const PANELS: Array<{ id: Panel; name: string; number: string }> = [
  { id: "identidad", name: "Portada", number: "01" },
  { id: "bloques", name: "Secciones", number: "02" },
  { id: "galeria", name: "Imágenes", number: "03" },
  { id: "colores", name: "Estilo", number: "04" },
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

export function PageBuilderStudio({ business, initialContent }: { business: PageBuilderBusiness; initialContent: SiteContent }) {
  const [panel, setPanel] = useState<Panel>("identidad");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [logoUrl, setLogoUrl] = useState(initialContent.logoUrl);
  const [services, setServices] = useState(initialContent.services);
  const [gallery, setGallery] = useState(initialContent.gallery);
  const [theme, setTheme] = useState(initialContent.theme);
  const [saved, setSaved] = useState(JSON.stringify({ logoUrl: initialContent.logoUrl, services: initialContent.services, gallery: initialContent.gallery, theme: normalizeSiteTheme(initialContent.theme) }));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [lastSaved, setLastSaved] = useState(initialContent.updatedAt);

  const source = { logoUrl, services, gallery, theme: normalizeSiteTheme(theme) };
  const isDirty = JSON.stringify(source) !== saved;
  const themeValid = isValidSiteThemeInput(theme) && isAccessibleSiteTheme(normalizeSiteTheme(theme));
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
      setMessage({ tone: "notice", text: "Imagen subida. Pulsa «Guardar cambios» para incorporarla al diseño." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "No se pudo subir la imagen." });
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    if (saving || uploading || !isDirty) return;
    if (!themeValid) {
      setPanel("colores");
      setMessage({ tone: "error", text: "Ajusta los colores para garantizar el contraste de los textos." });
      return;
    }
    const payload = { logoUrl: logoUrl.trim(), services: ordered(services), gallery: ordered(gallery), theme: normalizeSiteTheme(theme) };
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const data = await response.json() as { ok?: boolean; message?: string; updatedAt?: string };
      if (!response.ok || !data.ok) throw new Error(data.message || "No fue posible guardar los cambios.");
      setServices(payload.services);
      setGallery(payload.gallery);
      setLogoUrl(payload.logoUrl);
      setTheme(payload.theme);
      setSaved(JSON.stringify(payload));
      setLastSaved(data.updatedAt ?? new Date().toISOString());
      setMessage({ tone: "success", text: isPublishedCandidate
        ? "Diseño guardado. Los cambios se reflejarán en la página pública si el complejo ya tiene sus canchas publicadas."
        : "Diseño guardado. El negocio sigue en preparación; todavía no se ha publicado su página." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Error al guardar los cambios." });
    } finally {
      setSaving(false);
    }
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

  return (
    <div className="studio-workspace">
      <header className="studio-heading">
        <div>
          <div className="studio-heading__eyebrow"><span className="studio-live-dot" /> EDITOR VISUAL / PÁGINA HIJA</div>
          <h1>Diseña <em>tu página.</em></h1>
          <p><strong>{business.name}</strong><span aria-hidden="true"> / </span>{business.slug}</p>
        </div>
        <div className="studio-heading__actions">
          <Link href="/admin-global#admin-alta-negocio" className="studio-muted-action">+ Crear otra página</Link>
          {isPublishedCandidate ? <a href={sitePath} className="studio-muted-action" target="_blank" rel="noreferrer">Ver sitio público ↗</a> : <span className="studio-draft-state">EN PREPARACIÓN</span>}
          <form action="/api/admin-global/select-business" method="post">
            <input type="hidden" name="businessId" value={business.id}/>
            <button className="studio-muted-action" type="submit">Canchas y publicación ↗</button>
          </form>
          <button className="studio-save" type="button" onClick={() => void save()} disabled={!isDirty || saving || Boolean(uploading)}>{saving ? "Guardando…" : isDirty ? "Guardar cambios" : "Sin cambios"}<span aria-hidden="true">↗</span></button>
        </div>
      </header>

      <div className="studio-layout">
        <aside className="studio-panel" aria-label="Herramientas de edición">
          <div className="studio-panel__intro"><span>HERRAMIENTAS</span><strong>Contenido y diseño</strong><small>Selecciona una categoría para editar.</small></div>
          <nav className="studio-tabs" aria-label="Secciones del editor">
            {PANELS.map((item) => <button type="button" key={item.id} className={panel === item.id ? "studio-tab studio-tab--active" : "studio-tab"} onClick={() => setPanel(item.id)} aria-current={panel === item.id ? "page" : undefined}><span>{item.number}</span>{item.name}</button>)}
          </nav>
          <div className="studio-panel__body">
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
              <label className="studio-field"><span>Orden de presentación</span><select value={theme.sectionOrder || "services-first"} onChange={(event) => updateTheme({ sectionOrder: event.target.value as SiteTheme["sectionOrder"] })}><option value="services-first">Servicios → Galería</option><option value="gallery-first">Galería → Servicios</option></select></label>
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
              <div className="studio-presets">{SITE_THEME_PRESETS.map((preset) => <button type="button" key={preset.id} className={theme.presetId === preset.id ? "studio-preset studio-preset--active" : "studio-preset"} onClick={() => { setTheme((current) => ({ ...current, ...preset.theme })); setMessage(null); }}><span>{[preset.theme.blue, preset.theme.red, preset.theme.yellow, preset.theme.canvas].map((color, index) => <i key={index} style={{ background: color }} />)}</span><strong>{preset.name}</strong></button>)}</div>
              <div className="studio-divider" />
              <div className="studio-row-heading"><h2>Colores personalizados</h2></div>
              <div className="studio-color-list">{THEME_KEYS.map(([key, label]) => <label className="studio-color-input" key={key}><span>{label}</span><div><input type="color" aria-label={`Elegir ${label}`} value={/^#[0-9a-f]{6}$/i.test(theme[key]) ? theme[key] : "#000000"} onChange={(event) => updateTheme({ [key]: event.target.value.toUpperCase() })}/><input aria-label={`Código de ${label}`} maxLength={7} value={theme[key]} onChange={(event) => updateTheme({ [key]: event.target.value.toUpperCase() })}/></div></label>)}</div>
              {!themeValid ? <p className="studio-validation" role="alert">La paleta necesita códigos #RRGGBB y contraste suficiente para que los botones y textos se lean correctamente.</p> : <p className="studio-small-note">Contraste validado. La previsualización usa los colores de este negocio.</p>}
            </> : null}
          </div>
        </aside>

        <section className="studio-canvas" aria-label="Vista previa en vivo de la página">
          <div className="studio-canvas__toolbar"><div><span className="studio-live-dot"/><strong>VISTA PREVIA EN VIVO</strong><small>Los cambios aún no guardados solo aparecen aquí</small></div><div className="studio-viewport" role="group" aria-label="Tamaño de pantalla"><button type="button" className={viewport === "desktop" ? "active" : ""} onClick={() => setViewport("desktop")}>Escritorio</button><button type="button" className={viewport === "mobile" ? "active" : ""} onClick={() => setViewport("mobile")}>Móvil</button></div></div>
          <div className="studio-canvas__surface">
            <div className={`studio-preview ${viewport === "mobile" ? "studio-preview--mobile" : ""}`} style={previewStyle}>
              <div className="studio-preview__header"><div className="studio-preview__brand">{logoUrl ? <div role="img" aria-label="Logo del complejo" style={{ backgroundImage: `url(${logoUrl})` }}/> : <span>◇</span>}<b>{business.name}</b></div><span>COMPLEJO DEPORTIVO</span></div>
              <div className="studio-preview__hero" style={coverImage ? { backgroundImage: `linear-gradient(90deg, rgba(9,14,25,.85), rgba(9,14,25,.37)), url(${coverImage})` } : undefined}>
                <span>CAJAMARCA · COMPLEJOS DEPORTIVOS</span>
                <h2>{theme.pageHeadline || business.name}</h2>
                <p>{theme.pageIntro || "Conoce las instalaciones y consulta directamente con el complejo antes de coordinar tu partido."}</p>
                <span className="studio-preview__fake-cta">Consultar canchas <b>↗</b></span>
              </div>
              <div className="studio-preview__meta"><span>{business.city || "Ubicación por configurar"}{business.country ? `, ${business.country}` : ""}</span><span>Diseño de página hija</span></div>
              {theme.sectionOrder === "gallery-first" ? <>{galleryPreview}{servicePreview}</> : <>{servicePreview}{galleryPreview}</>}
              <div className="studio-preview__footer"><strong>{business.name}</strong><span>Diseño conectado a Caxas SportCenter</span></div>
            </div>
          </div>
          <div className="studio-canvas__legend"><span>◈ La vista previa es una maqueta visual; la página real también incluye sus sedes, canchas, precios y contacto configurados.</span><span>{viewport === "desktop" ? "VISTA DE ESCRITORIO" : "VISTA MÓVIL"}</span></div>
        </section>
      </div>

      <footer className="studio-statusbar"><div><span className={`studio-statusbar__mark ${isDirty ? "studio-statusbar__mark--dirty" : ""}`}/><strong>{isDirty ? "Cambios sin guardar" : "Todos los cambios guardados"}</strong><small>Último guardado: {datesLabel}</small></div><div>{message ? <p role={message.tone === "error" ? "alert" : "status"} className={`studio-feedback studio-feedback--${message.tone}`}>{message.text}</p> : <p className="studio-statusbar__notice">Guardar modifica el contenido conectado al negocio. No activa negocios pendientes.</p>}<button type="button" disabled={!isDirty || saving || Boolean(uploading)} onClick={() => void save()}>{saving ? "Guardando…" : "Guardar diseño"}</button></div></footer>
    </div>
  );
}
