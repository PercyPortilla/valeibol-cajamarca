import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdminContext } from "@/lib/auth/platformAdmin";
import { PLATFORM_ADMIN_BUSINESS_COOKIE, validPlatformBusinessId } from "@/lib/auth/platformScope";
import { createServerSupabaseClient } from "@/lib/data/supabase/server";

export const dynamic = "force-dynamic";

/** Selección por POST: un click real y una navegación completa, sin prefetch del router. */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const source = request.headers.get("sec-fetch-site");
  let originHost: string | null = null;
  try {
    originHost = origin ? new URL(origin).host : null;
  } catch {
    // Una cabecera Origin inválida nunca se acepta.
  }
  const allowedHosts = [
    request.headers.get("host"),
    request.headers.get("x-forwarded-host"),
    request.nextUrl.host,
  ].filter(Boolean);
  if (!originHost || !allowedHosts.includes(originHost) || (source && source !== "same-origin")) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  await requirePlatformAdminContext();
  const body = await request.formData();
  const rawBusinessId = body.get("businessId");
  // Solo destinos internos conocidos. Nunca permitir URL/redirect arbitrarios del navegador.
  const destinationPath = body.get("destination") === "workspace" ? "/admin/centro" : "/admin";
  const businessId = validPlatformBusinessId(typeof rawBusinessId === "string" ? rawBusinessId : null);
  if (!businessId) {
    return new NextResponse(null, { status: 303, headers: { Location: "/admin-global", "Cache-Control": "no-store" } });
  }

  // Comprobar en Supabase que el ámbito seleccionado realmente se reconoce.
  // Nunca interpretar una cookie o un UUID como permiso autónomo.
  const scopedClient = await createServerSupabaseClient({ explicitPlatformBusinessId: businessId });
  const { data: selectedContext, error: selectedError } = await scopedClient.rpc("get_current_admin_context");
  if (selectedError || !selectedContext?.some((row) => row.business_id === businessId && row.role === "admin")) {
    console.warn("[admin-scope] selection_preflight_failed", {
      rpcError: selectedError?.code ?? null,
      contextReturned: Boolean(selectedContext?.length),
    });
    return new NextResponse(null, {
      status: 303,
      headers: { Location: "/admin-global?selectionError=scope", "Cache-Control": "no-store" },
    });
  }

  // Respaldo del scope durante el primer GET, por si el navegador no conserva
  // el Set-Cookie de la respuesta 303. Proxy validará de nuevo sesión y tenant.
  const destination = `${destinationPath}?scope=${encodeURIComponent(businessId)}`;

  // Location relativa: no salta al hostname interno normalizado de Next.js,
  // lo que perdería la cookie de ámbito entre dominios.
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: destination, "Cache-Control": "no-store" },
  });
  response.cookies.set(PLATFORM_ADMIN_BUSINESS_COOKIE, businessId, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
    maxAge: 60 * 60 * 8,
  });
  return response;
}

/** No modificar la selección del tenant mediante enlaces GET o prefetch. */
export async function GET() {
  return new NextResponse(null, { status: 303, headers: { Location: "/admin-global", "Cache-Control": "no-store" } });
}
