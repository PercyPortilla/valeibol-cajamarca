"use client";

import { useState } from "react";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";

export function AdminLogoutButton() {
  const [busy, setBusy] = useState(false);

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      const supabase = createPublicBrowserSupabaseClient();
      await supabase.auth.signOut();
    } finally {
      window.location.assign("/admin/login?reason=logout");
    }
  }

  return (
    <button className="admin-logout" type="button" onClick={logout} disabled={busy}>
      {busy ? "Cerrando…" : "Cerrar sesión"}
    </button>
  );
}
