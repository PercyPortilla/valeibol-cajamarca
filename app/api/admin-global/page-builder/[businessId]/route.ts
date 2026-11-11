import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { PlatformAdminAuthError } from "@/lib/auth/platformAdmin";
import {
  PageBuilderError, getScopedPageBuilderClient, parsePageBuilderState,
} from "@/lib/platform/pageBuilder";
import { isSameOriginPageBuilderMutation } from "@/lib/platform/pageBuilderOrigin";
import {
  isAccessibleSiteTheme, isValidSiteThemeInput,
  normalizeSiteGallery, normalizeSiteLogoUrl, normalizeSiteServices, normalizeSiteTheme,
} from "@/lib/siteContent";
import type { Json } from "@/lib/data/supabase/database.types";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };
type Context = { params: Promise<{ businessId: string }> };

function failure(code: string, status: number, message: string) {
  return NextResponse.json({ ok: false, code, message }, { status, headers: NO_STORE });
}
function errorResponse(error: unknown) {
  if (error instanceof PlatformAdminAuthError) {
    const status = error.code === "unauthenticated" ? 401 : error.code === "unauthorized" ? 403 : 503;
    return failure(error.code, status, "Tu sesión global no está autorizada para editar páginas.");
  }
  if (error instanceof PageBuilderError) {
    const status = error.code === "invalid_id" || error.code === "not_found" ? 404 : error.code === "unauthorized" ? 403 : 503;
    return failure(error.code, status, "No pudimos verificar el acceso al negocio seleccionado.");
  }
  if (error instanceof SyntaxError) return failure("invalid_json", 400, "Solicitud de edición inválida.");
  console.error("[page-builder] request failed", error instanceof Error ? error.name : "unknown");
  return failure("internal_error", 500, "No se pudo completar la operación.");
}
function databaseFailure(error: { code?: string; message: string }) {
  const message = error.message.toLowerCase();
  // Keep SQL diagnostics on the server, without logging business content or user data.
  // Avoid masking a programming error as a temporary network outage.
  console.error("[page-builder] database RPC failed", { sqlstate: error.code ?? "unknown" });
  if (error.code === "40001") {
    return message.includes("live_changed")
      ? failure("live_changed", 409, "La página pública cambió desde que empezaste a editar. Conserva tu diseño y revisa los cambios antes de publicarlos.")
      : failure("draft_changed", 409, "El borrador fue modificado en otra pestaña. Actualiza el editor para evitar sobrescribirlo.");
  }
  if (error.code === "42501") return failure("unauthorized", 403, "No puedes modificar este negocio.");
  if (error.code === "22023") return failure("validation", 422, "El borrador o la versión seleccionada no son válidos.");
  return failure("backend", 503, "El servidor no pudo procesar el diseño. Tus cambios guardados se conservan; vuelve a intentarlo.");
}

