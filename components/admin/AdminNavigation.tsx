"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  ["Resumen", "/admin"],
  ["Reservas", "/admin/reservas"],
  ["Disponibilidad", "/admin/disponibilidad"],
  ["Clientes", "/admin/clientes"],
  ["Precios", "/admin/precios"],
  ["Pagos", "/admin/pagos"],
  ["Ingresos", "/admin/ingresos"],
  ["Reportes", "/admin/reportes"],
  ["Configuración", "/admin/configuracion"],
] as const;

export function AdminNavigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegación administrativa">
      {navigation.map(([label, href]) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={active ? "admin-nav-item admin-nav-item--active" : "admin-nav-item"}
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
