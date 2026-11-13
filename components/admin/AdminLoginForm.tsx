"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { safeAdminRedirectPath } from "@/lib/auth";
import { safeTenantAdminRedirectPath } from "@/lib/auth/tenantAccess";
import { passwordRecoveryFailure } from "@/lib/auth/passwordRecoveryFeedback";
import {
  createPublicBrowserSupabaseClient,
  hasPublicSupabaseConfig,
} from "@/lib/data/supabase/browser";

type LoginReason = "config" | "session" | "logout" | "password-updated" | null;

function reasonMessage(reason: LoginReason) {
  if (reason === "config") return "El acceso administrativo todavía no está configurado para este sitio.";
  if (reason === "session") return "Tu sesión no existe o expiró. Inicia sesión nuevamente.";
  if (reason === "logout") return "Sesión cerrada correctamente.";
  if (reason === "password-updated") return "Contraseña actualizada. Entra con tu correo y la nueva contraseña que acabas de guardar.";
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
    if (raw === "config" || raw === "session" || raw === "logout" || raw === "password-updated") setReason(raw);
    if (params.get("recovery") === "1") {
      setMessageKind("success");
      setMessage("Escribe tu correo y selecciona «Olvidé mi contraseña» para recibir un enlace seguro.");
    }
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
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) {
        setMessage(error.code === "invalid_credentials"
          ? "El correo o la contraseña no coinciden. Si abriste un enlace de recuperación, primero debes guardar una contraseña nueva. Usa «Olvidé mi contraseña» para recuperarla sin crear otra cuenta."
          : "No fue posible iniciar sesión con estos datos. Comprueba tu correo o utiliza la recuperación segura.");
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const requested = params.get("next");
      const tenantTarget = safeTenantAdminRedirectPath(requested);
      if (tenantTarget) {
        window.location.assign(tenantTarget);
        return;
      }
      const { data: platformAdmin } = await supabase.rpc("get_platform_admin_context");
      const isPlatformAdmin = Boolean(platformAdmin?.length);
      window.location.assign(isPlatformAdmin ? "/admin-global" : safeAdminRedirectPath(requested));
    } catch {
      setMessage("No pudimos conectar con el servicio de autenticación. Inténtalo nuevamente.");
    } finally {
      setBusy(false);
    }
  }

  async function sendPasswordRecovery() {
    if (!configured || localDev || busy) return;
    // Recuperación desde el mismo dominio donde se abrió el login. Mantiene
    // la cookie/verificador PKCE en el mismo origen; no envía al alias antiguo.
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setMessageKind("error");
      setMessage("Ingresa tu correo administrativo para recuperar la contraseña.");
      return;
    }

    setBusy(true);
    setMessage(null);
    setMessageKind("error");
    try {
      // La recuperación debe abrir el formulario de cambio de contraseña
      // directamente en el MISMO origen. /auth/callback consume el código PKCE
      // en el servidor y dificulta distinguir un enlace abierto de una clave
      // realmente modificada. La página de activación admite ?code o #tokens.
      const recoveryPage = new URL("/admin/activar", window.location.origin);
      const requested = new URLSearchParams(window.location.search).get("next");
      const tenantTarget = safeTenantAdminRedirectPath(requested);
      recoveryPage.searchParams.set("recovery", "1");
      if (tenantTarget) recoveryPage.searchParams.set("tenant", tenantTarget);

      const supabase = createPublicBrowserSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: recoveryPage.toString(),
      });

      if (error) {
        const feedback = passwordRecoveryFailure(error);
        setMessage(feedback.message);
        return;
      }

      setMessageKind("success");
      setMessage("Si el correo corresponde a una cuenta habilitada, llegará un enlace. Ábrelo en este mismo navegador, escribe una contraseña nueva y pulsa «Guardar nueva contraseña». Abrir el enlace por sí solo no cambia la clave.");
    } catch {
      setMessage("No pudimos iniciar la recuperación de contraseña. Inténtalo nuevamente.");
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
        <div className={reason === "logout" || reason === "password-updated" ? "auth-notice auth-notice--success" : "auth-notice"} role="status">
          {notice}
        </div>
      ) : null}
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        {!localDev ? <div className="auth-notice">
          Ingresa con tu <strong>correo electrónico autorizado</strong>, no con el nombre
          mostrado en el equipo (por ejemplo, «PRUEBAa»). Si ya tienes una cuenta,
          recupera su contraseña en vez de crear otra.
        </div> : null}
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
        {message ? (
          <div
            className={messageKind === "success" ? "auth-notice auth-notice--success" : "auth-error"}
            role={messageKind === "success" ? "status" : "alert"}
          >
            {message}
          </div>
        ) : null}
        <Button fullWidth type="submit" disabled={(!configured && !localDev) || busy}>
          {busy ? "Validando sesión…" : "Entrar al panel"}
        </Button>
        {!localDev && configured ? (
          <Button fullWidth type="button" variant="secondary" disabled={busy} onClick={sendPasswordRecovery}>
            Olvidé mi contraseña
          </Button>
        ) : null}
      </form>
    </>
  );
}


