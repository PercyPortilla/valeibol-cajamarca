"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";

export function AdminLogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      const supabase = createPublicBrowserSupabaseClient();
      await supabase.auth.signOut();
    } finally {
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
