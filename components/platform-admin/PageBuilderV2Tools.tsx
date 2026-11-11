"use client";

import { useState } from "react";
import {
  applyPageBuilderTemplate, PAGE_BUILDER_TEMPLATES, type PageTemplateId,
} from "@/lib/platform/pageBuilderTemplates";
import {
  normalizeSiteSectionLayout, type SiteExtraSection, type SiteTheme,
} from "@/lib/siteContent";
import type { PageBuilderRevision } from "@/lib/platform/pageBuilder";

function reorder<T>(items: T[], oldIndex: number, newIndex: number) {
  if (oldIndex < 0 || newIndex < 0 || oldIndex >= items.length || newIndex >= items.length || oldIndex === newIndex) return items;
  const result = [...items];
  result.splice(newIndex, 0, result.splice(oldIndex, 1)[0]);
  return result;
}
function orderedSectionNames(theme: SiteTheme) {
  return normalizeSiteSectionLayout(theme.sectionLayout, theme.extraSections ?? []);
}
function sectionName(key: string, theme: SiteTheme) {
  if (key === "services") return "Servicios";
  if (key === "gallery") return "Galería fotográfica";
  return theme.extraSections?.find((section) => section.id === key)?.title ?? "Sección";
}

export function BuilderTemplatePanel({ theme, onChange }: { theme: SiteTheme; onChange: (next: SiteTheme) => void }) {
  return (
    <>
      <div className="studio-group-heading"><span>00 / PLANTILLAS</span><h2>Elige un punto de partida</h2><p>Cada plantilla propone colores, jerarquía y textos neutrales. Nunca sustituye tus fotos, canchas ni servicios registrados.</p></div>
      <div className="studio-template-grid">
        {PAGE_BUILDER_TEMPLATES.map((template) => {
          const preview = applyPageBuilderTemplate(theme, template.id as PageTemplateId);
          return (
            <button type="button" key={template.id} className="studio-template-card" onClick={() => onChange(preview)}>
              <span className="studio-template-card__art" style={{ background: `linear-gradient(138deg,${preview.navy},${preview.blue})` }}>
                <i style={{ background: preview.yellow }}/><b>{template.name}</b><small>SPORTCENTER</small>
              </span>
              <strong>{template.name}</strong>
              <small>{template.subtitle}</small>
              <span className="studio-template-card__action">Aplicar plantilla ↗</span>
            </button>
          );
        })}
      </div>
      <p className="studio-small-note">Aplicar una plantilla solo modifica tu vista de trabajo. Guarda el borrador y pulsa «Publicar» cuando quieras mostrar el nuevo diseño.</p>
    </>
  );
}

