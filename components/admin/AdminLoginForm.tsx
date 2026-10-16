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
  if (reason === "config") return "El acceso administrativo todavÃ­a no estÃ¡ configurado para este sitio.";
  if (reason === "session") return "Tu sesiÃ³n no existe o expirÃ³. Inicia sesiÃ³n nuevamente.";
  if (reason === "logout") return "SesiÃ³n cerrada correctamente.";
  return null;
}

export function AdminLoginForm() {
  const configured = hasPublicSupabaseConfig();
  const [localDev, setLocalDev] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<"error" | "success">("error");
  const [reason, setReason] = useState<LoginReason>(null);

  useEffect(() => {
    const localHost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "::1";
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
    setMessageKind("error");
    try {
      if (localDev && email.trim() === "admin") {
        const response = await fetch("/api/dev/admin-session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username: email.trim(), password }),
        });
        if (!response.ok) {
          setMessage("Usuario o contraseÃ±a incorrectos.");
          return;
        }

        const params = new URLSearchParams(window.location.search);
        window.location.assign(safeAdminRedirectPath(params.get("next")));
        return;
      }

      if (!configured) {
        setMessage("En modo local usa el usuario admin con la contraseÃ±a configurada para desarrollo.");
        return;
      }

      const supabase = createPublicBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setMessage("Correo o contraseÃ±a incorrectos, o la cuenta no estÃ¡ disponible.");
        return;
      }

      const params = new URLSearchParams(window.location.search);
      window.location.assign(safeAdminRedirectPath(params.get("next")));
    } catch {
      setMessage("No pudimos conectar con el servicio de autenticaciÃ³n. IntÃ©ntalo nuevamente.");
    } finally {
      setBusy(false);
    }
  }

  async function sendPasswordRecovery() {
    if (!configured || localDev || busy) return;

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setMessageKind("error");
      setMessage("Ingresa tu correo administrativo para recuperar la contraseÃ±a.");
      return;
    }

    setBusy(true);
    setMessage(null);
    setMessageKind("error");
    try {
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", "/admin/configuracion?passwordRecovery=1");

      const supabase = createPublicBrowserSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: callback.toString(),
      });

      if (error) {
        setMessage("No pudimos iniciar la recuperaciÃ³n. Verifica el correo o intÃ©ntalo nuevamente.");
        return;
      }

      setMessageKind("success");
      setMessage("Si el correo corresponde a una cuenta habilitada, recibirÃ¡s instrucciones para crear una nueva contraseÃ±a.");
    } catch {
      setMessage("No pudimos iniciar la recuperaciÃ³n de contraseÃ±a. IntÃ©ntalo nuevamente.");
    } finally {
      setBusy(false);
    }
  }

  const notice = localDev
    ? "Modo local habilitado: usa admin / 12345. Este acceso solo funciona en localhost y nunca se habilita en producciÃ³n."
    : !configured
      ? "El acceso administrativo todavÃ­a no estÃ¡ disponible. Completa la configuraciÃ³n del servicio de autenticaciÃ³n para habilitarlo."
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
          label="ContraseÃ±a"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={localDev ? 5 : 8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
        />
        {message ? (
          <div
            className={messageKind === "success" ? "auth-notice auth-notice--success" : "auth-error"}
            role={messageKind === "success" ? "status" : "alert"}
          >
            {message}
          </div>
        ) : null}
        <Button fullWidth type="submit" disabled={(!configured && !localDev) || busy}>
          {busy ? "Validando sesiÃ³nâ€¦" : "Entrar al panel"}
        </Button>
        {!localDev && configured ? (
          <Button fullWidth type="button" variant="secondary" disabled={busy} onClick={sendPasswordRecovery}>
            OlvidÃ© mi contraseÃ±a
          </Button>
        ) : null}
      </form>
    </>
  );
}