async function readJson(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > 100_000) throw new RangeError("payload_too_large");
  const source = await request.text();
  if (source.length > 100_000) throw new RangeError("payload_too_large");
  return JSON.parse(source) as unknown;
}
function record(raw: unknown): Record<string, unknown> | null {
  return raw !== null && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
}
function versionOf(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function parseDraft(raw: unknown) {
  const body = record(raw);
  const draft = record(body?.draft);
  const expectedVersion = versionOf(body?.expectedVersion);
  const expectedPublishedAt = body?.expectedPublishedAt;
  if (!body || !draft || expectedVersion === null ||
    (expectedPublishedAt !== null && typeof expectedPublishedAt !== "string") ||
    typeof draft.logoUrl !== "string" || !Array.isArray(draft.services) || !Array.isArray(draft.gallery) ||
    !isValidSiteThemeInput(draft.theme) || !isAccessibleSiteTheme(normalizeSiteTheme(draft.theme))) return null;
  if (draft.services.length > 24 || draft.gallery.length > 16) return null;
  const themeInput = record(draft.theme);
  const custom = themeInput?.extraSections;
  if (custom !== undefined && (!Array.isArray(custom) || custom.length > 8)) return null;

  const logoUrl = normalizeSiteLogoUrl(draft.logoUrl);
  const services = normalizeSiteServices(draft.services);
  const gallery = normalizeSiteGallery(draft.gallery);
  const theme = normalizeSiteTheme(draft.theme);
  if ((draft.logoUrl.trim() && !logoUrl) ||
    services.length !== draft.services.length || gallery.length !== draft.gallery.length ||
    (Array.isArray(custom) && theme.extraSections?.length !== custom.length)) return null;
  for (let i = 0; i < gallery.length; i++) {
    const item = record(draft.gallery[i]);
    if (typeof item?.imageUrl === "string" && item.imageUrl.trim() && !gallery[i].imageUrl) return null;
  }
  for (let i = 0; i < (theme.extraSections?.length ?? 0); i++) {
    const item = record((custom as unknown[])[i]);
    const section = theme.extraSections?.[i];
    if (!section) return null;
    if ((typeof item?.imageUrl === "string" && item.imageUrl.trim() && !section.imageUrl)
      || (typeof item?.buttonUrl === "string" && item.buttonUrl.trim() && !section.buttonUrl)) return null;
  }
  return {
    draft: { logoUrl, services, gallery, theme },
    expectedVersion,
    expectedPublishedAt: expectedPublishedAt as string | null,
  };
}
function preflight(request: Request) {
  if (!isSameOriginPageBuilderMutation(request)) return failure("invalid_origin", 403, "Origen no autorizado.");
  return null;
}
function returnError(error: unknown) {
  if (error instanceof RangeError) return failure("payload_too_large", 413, "Contenido demasiado grande.");
  return errorResponse(error);
}

export async function GET(_request: Request, { params }: Context) {
  const { businessId } = await params;
  try {
    const client = await getScopedPageBuilderClient(businessId);
    const { data, error } = await client.rpc("platform_page_builder_get_state", { p_business_id: businessId });
    if (error) return databaseFailure(error);
    return NextResponse.json({ ok: true, state: parsePageBuilderState(data) }, { headers: NO_STORE });
  } catch (error) { return errorResponse(error); }
}

/** POST: guardar BORRADOR; nunca actualiza la web pública. */
export async function POST(request: Request, { params }: Context) {
  const invalidOrigin = preflight(request);
  if (invalidOrigin) return invalidOrigin;
  const { businessId } = await params;
  try {
    const client = await getScopedPageBuilderClient(businessId);
    const payload = parseDraft(await readJson(request));
    if (!payload) return failure("invalid_payload", 422, "Revisa el contenido, las URL y la paleta antes de guardar.");
    const { data, error } = await client.rpc("platform_page_builder_save_draft", {
      p_business_id: businessId,
      p_content: payload.draft as unknown as Json,
      p_expected_version: payload.expectedVersion,
      p_expected_published_at: payload.expectedPublishedAt,
    });
    if (error) return databaseFailure(error);
    return NextResponse.json({ ok: true, data }, { headers: NO_STORE });
  } catch (error) { return returnError(error); }
}

/** PUT: publicación explícita con protección contra cambios ajenos. */
export async function PUT(request: Request, { params }: Context) {
  const invalidOrigin = preflight(request);
  if (invalidOrigin) return invalidOrigin;
  const { businessId } = await params;
  try {
    const client = await getScopedPageBuilderClient(businessId);
    const body = record(await readJson(request));
    const expectedVersion = versionOf(body?.expectedVersion);
    if (expectedVersion === null || expectedVersion === 0) return failure("invalid_version", 422, "Guarda primero un borrador.");
    const { data, error } = await client.rpc("platform_page_builder_publish_draft", {
      p_business_id: businessId, p_expected_version: expectedVersion,
    });
    if (error) return databaseFailure(error);
    // Revalidate all tenant microsite routes: the global directory RPC is not
    // available to tenant owners/managers publishing through /admin/disenar.
    revalidatePath("/complejo/[slug]", "page");
    revalidatePath("/buscar");
    revalidatePath("/admin-global");
    return NextResponse.json({ ok: true, data }, { headers: NO_STORE });
  } catch (error) { return returnError(error); }
}

/** PATCH: recuperar una versión como BORRADOR; nunca la publica directamente. */
export async function PATCH(request: Request, { params }: Context) {
  const invalidOrigin = preflight(request);
  if (invalidOrigin) return invalidOrigin;
  const { businessId } = await params;
  try {
    const client = await getScopedPageBuilderClient(businessId);
    const body = record(await readJson(request));
    const expectedVersion = versionOf(body?.expectedVersion);
    const revisionId = body?.revisionId;
    if (expectedVersion === null || typeof revisionId !== "string" || !/^[1-9]\d{0,15}$/.test(revisionId)) {
      return failure("invalid_revision", 422, "Elige una versión publicada válida.");
    }
    const { data, error } = await client.rpc("platform_page_builder_restore_revision", {
      p_business_id: businessId, p_revision_id: Number(revisionId), p_expected_version: expectedVersion,
    });
    if (error) return databaseFailure(error);
    return NextResponse.json({ ok: true, data }, { headers: NO_STORE });
  } catch (error) { return returnError(error); }
}

/** DELETE: descartar el borrador; restaura la vista de la versión publicada. */
export async function DELETE(request: Request, { params }: Context) {
  const invalidOrigin = preflight(request);
  if (invalidOrigin) return invalidOrigin;
  const { businessId } = await params;
  try {
    const client = await getScopedPageBuilderClient(businessId);
    const body = record(await readJson(request));
    const expectedVersion = versionOf(body?.expectedVersion);
    if (expectedVersion === null || expectedVersion === 0) return failure("invalid_version", 422, "No existe un borrador para descartar.");
    const { data, error } = await client.rpc("platform_page_builder_discard_draft", {
      p_business_id: businessId, p_expected_version: expectedVersion,
    });
    if (error) return databaseFailure(error);
    return NextResponse.json({ ok: data === true }, { headers: NO_STORE });
  } catch (error) { return returnError(error); }
}
