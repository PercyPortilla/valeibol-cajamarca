import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { PlatformAdminAuthError } from "@/lib/auth/platformAdmin";
import { PageBuilderError, findPageBuilderBusiness, getScopedPageBuilderClient } from "@/lib/platform/pageBuilder";
import { isSameOriginPageBuilderMutation } from "@/lib/platform/pageBuilderOrigin";
import { isAccessibleSiteTheme, isValidSiteThemeInput, normalizeSiteGallery, normalizeSiteLogoUrl, normalizeSiteServices, normalizeSiteTheme } from "@/lib/siteContent";

export const dynamic = "force-dynamic";

function failure(code: string, status: number, message: string) {
  return NextResponse.json({ ok: false, code, message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  if (!isSameOriginPageBuilderMutation(request)) return failure("invalid_origin", 403, "Origen no autorizado.");
  if (Number(request.headers.get("content-length") ?? 0) > 100_000) return failure("payload_too_large", 413, "Contenido demasiado grande.");
  const { businessId } = await params;
  try {
    const client = await getScopedPageBuilderClient(businessId);
    const raw: unknown = await request.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return failure("invalid_payload", 422, "Revisa los datos enviados.");
    const input = raw as Record<string, unknown>;
    if (typeof input.logoUrl !== "string" || !Array.isArray(input.services) || !Array.isArray(input.gallery)
        || !isValidSiteThemeInput(input.theme) || !isAccessibleSiteTheme(normalizeSiteTheme(input.theme))) {
      return failure("invalid_payload", 422, "Revisa la imagen, los bloques y el contraste de la paleta.");
    }
    if (input.services.length > 24 || input.gallery.length > 16) return failure("too_many_blocks", 422, "Superaste el límite de bloques.");
    const logoUrl = normalizeSiteLogoUrl(input.logoUrl);
    const services = normalizeSiteServices(input.services);
    const gallery = normalizeSiteGallery(input.gallery);
    const theme = normalizeSiteTheme(input.theme);
    const submittedGallery = input.gallery as Array<{ imageUrl?: unknown }>;
    if ((input.logoUrl.trim() && !logoUrl) || services.length !== input.services.length || gallery.length !== input.gallery.length
        || gallery.some((entry, index) => {
          const item = submittedGallery[index];
          return typeof item?.imageUrl === "string" && item.imageUrl.trim() !== "" && !entry.imageUrl;
        })) {
      return failure("invalid_content", 422, "Hay una URL, un título o una descripción no válida.");
    }

    const { data, error } = await client.rpc("admin_update_site_content", {
      p_logo_url: logoUrl || null,
      p_services: services,
      p_gallery: gallery,
      p_theme: theme,
    });
    if (error) {
      const status = error.code === "42501" ? 403 : error.code === "22023" ? 422 : 502;
      return failure("save_failed", status, "No se pudo guardar. Verifica el contenido y vuelve a intentar.");
    }
    const updated = data?.[0];
    if (!updated || updated.business_id !== businessId) return failure("scope_mismatch", 502, "No se pudo comprobar el negocio actualizado.");

    const business = await findPageBuilderBusiness(client, businessId);
    if (business?.slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(business.slug)) {
      revalidatePath(`/complejo/${business.slug}`);
    }
    revalidatePath("/buscar");
    revalidatePath("/admin-global");
    return NextResponse.json({ ok: true, updatedAt: updated.updated_at }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PlatformAdminAuthError) {
      const status = error.code === "unauthenticated" ? 401 : error.code === "unauthorized" ? 403 : 503;
      return failure(error.code, status, "Tu sesión global no está autorizada para editar páginas.");
    }
    if (error instanceof PageBuilderError) {
      const status = error.code === "invalid_id" || error.code === "not_found" ? 404 : error.code === "unauthorized" ? 403 : 503;
      return failure(error.code, status, "No pudimos verificar el acceso al negocio seleccionado.");
    }
    if (error instanceof SyntaxError) return failure("invalid_json", 400, "Solicitud de edición inválida.");
    console.error("[page-builder] save failed", error instanceof Error ? error.name : "unknown");
    return failure("internal_error", 500, "No se pudo guardar el diseño.");
  }
}
