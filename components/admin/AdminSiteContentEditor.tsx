"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSiteContentAction, type AdminActionResult } from "@/app/admin/(protected)/actions";
import { Icon } from "@/components/ui/Icon";
import type { AdminRole } from "@/lib/auth";
import { SERVICE_ICON_OPTIONS, type ServiceIconKey } from "@/lib/icons";
import {
  DEFAULT_SITE_SERVICES,
  SITE_THEME_PRESETS,
  isAccessibleSiteTheme,
  isValidSiteThemeInput,
  normalizeSiteTheme,
  themeCssVariables,
  type SiteContent,
  type SiteGalleryItem,
  type SiteService,
  type SiteTheme,
} from "@/lib/siteContent";

function resequence<T extends { sortOrder: number }>(items: T[]) {
  return items.map((item, index) => ({ ...item, sortOrder: (index + 1) * 10 }));
}

function move<T extends { sortOrder: number }>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = items.slice();
  [next[index], next[target]] = [next[target], next[index]];
  return resequence(next);
}

export function AdminSiteContentEditor({ content, role, localMode }: { content: SiteContent; role: AdminRole; localMode: boolean }) {
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState(content.logoUrl);
  const [services, setServices] = useState(content.services);
  const [gallery, setGallery] = useState(content.gallery);
  const [theme, setTheme] = useState(content.theme);
  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const canManage = role === "owner" || role === "admin";
  const normalizedTheme = normalizeSiteTheme(theme);
  const themeIsValid = isValidSiteThemeInput(theme) && isAccessibleSiteTheme(normalizedTheme);

  useEffect(() => {
    if (!canManage) return;
    const shell = document.querySelector<HTMLElement>(".admin-shell");
    if (!shell) return;

    const variables = themeCssVariables(normalizeSiteTheme(theme));
    const previous = new Map<string, string>();
    Object.entries(variables).forEach(([name, value]) => {
      previous.set(name, shell.style.getPropertyValue(name));
      shell.style.setProperty(name, value);
    });

    return () => {
      previous.forEach((value, name) => {
        if (value) shell.style.setProperty(name, value);
        else shell.style.removeProperty(name);
      });
    };
  }, [canManage, theme]);

  function patchService(index: number, patch: Partial<SiteService>) {
    setServices((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function patchGallery(index: number, patch: Partial<SiteGalleryItem>) {
    setGallery((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function patchTheme(patch: Partial<SiteTheme>) {
    setTheme((current) => ({ ...current, ...patch, presetId: patch.presetId ?? "custom" }));
  }

  function addService() {
    setServices((current) => [...current, {
      id: `service-${Date.now()}`,
      icon: "ball",
      title: "Nuevo servicio",
      description: "Describe brevemente qué incluye este servicio.",
      sortOrder: (current.length + 1) * 10,
      isVisible: true,
    }]);
  }

  function addGalleryItem() {
    setGallery((current) => [...current, {
      id: `gallery-${Date.now()}`,
      title: "Nueva foto",
      imageUrl: "",
      altText: "Foto de las instalaciones de Valeibol",
      sortOrder: (current.length + 1) * 10,
      isVisible: true,
    }]);
  }

  function save() {
    setResult(null);
    startTransition(async () => {
      const next = await updateSiteContentAction({ logoUrl, services: resequence(services), gallery: resequence(gallery), theme });
      setResult(next);
      if (next.ok) {
        setServices((current) => resequence(current));
        setGallery((current) => resequence(current));
        router.refresh();
      }
    });
  }

  async function uploadLogo(file: File | null) {
    if (!file) return;
    setResult(null);
    setUploadingLogo(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/site-media", { method: "POST", body });
      const payload = await response.json() as { ok?: boolean; url?: string; message?: string };
      if (!response.ok || !payload.url) {
        setResult({ ok: false, code: "network", message: payload.message ?? "No pudimos subir el logo." });
        return;
      }
      setLogoUrl(payload.url);
      setResult({ ok: true, message: "Logo subido. Guarda el contenido para publicarlo en Caxas SportCenter." });
    } catch {
      setResult({ ok: false, code: "network", message: "No pudimos subir el logo." });
    } finally {
      setUploadingLogo(false);
    }
  }

  async function uploadPhoto(index: number, file: File | null) {
    if (!file) return;
    setResult(null);
    setUploadingIndex(index);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/site-media", { method: "POST", body });
      const payload = await response.json() as { ok?: boolean; url?: string; message?: string };
      if (!response.ok || !payload.url) {
        setResult({ ok: false, code: "network", message: payload.message ?? "No pudimos subir la foto." });
        return;
      }
      patchGallery(index, { imageUrl: payload.url });
      setResult({ ok: true, message: "Foto subida. Guarda el contenido para publicarla en la galería." });
    } catch {
      setResult({ ok: false, code: "network", message: "No pudimos subir la foto." });
    } finally {
      setUploadingIndex(null);
    }
  }

  if (!canManage) {
    return <div className="phase7-permission-note"><strong>Solo lectura</strong><span>Tu rol puede consultar el contenido, pero solo owner y admin pueden modificarlo.</span></div>;
  }

  return (
    <div className="admin-content-editor">
      <section className="admin-content-editor__section" aria-labelledby="brand-logo-editor-title">
        <div className="admin-content-editor__head">
          <div>
            <span className="metric-label">LOGO DEL NEGOCIO</span>
            <h2 id="brand-logo-editor-title">Identidad en Caxas SportCenter</h2>
            <p>Este logo aparecerá en la tarjeta de tu complejo dentro de la plataforma general.</p>
          </div>
        </div>
        <div className="admin-business-logo-editor">
          <div
            className={logoUrl ? "admin-business-logo-editor__preview admin-business-logo-editor__preview--image" : "admin-business-logo-editor__preview"}
            style={logoUrl ? { backgroundImage: `url(${logoUrl})` } : undefined}
            role="img"
            aria-label="Vista previa del logo del negocio"
          >
            {!logoUrl ? <span>Sin logo</span> : null}
          </div>
          <div className="admin-business-logo-editor__fields">
            <label className="field">
              <span className="field__label">URL pública del logo</span>
              <input className="field__control" type="url" inputMode="url" placeholder="https://..." value={logoUrl} maxLength={1200} onChange={(event) => setLogoUrl(event.target.value)} />
            </label>
            <label className="field admin-gallery-editor__upload">
              <span className="field__label">Subir logo</span>
              <input className="field__control" type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploadingLogo || uploadingIndex !== null} onChange={(event) => void uploadLogo(event.target.files?.[0] ?? null)} />
              <small>{uploadingLogo ? "Subiendo…" : localMode ? "En localhost el archivo se guarda solo en esta copia de desarrollo." : "JPG, PNG, WebP o AVIF · máximo 8 MB"}</small>
            </label>
            {logoUrl ? <button className="button button--ghost" type="button" onClick={() => setLogoUrl("")}>Quitar logo</button> : null}
          </div>
        </div>
      </section>

      <section className="admin-content-editor__section" aria-labelledby="services-editor-title">
        <div className="admin-content-editor__head">
          <div>
            <span className="metric-label">SERVICIOS INCLUIDOS</span>
            <h2 id="services-editor-title">Servicios visibles en la web</h2>
            <p>Puedes editar texto, icono, orden y visibilidad. Los servicios confirmados ya vienen cargados.</p>
          </div>
          <div className="admin-content-editor__actions">
            <button className="button button--ghost" type="button" onClick={() => setServices(DEFAULT_SITE_SERVICES.map((item) => ({ ...item })))}>Restaurar base</button>
            <button className="button button--secondary" type="button" onClick={addService} disabled={services.length >= 24}>Agregar servicio</button>
          </div>
        </div>

        <div className="admin-service-editor-list">
          {services.map((service, index) => (
            <article className="admin-service-editor" key={service.id}>
              <div className="admin-service-editor__order" aria-label={`Orden de ${service.title}`}>
                <button type="button" onClick={() => setServices((items) => move(items, index, -1))} disabled={index === 0} aria-label={`Subir ${service.title}`}>↑</button>
                <button type="button" onClick={() => setServices((items) => move(items, index, 1))} disabled={index === services.length - 1} aria-label={`Bajar ${service.title}`}>↓</button>
              </div>
              <label className="field admin-service-editor__icon">
                <span className="field__label">Icono</span>
                <span className="admin-icon-select">
                  <Icon name={service.icon} size={20} />
                  <select className="field__control" value={service.icon} onChange={(event) => patchService(index, { icon: event.target.value as ServiceIconKey })}>
                    {SERVICE_ICON_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                  </select>
                </span>
              </label>
              <label className="field"><span className="field__label">Nombre</span><input className="field__control" value={service.title} maxLength={80} onChange={(event) => patchService(index, { title: event.target.value })} /></label>
              <label className="field admin-service-editor__description"><span className="field__label">Descripción</span><input className="field__control" value={service.description} maxLength={220} onChange={(event) => patchService(index, { description: event.target.value })} /></label>
              <label className="admin-content-toggle"><input type="checkbox" checked={service.isVisible} onChange={(event) => patchService(index, { isVisible: event.target.checked })} /><span>Visible</span></label>
              <button className="button button--danger-soft admin-content-remove" type="button" onClick={() => setServices((items) => resequence(items.filter((_, itemIndex) => itemIndex !== index)))} disabled={services.length <= 1}>Quitar</button>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-content-editor__section" aria-labelledby="gallery-editor-title">
        <div className="admin-content-editor__head">
          <div>
            <span className="metric-label">GALERÍA</span>
            <h2 id="gallery-editor-title">Fotos de la web</h2>
            <p>Sube una foto desde el panel o usa una URL pública. Define su texto alternativo y decide si se muestra.</p>
          </div>
          <button className="button button--secondary" type="button" onClick={addGalleryItem} disabled={gallery.length >= 16}>Agregar foto</button>
        </div>

        <div className="admin-gallery-editor-grid">
          {gallery.map((item, index) => (
            <article className="admin-gallery-editor" key={item.id}>
              <div className={item.imageUrl ? "admin-gallery-editor__preview admin-gallery-editor__preview--image" : "admin-gallery-editor__preview"} style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : undefined} role="img" aria-label={item.altText || item.title}>
                {!item.imageUrl ? <span>Sin foto</span> : null}
              </div>
              <label className="field"><span className="field__label">Título</span><input className="field__control" value={item.title} maxLength={100} onChange={(event) => patchGallery(index, { title: event.target.value })} /></label>
              <label className="field"><span className="field__label">URL pública de la foto</span><input className="field__control" type="url" inputMode="url" placeholder="https://..." value={item.imageUrl} maxLength={1200} onChange={(event) => patchGallery(index, { imageUrl: event.target.value })} /></label>
              <label className="field admin-gallery-editor__upload">
                <span className="field__label">Subir archivo</span>
                <input className="field__control" type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploadingIndex !== null} onChange={(event) => void uploadPhoto(index, event.target.files?.[0] ?? null)} />
                <small>{uploadingIndex === index ? "Subiendo…" : localMode ? "En localhost la foto se guarda solo en esta copia de desarrollo y no se sube a Supabase." : "JPG, PNG, WebP o AVIF · máximo 8 MB"}</small>
              </label>
              <label className="field"><span className="field__label">Texto alternativo</span><input className="field__control" value={item.altText} maxLength={180} onChange={(event) => patchGallery(index, { altText: event.target.value })} /></label>
              <div className="admin-gallery-editor__footer">
                <div className="admin-service-editor__order">
                  <button type="button" onClick={() => setGallery((items) => move(items, index, -1))} disabled={index === 0} aria-label={`Subir ${item.title}`}>↑</button>
                  <button type="button" onClick={() => setGallery((items) => move(items, index, 1))} disabled={index === gallery.length - 1} aria-label={`Bajar ${item.title}`}>↓</button>
                </div>
                <label className="admin-content-toggle"><input type="checkbox" checked={item.isVisible} onChange={(event) => patchGallery(index, { isVisible: event.target.checked })} /><span>Visible</span></label>
                <button className="button button--danger-soft" type="button" onClick={() => setGallery((items) => resequence(items.filter((_, itemIndex) => itemIndex !== index)))}>Quitar</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-content-editor__section" aria-labelledby="theme-editor-title">
        <div className="admin-content-editor__head">
          <div>
            <span className="metric-label">IDENTIDAD VISUAL</span>
            <h2 id="theme-editor-title">Paleta de colores</h2>
            <p>Elige una base de Mi Valeibol o ajusta cada color. La vista del panel cambia en vivo; al guardar, la misma paleta se publica para clientes y staff.</p>
          </div>
        </div>

        <div className="admin-theme-presets" role="group" aria-label="Paletas predefinidas">
          {SITE_THEME_PRESETS.map((preset) => (
            <button
              className={theme.presetId === preset.id ? "admin-theme-preset admin-theme-preset--active" : "admin-theme-preset"}
              type="button"
              key={preset.id}
              onClick={() => setTheme({ ...preset.theme })}
            >
              <span className="admin-theme-preset__swatches" aria-hidden="true">
                {[preset.theme.navy, preset.theme.blue, preset.theme.red, preset.theme.yellow, preset.theme.canvas].map((color) => (
                  <i key={color} style={{ background: color }} />
                ))}
              </span>
              <strong>{preset.name}</strong>
              <small>{preset.description}</small>
            </button>
          ))}
        </div>

        <div className="admin-theme-colors">
          {([
            ["navy", "Azul marino"],
            ["blue", "Azul principal"],
            ["blueDark", "Azul oscuro"],
            ["red", "Rojo principal"],
            ["redDark", "Rojo oscuro"],
            ["yellow", "Amarillo"],
            ["canvas", "Fondo general"],
          ] as const).map(([key, label]) => (
            <label className="admin-theme-color" key={key}>
              <span>{label}</span>
              <span className="admin-theme-color__controls">
                <input type="color" value={theme[key]} onChange={(event) => patchTheme({ [key]: event.target.value.toUpperCase() } as Partial<SiteTheme>)} aria-label={`Elegir ${label}`} />
                <input className="field__control" value={theme[key]} maxLength={7} pattern="^#[0-9A-Fa-f]{6}$" onChange={(event) => patchTheme({ [key]: event.target.value.toUpperCase() } as Partial<SiteTheme>)} />
              </span>
            </label>
          ))}
        </div>
        {!themeIsValid ? (
          <div className="admin-action-message admin-action-message--error" role="alert">
            Revisa la paleta: usa colores completos en formato #RRGGBB y suficiente contraste para que textos y botones sigan siendo legibles.
          </div>
        ) : null}
      </section>

      <div className="admin-content-editor__savebar">
        <div>
          <strong>{localMode ? "Modo local" : "Contenido conectado"}</strong>
          <span>{localMode ? "Los cambios duran mientras siga activo este servidor local." : "Al guardar, la web pública leerá la nueva configuración."}</span>
        </div>
        {result ? <div className={result.ok ? "admin-action-message admin-action-message--success" : "admin-action-message admin-action-message--error"} role={result.ok ? "status" : "alert"}>{result.message}</div> : null}
        <button className="button button--primary" type="button" onClick={save} disabled={pending || !themeIsValid}>{pending ? "Guardando…" : "Guardar contenido"}</button>
      </div>
    </div>
  );
}

