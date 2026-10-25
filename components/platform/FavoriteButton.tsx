"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { loadFavoriteSnapshot, updateFavorite } from "@/lib/platform/favoritesClient";

type Props = {
  businessId: string;
  businessName: string;
  variant?: "icon" | "button";
};

const FAVORITE_EVENT = "platform:favorite-changed";

export function FavoriteButton({ businessId, businessName, variant = "icon" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadFavoriteSnapshot()
      .then((state) => {
        if (!active) return;
        setSignedIn(state.signedIn);
        setFavorite(state.ids.has(businessId));
      })
      .catch(() => active && setError("No pudimos cargar tus favoritos."))
      .finally(() => active && setReady(true));

    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ businessId: string; favorite: boolean }>).detail;
      if (detail?.businessId === businessId) setFavorite(detail.favorite);
    };
    window.addEventListener(FAVORITE_EVENT, onChanged);
    return () => {
      active = false;
      window.removeEventListener(FAVORITE_EVENT, onChanged);
    };
  }, [businessId]);

  async function toggle() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      let authenticated = signedIn;
      let currentFavorite = favorite;
      if (error) {
        const state = await loadFavoriteSnapshot();
        authenticated = state.signedIn;
        currentFavorite = state.ids.has(businessId);
        setSignedIn(authenticated);
        setFavorite(currentFavorite);
      }
      if (!authenticated) {
        router.push("/mi-cuenta");
        return;
      }
      const next = !currentFavorite;
      await updateFavorite(businessId, next);
      setFavorite(next);
      window.dispatchEvent(new CustomEvent(FAVORITE_EVENT, { detail: { businessId, favorite: next } }));
      if (pathname === "/mi-cuenta") router.refresh();
    } catch {
      setError("No pudimos actualizar este favorito. Inténtalo otra vez.");
    } finally {
      setBusy(false);
    }
  }

  const label = error
    ? `Reintentar favorito de ${businessName}`
    : signedIn
    ? favorite ? `Quitar ${businessName} de favoritos` : `Guardar ${businessName} en favoritos`
    : `Inicia sesión para guardar ${businessName}`;

  return (
    <>
      <button
        className={`platform-favorite-button platform-favorite-button--${variant}${favorite ? " is-favorite" : ""}${error ? " has-error" : ""}`}
        type="button"
        onClick={toggle}
        disabled={!ready || busy}
        aria-busy={busy}
        aria-label={label}
        aria-pressed={signedIn ? favorite : undefined}
        title={label}
      >
        <span aria-hidden="true">{error ? "!" : favorite ? "♥" : "♡"}</span>
        {variant === "button" ? <b>{error ? "Reintentar" : favorite ? "Guardado" : "Guardar"}</b> : null}
      </button>
      {error ? <span className={`platform-favorite-error platform-favorite-error--${variant}`} role="alert">{error}</span> : null}
    </>
  );
}
