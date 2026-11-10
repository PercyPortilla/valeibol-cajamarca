import { CaxasChromeBrand } from "@/components/brand/CaxasChromeBrand";

export function PlatformAdminBrand({ context = "admin" }: { context?: "admin" | "auth" }) {
  return (
    <span className={`platform-admin-brand platform-admin-brand--${context}`}>
      <span className="platform-admin-brand__copy">
        <CaxasChromeBrand tagline={context === "auth" ? "Acceso administrativo" : "Panel de negocio"} compact />
      </span>
    </span>
  );
}
