import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdminContext } from "@/lib/auth/platformAdmin";
import { PLATFORM_ADMIN_BUSINESS_COOKIE, validPlatformBusinessId } from "@/lib/auth/platformScope";

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
  const businessId = validPlatformBusinessId(typeof rawBusinessId === "string" ? rawBusinessId : null);
  if (!businessId) {
    return new NextResponse(null, { status: 303, headers: { Location: "/admin-global", "Cache-Control": "no-store" } });
  }

  // Location relativa: no salta al hostname interno normalizado de Next.js,
  // lo que perdería la cookie de ámbito entre dominios.
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: "/admin", "Cache-Control": "no-store" },
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
