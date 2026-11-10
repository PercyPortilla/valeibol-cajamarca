import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { PlatformAdminAuthError } from "@/lib/auth/platformAdmin";
import { PageBuilderError, getScopedPageBuilderClient } from "@/lib/platform/pageBuilder";
import { isSameOriginPageBuilderMutation } from "@/lib/platform/pageBuilderOrigin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

function isSupportedImage(bytes: Uint8Array, mime: string) {
  if (mime === "image/png") return bytes.length > 8 && bytes.slice(0, 8).every((v, i) => v === [137, 80, 78, 71, 13, 10, 26, 10][i]);
  if (mime === "image/jpeg") return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/webp") return bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (mime === "image/avif") return bytes.length > 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp" && String.fromCharCode(...bytes.slice(8, 12)).startsWith("avi");
  return false;
}

export async function POST(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  if (!isSameOriginPageBuilderMutation(request)) return NextResponse.json({ ok: false, message: "Origen no autorizado." }, { status: 403 });
  const { businessId } = await params;
  try {
    const client = await getScopedPageBuilderClient(businessId);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !TYPES[file.type] || file.size <= 0 || file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ ok: false, message: "Imagen JPG, PNG, WebP o AVIF de hasta 8 MB." }, { status: 422 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isSupportedImage(bytes, file.type)) {
      return NextResponse.json({ ok: false, message: "El archivo no corresponde al tipo de imagen seleccionado." }, { status: 422 });
    }
    const path = `${businessId}/${randomUUID()}.${TYPES[file.type]}`;
    const { error } = await client.storage.from("business-gallery").upload(path, bytes, {
      contentType: file.type, cacheControl: "3600", upsert: false,
    });
    if (error) return NextResponse.json({ ok: false, message: "La imagen no pudo guardarse. Comprueba la conexión y los permisos del negocio." }, { status: 502 });
    const { data } = client.storage.from("business-gallery").getPublicUrl(path);
    return NextResponse.json({ ok: true, url: data.publicUrl }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PlatformAdminAuthError) return NextResponse.json({ ok: false, message: "Sesión global no autorizada." }, { status: error.code === "unauthenticated" ? 401 : 403 });
    if (error instanceof PageBuilderError) return NextResponse.json({ ok: false, message: "No se pudo validar el negocio." }, { status: error.code === "invalid_id" ? 404 : error.code === "unauthorized" ? 403 : 503 });
    console.error("[page-builder] media upload failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, message: "Error al subir la imagen." }, { status: 500 });
  }
}
