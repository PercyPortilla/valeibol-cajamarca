import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdminContext } from "@/lib/auth/server";
import { isLocalDevAdminUserId } from "@/lib/auth/localDev";
import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import { createSiteContentRepository } from "@/lib/data/siteContentService";
import { getAdminBusinessStructure } from "@/lib/data/inventoryService";
import { PageBuilderStudio } from "@/components/platform-admin/PageBuilderStudio";
import { parsePageBuilderState } from "@/lib/platform/pageBuilder";
import "../../../admin-global/disenar/builder.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Estudio de diseño · Mi negocio", robots: { index: false, follow: false } };

export default async function TenantPageBuilder() {
  const context = await requireAdminContext();
  if (context.role === "staff") redirect("/admin/configuracion");
  if (isLocalDevAdminUserId(context.userId)) {
    return <section className="state-box" role="note">
      <h1>Estudio de diseño</h1>
      <p>Las páginas de producción se editan cuando tu negocio tiene una sesión activa de Supabase.</p>
      <Link href="/admin/configuracion">Volver a configuración</Link>
    </section>;
  }

  const client = await createServerSupabaseClient();
  const [structure, content, state] = await Promise.all([
    getAdminBusinessStructure(),
    createSiteContentRepository({ local: false }).getAdminContent(),
    client.rpc("platform_page_builder_get_state", { p_business_id: context.businessId }),
  ]);
  if (state.error) throw new Error("No se pudo cargar el estudio de diseño. Vuelve a intentar.");

  return (
    <div className="caxas-builder tenant-builder-shell">
      <PageBuilderStudio
        mode="tenant"
        business={{
          id: context.businessId,
          name: context.businessName,
          slug: structure.slug,
          city: structure.city,
          country: structure.country,
          isActive: true,
          configurationStatus: structure.configurationStatus,
        }}
        initialContent={content}
        initialBuilderState={parsePageBuilderState(state.data)}
      />
    </div>
  );
}
