import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { PlatformAdminAuthError } from "@/lib/auth/platformAdmin";
import { validPlatformBusinessId } from "@/lib/auth/platformScope";
import { loadPageBuilder, PageBuilderError } from "@/lib/platform/pageBuilder";
import { PageBuilderStudio } from "@/components/platform-admin/PageBuilderStudio";
import "../builder.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Estudio visual de páginas hijas", robots: { index: false, follow: false } };

export default async function PageBuilderPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  if (!validPlatformBusinessId(businessId)) notFound();
  let data;
  try {
    data = await loadPageBuilder(businessId);
  } catch (error) {
    if (error instanceof PlatformAdminAuthError) {
      if (error.code === "unauthenticated" || error.code === "unconfigured") redirect("/admin/login?next=/admin-global");
      if (error.code === "unauthorized") redirect("/admin/acceso-denegado");
    }
    if (error instanceof PageBuilderError && (error.code === "not_found" || error.code === "invalid_id")) notFound();
    if (error instanceof PageBuilderError && error.code === "unauthorized") redirect("/admin-global?selectionError=scope");
    throw error;
  }
  return (
    <main className="caxas-builder">
      <div className="caxas-builder__topbar">
        <Link href="/admin-global#admin-negocios" className="caxas-builder__back">← Volver a la plataforma madre</Link>
        <span className="caxas-builder__edition">CAXAS <b>STUDIO</b> <i>01</i></span>
        <span className="caxas-builder__toprole">ESTUDIO DE PÁGINAS HIJAS</span>
      </div>
      <PageBuilderStudio business={data.business} initialContent={data.content} />
    </main>
  );
}
