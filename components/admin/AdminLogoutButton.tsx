"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createPublicBrowserSupabaseClient,
  hasPublicSupabaseConfig,
} from "@/lib/data/supabase/browser";
import { PLATFORM_ADMIN_BUSINESS_COOKIE } from "@/lib/auth/platformScope";

export function AdminLogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      if (process.env.NODE_ENV !== "production") {
        await fetch("/api/dev/admin-session", { method: "DELETE" });
      }
      if (hasPublicSupabaseConfig()) {
        const supabase = createPublicBrowserSupabaseClient();
        await supabase.auth.signOut();
      }
    } finally {
      document.cookie = `${PLATFORM_ADMIN_BUSINESS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
      router.replace("/admin/login?reason=logout");
      router.refresh();
    }
  }

  return (
    <button className="admin-logout" type="button" onClick={logout} disabled={busy}>
      {busy ? "Cerrando…" : "Cerrar sesión"}
    </button>
  );
}

