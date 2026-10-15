import { NextRequest, NextResponse } from "next/server";
import { safeAdminRedirectPath } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/data/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeAdminRedirectPath(request.nextUrl.searchParams.get("next"));

  if (!code) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("reason", "session");
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("reason", "session");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
