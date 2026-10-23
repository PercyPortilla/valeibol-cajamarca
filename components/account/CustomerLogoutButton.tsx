"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";

export function CustomerLogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await createPublicBrowserSupabaseClient().auth.signOut();
    } finally {
      router.replace("/mi-cuenta");
      router.refresh();
    }
  }
  return <button className="button button--secondary" type="button" onClick={logout} disabled={busy}>{busy ? "Cerrando…" : "Cerrar sesión"}</button>;
}
