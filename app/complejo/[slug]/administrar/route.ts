import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, hasPublicSupabaseServerConfig } from "@/lib/data/supabase/server";
import { PLATFORM_ADMIN_BUSINESS_COOKIE } from "@/lib/auth/platformScope";
import { tenantAdminEntryPath } from "@/lib/auth/tenantAccess";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = tenantAdminEntryPath(slug);
  if (!entry) return NextResponse.redirect(new URL("/buscar", request.url));

  if (!hasPublicSupabaseServerConfig()) {
    return NextResponse.redirect(new URL("/admin/login?reason=config", request.url));
  }
  const supabase = await createServerSupabaseClient();
  const { data: session } = await supabase.auth.getUser();
  if (!session.user) {
    const login = new URL("/admin/login", request.url);
    login.searchParams.set("next", entry);
    return NextResponse.redirect(login);
  }

  const { data: business, error: businessError } = await supabase.rpc("get_public_business_config", {
    p_business_slug: slug,
  });
  if (businessError || !business?.[0]?.business_id) {
    return NextResponse.redirect(new URL("/buscar", request.url));
  }
  const businessId = business[0].business_id;

  const { data: platformAdmin, error: globalError } = await supabase.rpc("get_platform_admin_context");
  if (!globalError && platformAdmin?.some((admin) => admin.role === "admin")) {
    const response = NextResponse.redirect(new URL("/admin", request.url));
    response.cookies.set(PLATFORM_ADMIN_BUSINESS_COOKIE, businessId, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: false,
      maxAge: 60 * 60 * 8,
    });
    return response;
  }

  const { data: tenant, error: tenantError } = await supabase.rpc("get_current_admin_context");
  if (tenantError || !tenant?.some((member) => member.business_id === businessId)) {
    return NextResponse.redirect(new URL("/admin/acceso-denegado", request.url));
  }
  return NextResponse.redirect(new URL("/admin", request.url));
}
