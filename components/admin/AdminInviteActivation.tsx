"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";

type ActivationState = "loading" | "ready" | "invalid";

export function AdminInviteActivation() {
  const router = useRouter();
  const [state, setState] = useState<ActivationState>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function establishInvitationSession() {
      try {
        const supabase = createPublicBrowserSupabaseClient();
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        const code = url.searchParams.get("code");

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) throw error ?? new Error("invitation_session_missing");

        if (!active) return;
        setEmail(data.user.email ?? null);
        setState("ready");
        window.history.replaceState(null, "", "/admin/activar");
      } catch {
        if (active) setState("invalid");
      }
    }

    void establishInvitationSession();
    return () => {
      active = false;
    };
  }, []);

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || state !== "ready") return;

    if (password.length < 8) {
      setMessage("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const supabase = createPublicBrowserSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMessage("No pudimos guardar la contraseña. Solicita una nueva invitación al propietario.");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setMessage("No pudimos completar la activación. Inténtalo nuevamente.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") {
    return <div className="auth-notice" role="status">Validando tu invitación…</div>;
  }

  if (state === "invalid") {
    return (
      <div className="auth-error" role="alert">
        Esta invitación no es válida, ya expiró o no pudo establecer una sesión. Pide al propietario que te envíe una nueva.
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={savePassword} noValidate>
      {email ? <div className="auth-notice" role="status">Cuenta invitada: <strong>{email}</strong></div> : null}
      <Input
        label="Crear contraseña"
        name="new-password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        hint="Mínimo 8 caracteres."
      />
      <Input
        label="Confirmar contraseña"
        name="confirm-password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
      />
      {message ? <div className="auth-error" role="alert">{message}</div> : null}
      <Button fullWidth type="submit" disabled={busy}>
        {busy ? "Activando acceso…" : "Crear contraseña y entrar"}
      </Button>
    </form>
  );
}

