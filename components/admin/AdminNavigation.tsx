"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminRole } from "@/lib/auth";
import { Icon } from "@/components/ui/Icon";
import type { IconKey } from "@/lib/icons";

export function AdminNavigation({ unreadNotifications = 0, role }: { unreadNotifications?: number; role?: AdminRole }) {
  const pathname = usePathname();
  const sections: { heading: string; items: { label: string; href: string; icon: IconKey }[] }[] = [
    { heading: "EMPEZAR", items: [
      { label: "Resumen", href: "/admin", icon: "court" },
      ...(role !== "staff" ? [{ label: "Centro de gestión", href: "/admin/centro", icon: "check" as IconKey }] : []),
    ] },
    { heading: "OPERACIÓN DIARIA", items: [
      { label: "Disponibilidad · Pizarra", href: "/admin/disponibilidad", icon: "calendar" },
      { label: "Reservas", href: "/admin/reservas", icon: "clock" },
      { label: "Notificaciones", href: "/admin/notificaciones", icon: "check" },
      { label: "Clientes", href: "/admin/clientes", icon: "crowd" },
    ] },
    { heading: "CONTROL", items: [
      { label: "Precios", href: "/admin/precios", icon: "lighting" },
      { label: "Ingresos", href: "/admin/ingresos", icon: "ball" },
      { label: "Reportes", href: "/admin/reportes", icon: "calendar" },
      { label: "Configuración", href: "/admin/configuracion", icon: "location" },
    ] },
  ];
  if (role !== "staff") sections.push({
    heading: "MI MARCA", items: [{ label: "✦ Diseñar página", href: "/admin/disenar", icon: "court" }],
  });
  return (
    <nav aria-label="Navegación administrativa">
      {sections.map(({ heading, items }) => <div className="admin-nav-group" key={heading}>
        <span className="admin-nav-group__title">{heading}</span>
        {items.map(({ label, href, icon }) => {
          const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
          return <Link key={href} href={href}
            className={active ? "admin-nav-item admin-nav-item--active" : "admin-nav-item"}
            aria-current={active ? "page" : undefined}>
            <Icon name={icon} size={18} className="admin-nav-item__icon" />
            <span className="admin-nav-item__label">{label}</span>
            {href === "/admin/notificaciones" && unreadNotifications > 0 ? <span className="admin-nav-item__count" aria-label={`${unreadNotifications} notificaciones sin leer`}>{unreadNotifications > 99 ? "99+" : unreadNotifications}</span> : null}
          </Link>;
        })}
      </div>)}
    </nav>
  );
}
