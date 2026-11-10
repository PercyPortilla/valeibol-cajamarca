"use client";

import { usePathname } from "next/navigation";
import { CaxasChromeBrand } from "@/components/brand/CaxasChromeBrand";

type LoadingContext = "auto" | "platform" | "tenant" | "admin";

export function RouteLoading({ context = "auto" }: { context?: LoadingContext }) {
  const pathname = usePathname();
  const variant = context !== "auto" ? context
    : pathname?.startsWith("/complejo/") ? "tenant"
      : pathname?.startsWith("/admin") ? "admin" : "platform";
  const label = variant === "tenant" ? "Preparando el complejo deportivo"
    : variant === "admin" ? "Preparando el espacio de administración"
      : "Preparando tu experiencia deportiva";

  return (
    <main className={`caxas-route-loading caxas-route-loading--${variant}`} aria-label={label} role="status" aria-live="polite" aria-busy="true">
      <div className="caxas-route-loading__shell">
        <div className="caxas-route-loading__brand">
          {variant === "platform" ? <CaxasChromeBrand compact /> : (
            <span className="caxas-route-loading__context">{variant === "tenant" ? "COMPLEJO DEPORTIVO" : "ÁREA PRIVADA"}</span>
          )}
          <small>{label}…</small>
        </div>
        <div className="caxas-route-loading__content" aria-hidden="true">
          <div className="caxas-route-loading__copy">
            <span className="caxas-route-loading__line caxas-route-loading__line--short" />
            <span className="caxas-route-loading__line caxas-route-loading__line--headline" />
            <span className="caxas-route-loading__line caxas-route-loading__line--headline-small" />
            <span className="caxas-route-loading__line caxas-route-loading__line--medium" />
            <span className="caxas-route-loading__line caxas-route-loading__line--long" />
          </div>
          <div className="caxas-route-loading__scene">
            <span className="caxas-route-loading__scene-ring" />
            <span className="caxas-route-loading__scene-mark" />
            <span className="caxas-route-loading__scene-track" />
          </div>
        </div>
        <div className="caxas-route-loading__bottom" aria-hidden="true">
          <span /><span /><span />
        </div>
      </div>
    </main>
  );
}
