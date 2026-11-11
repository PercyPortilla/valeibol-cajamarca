import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminContext } from "@/lib/auth/server";
import { isLocalDevAdminUserId } from "@/lib/auth/localDev";
import { getAdminBusinessStructure } from "@/lib/data/inventoryService";
import { createPhase7Repository } from "@/lib/data/phase7Service";
import { createSiteContentRepository } from "@/lib/data/siteContentService";
import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import { businessTodayDateKey } from "@/lib/availability";
import { parsePageBuilderState } from "@/lib/platform/pageBuilder";
import { CaxasBusinessWorkspace } from "@/components/admin/CaxasBusinessWorkspace";
import "../../../admin-global/disenar/builder.css";
import "./workspace.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Centro de gestión · CAXAS", robots: { index: false, follow: false } };

export default async function CaxasBusinessCenterPage() {
  const context = await requireAdminContext();
  if (context.role === "staff") redirect("/admin");
  if (isLocalDevAdminUserId(context.userId)) {
    return <div className="state-box" role="note"><h1>Centro de gestión</h1>
      <p>Este centro usa datos operativos reales de Supabase. El modo demo continúa disponible en el panel.</p>
      <Link href="/admin">Volver al resumen</Link></div>;
  }

  // Cada consulta se realiza con la sesión y el negocio seleccionado ya autorizados.
  // El navegador nunca elige otro business_id para las RPC operativas.
  const [structureState, pricingState, contentState, builderState] = await Promise.allSettled([
    getAdminBusinessStructure(),
    createPhase7Repository({ local: false }).listPricingRules(),
    createSiteContentRepository({ local: false }).getAdminContent(),
    createServerSupabaseClient().then((client) => client.rpc("platform_page_builder_get_state", { p_business_id: context.businessId })),
  ]);
  if (structureState.status !== "fulfilled") {
    return <div className="state-box state-box--error" role="alert"><strong>No pudimos cargar las sedes y canchas.</strong>
      <p>El centro no habilita cambios con datos incompletos. Recarga la página y vuelve a intentarlo.</p></div>;
  }
  const structure = structureState.value;
  if (structure.businessId !== context.businessId) {
    throw new Error("El negocio de la sesión no coincide con la estructura solicitada.");
  }
  const builderAvailable = contentState.status === "fulfilled" && builderState.status === "fulfilled" && !builderState.value.error;

  return <CaxasBusinessWorkspace
    context={context}
    structure={structure}
    businessToday={businessTodayDateKey(new Date(), context.timezone)}
    pricingRules={pricingState.status === "fulfilled" ? pricingState.value : null}
    studioData={builderAvailable && contentState.status === "fulfilled" && builderState.status === "fulfilled"
      ? { content: contentState.value, state: parsePageBuilderState(builderState.value.data) }
      : null}
  />;
}
