import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/auth/server";
import { isLocalDevAdminUserId } from "@/lib/auth/localDev";
import { createServerSupabaseClient } from "@/lib/data/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export async function POST(request: Request) {
  try {
    const context = await getAdminContext();
    if (context.role !== "owner" && context.role !== "admin") {
      return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 403 });
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, code: "invalid_file" }, { status: 400 });
    }
    const extension = MIME_EXTENSION[file.type];
    if (!extension || file.size <= 0 || file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ ok: false, code: "invalid_file", message: "Usa JPG, PNG, WebP o AVIF de hasta 8 MB." }, { status: 400 });
    }

    const fileName = `${randomUUID()}.${extension}`;
    if (isLocalDevAdminUserId(context.userId)) {
      const publicDir = join(process.cwd(), "public", "uploads", "local-gallery");
      await mkdir(publicDir, { recursive: true });
      await writeFile(join(publicDir, fileName), Buffer.from(await file.arrayBuffer()));
      return NextResponse.json({
        ok: true,
        url: `/uploads/local-gallery/${fileName}`,
        path: `local-gallery/${fileName}`,
        local: true,
      });
    }

    const path = `${context.businessId}/${fileName}`;
    const client = await createServerSupabaseClient();
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error } = await client.storage.from("business-gallery").upload(path, bytes, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      return NextResponse.json({ ok: false, code: "upload_failed", message: "No pudimos subir la imagen a Supabase Storage." }, { status: 502 });
    }

    const { data } = client.storage.from("business-gallery").getPublicUrl(path);
    return NextResponse.json({ ok: true, url: data.publicUrl, path });
  } catch {
    return NextResponse.json({ ok: false, code: "unauthenticated" }, { status: 401 });
  }
}
