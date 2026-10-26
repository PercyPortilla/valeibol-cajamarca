import { NextRequest, NextResponse } from "next/server";
import { safeAdminRedirectPath } from "@/lib/auth";
import { requirePlatformAdminContext } from "@/lib/auth/platformAdmin";
import { PLATFORM_ADMIN_BUSINESS_COOKIE, validPlatformBusinessId } from "@/lib/auth/platformScope";

export async function GET(request: NextRequest) {
  await requirePlatformAdminContext();
  const businessId = validPlatformBusinessId(request.nextUrl.searchParams.get("businessId"));
  if (!businessId) {
    return NextResponse.redirect(new URL("/admin-global", request.url));
  }

  const next = safeAdminRedirectPath(request.nextUrl.searchParams.get("next"));
  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set(PLATFORM_ADMIN_BUSINESS_COOKIE, businessId, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
    maxAge: 60 * 60 * 8,
  });
  return response;
}
