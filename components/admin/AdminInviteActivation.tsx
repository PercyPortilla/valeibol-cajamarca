"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";
import { safeTenantAdminRedirectPath } from "@/lib/auth/tenantAccess";

type ActivationState = "loading" | "ready" | "invalid";

export function AdminInviteActivation() {
  const router = useRouter();
  const [mode,setMode] = useState<"invitation"|"temporary">("invitation");
  const [state, setState] = useState<ActivationState>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const [temporaryEmail,setTemporaryEmail] = useState("");
  const [temporaryPassword,setTemporaryPassword] = useState("");

  useEffect(() => {
    let active = true;

    async function establishInvitationSession() {
      try {
        const supabase = createPublicBrowserSupabaseClient();
        const url = new URL(window.location.href);
        if (url.searchParams.get("modo") === "temporal") {
          if (!active) return;
          setMode("temporary");setState("ready");
          return;
        }
        const tenantTarget = safeTenantAdminRedirectPath(url.searchParams.get("tenant"));
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
        setReturnTo(tenantTarget);
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

  async function activateTemporary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (password.length < 12 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setMessage("La nueva clave debe tener al menos 12 caracteres, letras y números.");return;
    }
    if (password === temporaryPassword) {
      setMessage("La contraseña definitiva debe ser distinta a la provisional.");return;
    }
    if (password !== confirmPassword) {
      setMessage("Las nuevas contraseñas no coinciden.");return;
    }
    setBusy(true);setMessage(null);
    const supabase = createPublicBrowserSupabaseClient();
    try {
      const {error:loginError}=await supabase.auth.signInWithPassword({
        email:temporaryEmail.trim().toLowerCase(),password:temporaryPassword,
      });
      if (loginError) {
        setMessage("No se reconoce el correo o la clave provisional. Solicita al administrador global que revise este acceso.");
        return;
      }
      const {data,error}=await supabase.functions.invoke<{ok?:boolean;code?:string}>(
        "platform-temporary-activation",{body:{newPassword:password}},
      );
      if (error || !data?.ok) {
        setMessage(data?.code === "weak_password"
          ? "La nueva contraseña no cumple los requisitos. Usa 12 caracteres, letras y números."
          : "No se completó la activación. Si tu contraseña llegó a cambiar, vuelve a entrar usando la última clave elegida y reintenta.");
        return;
      }
      setTemporaryPassword("");setPassword("");setConfirmPassword("");
      await supabase.auth.signOut();
      router.replace("/admin/login?reason=activated");
      router.refresh();
    } catch {
      setMessage("No pudimos conectar con el servidor de activación. Verifica tu conexión y reintenta.");
    } finally {
      // Una sesión con clave provisional jamás debe quedar abierta después de
      // un intento fallido de activación.
      await supabase.auth.signOut().catch(()=>{});
      setBusy(false);
    }
  }

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
        setMessage("No pudimos guardar la contraseña. Solicita un nuevo enlace de acceso o recuperación.");
        return;
      }
      const { data: platformAdmin } = await supabase.rpc("get_platform_admin_context");
      router.push(returnTo ?? (platformAdmin?.length ? "/admin-global" : "/admin"));
      router.refresh();
    } catch {
      setMessage("No pudimos completar la activación. Inténtalo nuevamente.");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "temporary") {
    return <form className="auth-form" onSubmit={(event)=>void activateTemporary(event)} noValidate>
      <div className="auth-notice">El administrador global te entregó una clave provisional. Solo podrás operar el negocio después de sustituirla por una contraseña personal.</div>
      <Input label="Correo autorizado" name="email" type="email" autoComplete="username" required
        value={temporaryEmail} onChange={(event)=>setTemporaryEmail(event.target.value)}/>
      <Input label="Clave provisional recibida" name="temporary-password" type="password" autoComplete="current-password" required
        value={temporaryPassword} onChange={(event)=>setTemporaryPassword(event.target.value)}/>
      <Input label="Nueva contraseña personal" name="new-password" type="password" autoComplete="new-password" minLength={12} required
        value={password} onChange={(event)=>setPassword(event.target.value)} hint="Al menos 12 caracteres, con letras y números. Debe ser distinta a la provisional."/>
      <Input label="Confirmar nueva contraseña" name="confirm-password" type="password" autoComplete="new-password" minLength={12} required
        value={confirmPassword} onChange={(event)=>setConfirmPassword(event.target.value)}/>
      {message ? <div className="auth-error" role="alert">{message}</div>:null}
      <Button fullWidth type="submit" disabled={busy}>{busy?"Activando acceso…":"Cambiar clave y activar acceso"}</Button>
    </form>;
  }

  if (state === "loading") {
    return <div className="auth-notice" role="status">Validando tu invitación…</div>;
  }

  if (state === "invalid") {
    return (
      <div className="auth-error" role="alert">
        Este enlace no es válido, ya expiró o no pudo establecer una sesión. Solicita uno nuevo desde el inicio de sesión.
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

