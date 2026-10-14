"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { safeAdminRedirectPath } from "@/lib/auth";
import {
  createPublicBrowserSupabaseClient,
  hasPublicSupabaseConfig,
} from "@/lib/data/supabase/browser";

type LoginReason = "config" | "session" | "logout" | null;

function reasonMessage(reason: LoginReason) {
  if (reason === "config") return "Supabase/Auth todavía no está configurado. El acceso administrativo real está deshabilitado.";
  if (reason === "session") return "Tu sesión no existe o expiró. Inicia sesión nuevamente.";
  if (reason === "logout") return "Sesión cerrada correctamente.";
  return null;
}

export function AdminLoginForm() {
  const configured = hasPublicSupabaseConfig();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reason, setReason] = useState<LoginReason>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("reason");
    if (raw === "config" || raw === "session" || raw === "logout") setReason(raw);
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || busy) return;

    setBusy(true);
    setMessage(null);
    try {
      const supabase = createPublicBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setMessage("Correo o contraseña incorrectos, o la cuenta no está disponible.");
        return;
      }

      const params = new URLSearchParams(window.location.search);
      window.location.assign(safeAdminRedirectPath(params.get("next")));
    } catch {
      setMessage("No pudimos conectar con el servicio de autenticación. Inténtalo nuevamente.");
    } finally {
      setBusy(false);
    }
  }

  const notice = !configured
    ? "Supabase/Auth no configurado. Esta pantalla no simula sesiones: configura las variables para habilitar el acceso."
    : reasonMessage(reason);

  return (
    <>
      {notice ? (
        <div className={reason === "logout" ? "auth-notice auth-notice--success" : "auth-notice"} role="status">
          {notice}
        </div>
      ) : null}
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <Input
          label="Correo"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="administrador@ejemplo.com"
        />
        <Input
          label="Contraseña"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
        />
        {message ? <div className="auth-error" role="alert">{message}</div> : null}
        <Button fullWidth type="submit" disabled={!configured || busy}>
          {busy ? "Validando sesión…" : "Entrar al panel"}
        </Button>
      </form>
    </>
  );
}
