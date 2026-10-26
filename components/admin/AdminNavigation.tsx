"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNavigation({ unreadNotifications = 0 }: { unreadNotifications?: number }) {
  const pathname = usePathname();
  const items = [
    ["Resumen", "/admin"],
    ["Reservas", "/admin/reservas"],
    ["Notificaciones", "/admin/notificaciones"],
    ["Disponibilidad", "/admin/disponibilidad"],
    ["Clientes", "/admin/clientes"],
    ["Precios", "/admin/precios"],
    ["Ingresos", "/admin/ingresos"],
    ["Reportes", "/admin/reportes"],
    ["Configuración", "/admin/configuracion"],
  ] as const;
  return (
    <nav aria-label="Navegación administrativa">
      {items.map(([label, href]) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={active ? "admin-nav-item admin-nav-item--active" : "admin-nav-item"}
            aria-current={active ? "page" : undefined}
          >
            <span>{label}</span>
            {href === "/admin/notificaciones" && unreadNotifications > 0 ? <span className="admin-nav-item__count" aria-label={`${unreadNotifications} notificaciones sin leer`}>{unreadNotifications > 99 ? "99+" : unreadNotifications}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
