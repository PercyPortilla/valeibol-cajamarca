import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/data/supabase/database.types";
import { safeAdminRedirectPath } from "@/lib/auth";
import { LOCAL_DEV_ADMIN_COOKIE, isLocalDevAdminAllowed } from "@/lib/auth/localDev";
import { PLATFORM_ADMIN_BUSINESS_COOKIE, PLATFORM_ADMIN_BUSINESS_HEADER } from "@/lib/auth/platformScope";
import { pendingPlatformBusinessHandoff, shouldClearPlatformBusinessSelection } from "@/lib/auth/platformNavigation";
import { PUBLIC_WHATSAPP_ONLY } from "@/lib/platform/publicAccess";

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
  if (PUBLIC_WHATSAPP_ONLY && isCustomerAccountPath(pathname)) {
    return NextResponse.redirect(new URL("/buscar", request.url));
  }
  const clearPlatformSelection = shouldClearPlatformBusinessSelection({
    pathname,
    method: request.method,
    headers: request.headers,
  });
  if (clearPlatformSelection) request.cookies.delete(PLATFORM_ADMIN_BUSINESS_COOKIE);
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
  const supabase = createServerClient<Database>(url, anonKey, {
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

  const handoffBusinessId = pendingPlatformBusinessHandoff({
    pathname, method: request.method, searchParams: request.nextUrl.searchParams,
  });
  if (handoffBusinessId && data.user) {
    // La URL solo transporta el UUID del POST anterior; NO concede permisos.
    // Verificar global ADMIN y que el RPC del tenant reconoce exactamente ese UUID.
    const { data: globalContext, error: globalError } = await supabase.rpc("get_platform_admin_context");
    if (!globalError && globalContext?.some((row) => row.role === "admin")) {
      const scoped = createServerClient<Database>(url, anonKey, {
        global: { headers: { [PLATFORM_ADMIN_BUSINESS_HEADER]: handoffBusinessId } },
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => { /* No mutar Auth dentro de una comprobación de ámbito. */ },
        },
      });
      const { data: tenantContext, error: tenantError } = await scoped.rpc("get_current_admin_context");
      if (tenantError || !tenantContext?.some((row) => row.business_id === handoffBusinessId && row.role === "admin")) {
        const rejected = request.nextUrl.clone();
        rejected.pathname = "/admin-global";
        rejected.search = "?selectionError=scope";
        return NextResponse.redirect(rejected);
      }

      // Hacer que el request de Next (SSR/RSC) y el navegador reciban el scope.
      // Esto evita SC-11 aun si el Set-Cookie del 303 se descartó en el salto.
      request.cookies.set(PLATFORM_ADMIN_BUSINESS_COOKIE, handoffBusinessId);
      const scopedResponse = NextResponse.next({ request });
      for (const cookie of response.cookies.getAll()) scopedResponse.cookies.set(cookie);
      response = scopedResponse;
      response.cookies.set(PLATFORM_ADMIN_BUSINESS_COOKIE, handoffBusinessId, {
        path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production",
        httpOnly: false, maxAge: 60 * 60 * 8,
      });
    }
  }

  if (clearPlatformSelection) response.cookies.delete(PLATFORM_ADMIN_BUSINESS_COOKIE);

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/admin-global/:path*", "/mi-cuenta/:path*"],
};

