import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { requireAdminContext } from "@/lib/auth/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Panel del propietario",
  robots: { index: false, follow: false },
};

const ownerSections = [
  ["Agenda y disponibilidad", "Controla horarios, bloqueos y operación diaria.", "/admin/disponibilidad"],
  ["Reservas", "Revisa solicitudes, confirma, cancela y consulta historial.", "/admin/reservas"],
  ["Clientes", "Consulta clientes e historial privado del negocio.", "/admin/clientes"],
  ["Precios", "Administra tarifas y vigencias por cancha.", "/admin/precios"],
  ["Actividad y reportes", "Revisa ocupación, valor operativo y exportaciones.", "/admin/reportes"],
  ["Configuración", "Contenido público, cuenta y accesos administrativos.", "/admin/configuracion"],
  ["Negocio, sedes y canchas", "Gestiona la estructura real, ubicación, deportes, horarios iniciales y estado de tus canchas.", "/admin/configuracion/estructura"],
] as const;

export default async function OwnerPortalPage() {
  const context = await requireAdminContext();
  if (context.role === "staff") redirect("/admin");

  return (
    <main className="owner-portal">
      <div className="shell owner-portal__inner">
        <div className="owner-portal__top">
          <Link href="/buscar" className="owner-portal__back">← Volver a la plataforma</Link>
          <Badge tone="success">{context.roleLabel}</Badge>
        </div>
        <header className="owner-portal__hero">
          <span className="eyebrow">{context.isPlatformAdmin ? "SUPERVISIÓN DEL NEGOCIO" : "PANEL DEL PROPIETARIO"}</span>
          <h1>{context.businessName}</h1>
          <p>{context.isPlatformAdmin ? "Estás entrando con supervisión global al panel operativo de este negocio." : "Accede a las herramientas operativas ya validadas del negocio sin duplicar la lógica administrativa."}</p>
          <p>Las coordinaciones adicionales con cada cliente se realizan directamente por WhatsApp desde el flujo de reservas.</p>
          <Link className="button button--primary" href="/admin">Abrir resumen operativo</Link>
        </header>
        <section className="owner-portal__grid" aria-label="Herramientas del propietario">
          {ownerSections.map(([title, description, href]) => (
            <Card className="owner-portal__card" key={href}>
              <h2>{title}</h2>
              <p>{description}</p>
              <Link href={href}>Abrir <span aria-hidden="true">→</span></Link>
            </Card>
          ))}
        </section>
        <p className="owner-portal__note">Cada propietario administra únicamente su propio negocio. La administración principal de Caxas SportCenter puede supervisar cualquier negocio seleccionándolo explícitamente desde el panel global.</p>
      </div>
    </main>
  );
}