export function BuilderSectionsPanel({ theme, onChange, galleryUrls }: {
  theme: SiteTheme;
  onChange: (patch: Partial<SiteTheme>) => void;
  galleryUrls: Array<{ title: string; url: string }>;
}) {
  const [dragged, setDragged] = useState<string | null>(null);
  const layout = orderedSectionNames(theme);
  const extras = theme.extraSections ?? [];

  function moveSection(id: string, direction: -1 | 1) {
    const index = layout.indexOf(id);
    onChange({ sectionLayout: reorder(layout, index, index + direction) });
  }
  function newSection() {
    if (extras.length >= 8) return;
    let ordinal = 1;
    while (extras.some((item) => item.id === `content-${ordinal}`)) ordinal++;
    const id = `content-${ordinal}`;
    const extra: SiteExtraSection = {
      id, title: "Nueva sección", description: "Describe aquí la propuesta real de este complejo.",
      imageUrl: "", buttonLabel: "", buttonUrl: "", isVisible: true,
    };
    onChange({ extraSections: [...extras, extra], sectionLayout: [...layout, id] });
  }
  function patchSection(id: string, patch: Partial<SiteExtraSection>) {
    onChange({ extraSections: extras.map((item) => item.id === id ? { ...item, ...patch } : item) });
  }
  function deleteSection(id: string) {
    onChange({ extraSections: extras.filter((item) => item.id !== id), sectionLayout: layout.filter((key) => key !== id) });
  }
  return (
    <>
      <div className="studio-divider" />
      <div className="studio-group-heading"><span>ESTRUCTURA VISUAL</span><h2>Bloques de la página</h2><p>Arrastra los bloques para ordenarlos, o usa las flechas. La portada, las canchas y las reseñas quedan fijas para conservar datos reales.</p></div>
      <div className="studio-edit-list studio-block-list" aria-label="Orden de las secciones">
        {layout.map((id, index) => {
          const section = extras.find((item) => item.id === id);
          return (
            <article key={id} draggable
              onDragStart={(event) => { setDragged(id); event.dataTransfer.effectAllowed = "move"; }}
              onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
              onDrop={(event) => { event.preventDefault(); if (dragged && dragged !== id) onChange({ sectionLayout: reorder(layout, layout.indexOf(dragged), index) }); setDragged(null); }}
              onDragEnd={() => setDragged(null)}
              className={dragged === id ? "studio-block studio-block--dragging" : "studio-block"}>
              <div className="studio-block__row">
                <span aria-hidden="true" className="studio-block__handle">⠿</span>
                <div><strong>{sectionName(id, theme)}</strong><small>{section ? "Bloque de texto personalizable" : "Sección conectada a datos reales"}</small></div>
                <div className="studio-block__buttons">
                  <button type="button" disabled={index === 0} aria-label={`Subir ${sectionName(id, theme)}`} onClick={() => moveSection(id, -1)}>↑</button>
                  <button type="button" disabled={index === layout.length - 1} aria-label={`Bajar ${sectionName(id, theme)}`} onClick={() => moveSection(id, 1)}>↓</button>
                  {section ? <button type="button" aria-label="Quitar sección" onClick={() => deleteSection(id)}>×</button> : null}
                </div>
              </div>
              {section ? (
                <div className="studio-block__inspector">
                  <label className="studio-switch"><input type="checkbox" checked={section.isVisible} onChange={(event) => patchSection(id, { isVisible: event.target.checked })}/><span>Visible en la página</span></label>
                  <label className="studio-field"><span>Título</span><input maxLength={100} value={section.title} onChange={(event) => patchSection(id, { title: event.target.value })}/></label>
                  <label className="studio-field"><span>Contenido</span><textarea rows={3} maxLength={500} value={section.description} onChange={(event) => patchSection(id, { description: event.target.value })}/></label>
                  <label className="studio-field"><span>Imagen (URL https)</span><input type="url" maxLength={1200} value={section.imageUrl} placeholder="https://..." onChange={(event) => patchSection(id, { imageUrl: event.target.value })}/></label>
                  {galleryUrls.length ? (
                    <label className="studio-field"><span>O elige una imagen que ya subiste</span><select value="" onChange={(event) => { if (event.target.value) patchSection(id, { imageUrl: event.target.value }); }}><option value="">Selecciona una foto</option>{galleryUrls.map((item) => <option value={item.url} key={item.url}>{item.title}</option>)}</select></label>
                  ) : null}
                  <label className="studio-field"><span>Texto del botón (opcional)</span><input maxLength={42} value={section.buttonLabel} onChange={(event) => patchSection(id, { buttonLabel: event.target.value })}/></label>
                  <label className="studio-field"><span>Enlace del botón (solo https)</span><input type="url" maxLength={600} value={section.buttonUrl} placeholder="https://..." onChange={(event) => patchSection(id, { buttonUrl: event.target.value })}/></label>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      <button className="studio-add-block" type="button" onClick={newSection} disabled={extras.length >= 8}>+ Agregar sección de contenido ({extras.length}/8)</button>
    </>
  );
}

export function BuilderHistoryPanel({ revisions, onRestore, busy }: {
  revisions: PageBuilderRevision[];
  onRestore: (id: string) => void;
  busy: boolean;
}) {
  return (
    <>
      <div className="studio-group-heading"><span>05 / VERSIONES</span><h2>Historial de publicaciones</h2><p>Cada publicación crea una versión recuperable. Restaurar carga esa versión como borrador, sin reemplazar inmediatamente la página visible.</p></div>
      {revisions.length ? (
        <div className="studio-version-list">{revisions.map((revision, index) => (
          <article key={revision.id}>
            <div><span>VERSIÓN {revisions.length - index}</span><strong>{new Date(revision.publishedAt).toLocaleString("es-PE", { timeZone: "America/Lima", dateStyle: "medium", timeStyle: "short" })}</strong><small>Publicación guardada · ID {revision.id}</small></div>
            <button type="button" disabled={busy} onClick={() => onRestore(revision.id)}>Restaurar borrador</button>
          </article>
        ))}</div>
      ) : <div className="studio-empty-media"><strong>Sin publicaciones desde CAXAS STUDIO V2</strong><p>Las versiones aparecerán cuando publiques tu primer borrador. La primera publicación también conserva una copia del diseño público anterior.</p></div>}
      <p className="studio-small-note">Se conservan las últimas 20 versiones publicadas por negocio.</p>
    </>
  );
}
