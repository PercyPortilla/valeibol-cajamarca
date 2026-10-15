import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

const modules = {
  whatsapp: { title: "WhatsApp", phase: "Fase 8", detail: "Notificaciones oficiales y automatizaciones posteriores." },
} as const;

type ModuleKey = keyof typeof modules;

export default async function PendingAdminModule({ params }: { params: Promise<{ module: string }> }) {
  const resolved = await params;
  if (!(resolved.module in modules)) notFound();
  const moduleConfig = modules[resolved.module as ModuleKey];

  return (
    <>
      <header className="admin-topbar">
        <div><span className="eyebrow">MÓDULO ADMINISTRATIVO</span><h1>{moduleConfig.title}</h1></div>
        <Badge tone="neutral">Pendiente</Badge>
      </header>
      <Card className="admin-pending-module">
        <Badge tone="info">{moduleConfig.phase}</Badge>
        <h2>Todavía no implementado funcionalmente.</h2>
        <p>{moduleConfig.detail}</p>
        <p>No se muestran datos ficticios ni acciones simuladas como si fueran operaciones reales.</p>
      </Card>
    </>
  );
}
