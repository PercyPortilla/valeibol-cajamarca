import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { hasWhatsAppServerConfig } from "@/lib/whatsapp/cloudApi";

const transactionalFlows = [
  ["Nueva solicitud", "Avisa al negocio cuando entra una solicitud pública pendiente."],
  ["Reserva confirmada", "Avisa al cliente cuando un operador confirma su reserva."],
  ["Reserva cancelada", "Avisa al cliente cuando una reserva activa se cancela."],
  ["Recordatorio", "Prepara un aviso transaccional aproximadamente 24 h antes de una reserva confirmada."],
] as const;

export default function AdminWhatsAppPage() {
  const configured = hasWhatsAppServerConfig();

  return (
    <>
      <header className="admin-topbar">
        <div>
          <span className="eyebrow">MENSAJERÍA TRANSACCIONAL</span>
          <h1>WhatsApp</h1>
          <p className="admin-subtitle">
            Integración oficial preparada para notificaciones de reservas. Las credenciales y templates viven únicamente en servidor.
          </p>
        </div>
        <Badge tone={configured ? "success" : "warning"}>
          {configured ? "API configurada" : "Pendiente de credenciales"}
        </Badge>
      </header>

      <div className="admin-status-grid">
        {transactionalFlows.map(([title, detail]) => (
          <Card className="admin-status-card" key={title}>
            <span className="metric-label">{title}</span>
            <strong>{configured ? "Preparado" : "En espera"}</strong>
            <small>{detail}</small>
          </Card>
        ))}
      </div>

      <Card className="admin-board admin-readonly-callout">
        <div>
          <Badge tone="info">Sin campañas masivas</Badge>
          <h2>Outbox seguro e idempotente</h2>
          <p>
            La reserva es la fuente de verdad. Si WhatsApp falla, la reserva no se revierte ni se pierde.
            El procesador reintenta de forma controlada y no expone teléfonos, nombres ni tokens al navegador.
          </p>
        </div>
        <Badge tone={configured ? "success" : "neutral"}>
          {configured ? "Listo para procesador" : "Configura Meta antes de activar"}
        </Badge>
      </Card>
    </>
  );
}
