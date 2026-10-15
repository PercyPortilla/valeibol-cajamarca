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
  if (reason === "config") return "El acceso administrativo todavía no está configurado para este sitio.";
  if (reason === "session") return "Tu sesión no existe o expiró. Inicia sesión nuevamente.";
  if (reason === "logout") return "Sesión cerrada correctamente.";
  return null;
}

export function AdminLoginForm() {
  const configured = hasPublicSupabaseConfig();
  const [localDev, setLocalDev] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reason, setReason] = useState<LoginReason>(null);

  useEffect(() => {
    const localHost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname === "::1";
    setLocalDev(process.env.NODE_ENV !== "production" && localHost);
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("reason");
    if (raw === "config" || raw === "session" || raw === "logout") setReason(raw);
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ((!configured && !localDev) || busy) return;

    setBusy(true);
    setMessage(null);
    try {
      if (localDev && email.trim() === "admin") {
        const response = await fetch("/api/dev/admin-session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username: email.trim(), password }),
        });
        if (!response.ok) {
          setMessage("Usuario o contraseña incorrectos.");
          return;
        }

        const params = new URLSearchParams(window.location.search);
        window.location.assign(safeAdminRedirectPath(params.get("next")));
        return;
      }

      if (!configured) {
        setMessage("En modo local usa el usuario admin con la contraseña configurada para desarrollo.");
        return;
      }

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

  const notice = localDev
    ? "Modo local habilitado: usa admin / 12345. Este acceso solo funciona en localhost y nunca se habilita en producción."
    : !configured
      ? "El acceso administrativo todavía no está disponible. Completa la configuración del servicio de autenticación para habilitarlo."
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
          label={localDev ? "Usuario o correo" : "Correo"}
          name="email"
          type={localDev ? "text" : "email"}
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={localDev ? "admin" : "administrador@ejemplo.com"}
        />
        <Input
          label="Contraseña"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={localDev ? 5 : 8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
        />
        {message ? <div className="auth-error" role="alert">{message}</div> : null}
        <Button fullWidth type="submit" disabled={(!configured && !localDev) || busy}>
          {busy ? "Validando sesión…" : "Entrar al panel"}
        </Button>
      </form>
    </>
  );
}

