"use client";

import { useState } from "react";
import Link from "next/link";
import type { AdminContext } from "@/lib/auth/server";
import type { AdminBusinessStructure } from "@/lib/admin/inventory";
import type { AdminPricingRule } from "@/lib/admin/phase7";
import { formatMoney } from "@/lib/admin/reservations";
import type { SiteContent } from "@/lib/siteContent";
import type { PageBuilderState } from "@/lib/platform/pageBuilder";
import { PageBuilderStudio } from "@/components/platform-admin/PageBuilderStudio";
import { AdminBusinessStructureManager } from "@/components/admin/AdminBusinessStructureManager";
import { AdminPricingForm } from "@/components/admin/AdminPricingForm";
import { GlobalBusinessTeamPanel } from "@/components/platform-admin/GlobalBusinessTeamPanel";
import { AdminAccessManagement } from "@/components/admin/AdminAccessManagement";
import { CaxasGlobalBusinessCore } from "@/components/admin/CaxasGlobalBusinessCore";

type Section = "resumen" | "diseno" | "estructura" | "precios" | "equipo" | "operacion";
const SECTIONS: { id: Section; label: string; hint: string }[] = [
  { id: "resumen", label: "Inicio", hint: "Qué falta" },
  { id: "estructura", label: "Sedes y canchas", hint: "Horarios y publicación" },
  { id: "precios", label: "Precios", hint: "Tarifas reales" },
  { id: "diseno", label: "Diseñar página", hint: "Identidad propia" },
  { id: "equipo", label: "Personas", hint: "Accesos individuales" },
  { id: "operacion", label: "Operación", hint: "Pizarra y reservas" },
];

