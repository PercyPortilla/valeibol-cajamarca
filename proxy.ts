import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeAdminRedirectPath } from "@/lib/auth";
import { LOCAL_DEV_ADMIN_COOKIE, isLocalDevAdminAllowed } from "@/lib/auth/localDev";
import { PLATFORM_ADMIN_BUSINESS_COOKIE } from "@/lib/auth/platformScope";

function isPublicAdminPath(pathname: string) {
  return pathname === "/admin/login"
    || pathname.startsWith("/admin/login/")
    || pathname === "/admin/activar"
    || pathname.startsWith("/admin/activar/");
}

function isCustomerAccountPath(pathname: string) {
  return pathname === "/mi-cuenta" || pathname.startsWith("/mi-cuenta/");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const platformAdminHome = pathname === "/admin-global" || pathname.startsWith("/admin-global/");
  if (platformAdminHome) request.cookies.delete(PLATFORM_ADMIN_BUSINESS_COOKIE);
  const adminPath = pathname.startsWith("/admin");
  const customerAccountPath = isCustomerAccountPath(pathname);
  if ((!adminPath && !customerAccountPath) || (adminPath && isPublicAdminPath(pathname))) {
    return NextResponse.next();
  }

  const localDevAdmin =
    adminPath &&
    isLocalDevAdminAllowed({ nodeEnv: process.env.NODE_ENV, hostname: request.nextUrl.hostname }) &&
    request.cookies.get(LOCAL_DEV_ADMIN_COOKIE)?.value === "1";

  if (localDevAdmin) {
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    if (customerAccountPath) return NextResponse.next();
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("reason", "config");
    loginUrl.searchParams.set("next", safeAdminRedirectPath(`${pathname}${request.nextUrl.search}`));
    return NextResponse.redirect(loginUrl);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (adminPath && (error || !data.user)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("reason", "session");
    loginUrl.searchParams.set("next", safeAdminRedirectPath(`${pathname}${request.nextUrl.search}`));
    return NextResponse.redirect(loginUrl);
  }

  if (platformAdminHome) response.cookies.delete(PLATFORM_ADMIN_BUSINESS_COOKIE);

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/admin-global/:path*", "/mi-cuenta/:path*"],
};

