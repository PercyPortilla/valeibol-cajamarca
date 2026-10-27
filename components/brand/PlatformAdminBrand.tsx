import { platformConfig } from "@/config/platform";

export function PlatformAdminBrand({ context = "admin" }: { context?: "admin" | "auth" }) {
  return (
    <span className={`platform-admin-brand platform-admin-brand--${context}`}>
      <span className="platform-admin-brand__copy">
        <strong>{platformConfig.name}</strong>
        <small>{context === "auth" ? "Acceso administrativo" : "Panel de negocio"}</small>
      </span>
    </span>
  );
}