export function CaxasBusinessWorkspace({ context, structure, businessToday, pricingRules, studioData }: {
  context: AdminContext;
  structure: AdminBusinessStructure;
  businessToday: string;
  pricingRules: AdminPricingRule[] | null;
  studioData: { content: SiteContent; state: PageBuilderState } | null;
}) {
  const [section, setSection] = useState<Section>("resumen");
  const isManager = context.role === "owner" || context.role === "admin";
  const prerequisites = [
    { label: "Sede activa", ready: structure.publicationReadiness.hasActiveVenue, target: "estructura" as Section },
    { label: "Cancha operativa", ready: structure.publicationReadiness.hasActiveCourt, target: "estructura" as Section },
    { label: "Horario y ambas tarifas vigentes", ready: structure.publicationReadiness.activeCourtsReady && structure.publicationReadiness.hasActiveCourt, target: "estructura" as Section },
  ];
  const done = prerequisites.filter((item) => item.ready).length;
  const courts = structure.venues.flatMap((venue) => venue.courts.map((court) => ({ id: court.courtId, name: court.name })));

  return <div className="caxas-workspace">
    <header className="caxas-workspace__hero">
      <div>
        <span className="caxas-workspace__eyebrow">{context.isPlatformAdmin ? "SUPERVISIÓN GLOBAL /" : "MI NEGOCIO /"} CENTRO DE GESTIÓN</span>
        <h1>{structure.name}</h1>
        <p>Configura, diseña y publica desde un solo espacio. La página conserva las funciones operativas de Caxas, con imagen y contenido exclusivos de este negocio.</p>
      </div>
      <div className="caxas-workspace__status">
        <strong>{structure.configurationStatus === "confirmed" ? "Negocio publicado" : "Negocio en preparación"}</strong>
        <small>{structure.venues.length} sede(s) · {courts.length} cancha(s) · {structure.currency}</small>
        <Link href={`/complejo/${encodeURIComponent(structure.slug)}`} target="_blank">Ver página pública ↗</Link>
      </div>
    </header>
    <nav className="caxas-workspace__tabs" aria-label="Áreas del centro de gestión">
      {SECTIONS.map((item) => <button key={item.id} type="button"
        aria-current={section === item.id ? "page" : undefined}
        className={section === item.id ? "caxas-workspace__tab caxas-workspace__tab--active" : "caxas-workspace__tab"}
        onClick={() => setSection(item.id)}>
        <strong>{item.label}</strong><span>{item.hint}</span>
      </button>)}
    </nav>

    <div hidden={section !== "resumen"} className="caxas-workspace__panel">
      <div className="caxas-workspace__section-head"><span>01 / RUTA DE PUBLICACIÓN</span><h2>Todo el negocio, en orden y sin laberintos.</h2>
        <p>La apariencia se publica desde Diseño; la disponibilidad comercial se habilita cuando el inventario cumple los requisitos y publicas el negocio.</p></div>
      <div className="caxas-workspace__progress">
        <div><strong>{done} de 3 requisitos operativos</strong><span>{structure.configurationStatus === "confirmed" ? "Publicado" : "Pendiente de publicación"}</span></div>
        <div className="caxas-workspace__progress-track" aria-label={`${done} de 3 requisitos`}><span style={{ width: `${done / 3 * 100}%` }}/></div>
      </div>
      <div className="caxas-workspace__steps">
        {prerequisites.map((item, index) => <button type="button" key={item.label} onClick={() => setSection(item.target)}>
          <b>{item.ready ? "✓" : String(index + 1).padStart(2,"0")}</b>
          <strong>{item.label}</strong><small>{item.ready ? "Listo" : "Completar aquí"}</small>
        </button>)}
      </div>
      <div className="caxas-workspace__quick">
        <button type="button" onClick={() => setSection("estructura")}><strong>Configurar instalaciones</strong><span>Datos, sedes, canchas, horarios y botón de publicación</span></button>
        <button type="button" onClick={() => setSection("diseno")}><strong>Diseñar identidad</strong><span>Plantillas, contenidos, fotografía, borrador e historial</span></button>
        <button type="button" onClick={() => setSection("equipo")}><strong>Gestionar personas</strong><span>Invitaciones y roles con acceso por negocio</span></button>
        <button type="button" onClick={() => setSection("operacion")}><strong>Gestionar reservas</strong><span>Pizarra, clientes, notificaciones y reportes reales</span></button>
      </div>
    </div>

    <div hidden={section !== "estructura"} className="caxas-workspace__panel">
      <div className="caxas-workspace__section-head"><span>02 / CONFIGURACIÓN REAL</span><h2>Sedes, canchas, horarios y publicación</h2><p>No necesitas cambiar de pantalla: agrega las canchas y sus dos tarifas iniciales, administra horarios y publica cuando estén listas.</p></div>
      {context.isPlatformAdmin ? <CaxasGlobalBusinessCore structure={structure} /> : null}
      <AdminBusinessStructureManager structure={structure} businessToday={businessToday} canManage={isManager} localMode={false}/>
    </div>

    <div hidden={section !== "precios"} className="caxas-workspace__panel">
      <div className="caxas-workspace__section-head"><span>03 / TARIFAS</span><h2>Precios por cancha y modalidad</h2><p>Los cambios se versionan. Nunca alteran tarifas históricas de reservas existentes.</p></div>
      {pricingRules === null ? <div className="state-box state-box--error" role="alert">No pudimos consultar los precios. La edición queda deshabilitada hasta actualizar el centro.</div> :
        courts.length === 0 ? <div className="caxas-workspace__empty"><strong>Primero registra una cancha.</strong><p>La nueva cancha recibirá horarios y tarifas iniciales en un solo formulario.</p><button className="button button--primary" onClick={() => setSection("estructura")}>Ir a sedes y canchas</button></div> : <>
          <div className="caxas-workspace__tariffs">{pricingRules.length ? pricingRules.map((rule) =>
            <article key={rule.id}><small>{rule.courtName} · {rule.lighting === "with_lights" ? "Con luz" : "Sin luz"}</small>
              <strong>{formatMoney(rule.hourlyRate, rule.currency)}</strong>
              <span>Desde {rule.effectiveFrom}{rule.effectiveUntil ? ` · Hasta ${rule.effectiveUntil}` : ""}</span>
            </article>) : <p>No hay reglas registradas. Configura la tarifa inicial de una cancha existente.</p>}</div>
          <AdminPricingForm rules={pricingRules} role={context.role} courts={courts} businessToday={businessToday} businessCurrency={structure.currency} />
          <p className="caxas-workspace__fineprint">Para consultar el historial detallado de vigencias continúa disponible el módulo de Precios.</p>
        </>}
    </div>

    <div hidden={section !== "diseno"} className="caxas-workspace__panel caxas-workspace__panel--studio">
      {studioData ? <div className="caxas-builder caxas-builder--embedded"><PageBuilderStudio mode="workspace" business={{
        id: structure.businessId, name: structure.name, slug: structure.slug, city: structure.city,
        country: structure.country, isActive: true, configurationStatus: structure.configurationStatus,
      }} initialContent={studioData.content} initialBuilderState={studioData.state}/></div> :
        <div className="state-box state-box--error" role="alert"><strong>El estudio no está disponible.</strong><p>Comprueba la conexión. Las instalaciones y tarifas pueden seguir administrándose sin modificar el diseño publicado.</p></div>}
    </div>

    <div hidden={section !== "equipo"} className="caxas-workspace__panel">
      <div className="caxas-workspace__section-head"><span>05 / PERSONAS</span><h2>Equipo y accesos personales</h2><p>Cada propietario o empleado entra con su propia cuenta. Nunca compartas la sesión global.</p></div>
      {context.isPlatformAdmin ? <GlobalBusinessTeamPanel businessId={structure.businessId} businessName={structure.name} /> :
        context.role === "owner" ? <AdminAccessManagement currentUserId={context.userId} businessName={structure.name} localMode={false} /> :
        <div className="state-box" role="note">Solo el propietario gestiona el equipo del negocio; los administradores globales disponen de su propio panel.</div>}
    </div>

    <div hidden={section !== "operacion"} className="caxas-workspace__panel">
      <div className="caxas-workspace__section-head"><span>06 / HERRAMIENTAS QUE SE CONSERVAN</span><h2>Operación compartida, marca independiente</h2><p>Todos los negocios usan el sistema real de Valeibol como base funcional; cada uno conserva sus propias canchas, reservas, clientes, tarifas, horarios y permisos.</p></div>
      <div className="caxas-workspace__quick">
        <Link href="/admin/disponibilidad"><strong>Pizarra semanal ↗</strong><span>Agenda, disponibilidad y bloqueos</span></Link>
        <Link href="/admin/reservas"><strong>Reservas ↗</strong><span>Solicitudes, confirmaciones y cambios</span></Link>
        <Link href="/admin/clientes"><strong>Clientes ↗</strong><span>Historial y fichas privadas</span></Link>
        <Link href="/admin/notificaciones"><strong>Notificaciones ↗</strong><span>Actividad del negocio</span></Link>
        <Link href="/admin/reportes"><strong>Reportes ↗</strong><span>Indicadores de actividad real</span></Link>
        <Link href="/admin/configuracion"><strong>Configuración avanzada ↗</strong><span>Seguridad de cuenta y ajustes existentes</span></Link>
      </div>
      <p className="caxas-workspace__fineprint">La plataforma no acredita cobros online. La coordinación económica sigue realizándose por los canales propios del complejo.</p>
    </div>
  </div>;
}
