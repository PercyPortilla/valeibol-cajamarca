"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createPublicBrowserSupabaseClient, hasPublicSupabaseConfig } from "@/lib/data/supabase/browser";

export function CustomerAuthForm() {
  const router = useRouter();
  const configured = hasPublicSupabaseConfig();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function switchMode(nextMode: "login" | "register") {
    setMode(nextMode);
    setMessage(null);
    setSuccess(false);
  }

  async function sendPasswordRecovery() {
    if (!configured || busy || mode !== "login") return;

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setSuccess(false);
      setMessage("Ingresa tu correo para recuperar la contraseña.");
      return;
    }

    setBusy(true);
    setMessage(null);
    setSuccess(false);
    try {
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", "/mi-cuenta/recuperar");

      const supabase = createPublicBrowserSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: callback.toString(),
      });

      if (error) {
        setMessage("No pudimos iniciar la recuperación. Verifica el correo o inténtalo nuevamente.");
        return;
      }

      setSuccess(true);
      setMessage("Si el correo corresponde a una cuenta habilitada, recibirás instrucciones para crear una nueva contraseña.");
    } catch {
      setMessage("No pudimos iniciar la recuperación de contraseña. Inténtalo nuevamente.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || busy) return;
    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity();
      return;
    }
    setBusy(true);
    setMessage(null);
    setSuccess(false);

    try {
      const supabase = createPublicBrowserSupabaseClient();
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          setMessage("Correo o contraseña incorrectos, o la cuenta no está disponible.");
          return;
        }
        router.replace("/mi-cuenta");
        router.refresh();
        return;
      }

      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", "/mi-cuenta");
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: callback.toString() },
      });
      if (error) {
        setMessage("No pudimos crear la cuenta. Revisa el correo y la contraseña.");
        return;
      }
      if (data.session) {
        router.replace("/mi-cuenta");
        router.refresh();
        return;
      }
      setSuccess(true);
      setMessage("Cuenta creada. Revisa tu correo para confirmar el acceso.");
    } catch {
      setMessage("No pudimos conectar con el servicio de autenticación.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="customer-auth-card">
      <div className="customer-auth-tabs" role="group" aria-label="Modo de acceso">
        <button type="button" aria-pressed={mode === "login"} onClick={() => switchMode("login")}>Iniciar sesión</button>
        <button type="button" aria-pressed={mode === "register"} onClick={() => switchMode("register")}>Crear cuenta</button>
      </div>
      {!configured ? <div className="auth-notice">El acceso de clientes se habilitará cuando Supabase Auth esté configurado.</div> : null}
      <form className="auth-form" onSubmit={submit} noValidate>
        <Input label="Correo" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required disabled={!configured || busy} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" />
        <Input label="Contraseña" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required disabled={!configured || busy} value={password} onChange={(event) => setPassword(event.target.value)} hint={mode === "register" ? "Mínimo 8 caracteres." : undefined} placeholder="••••••••" />
        {message ? <div className={success ? "auth-notice auth-notice--success" : "auth-error"} role={success ? "status" : "alert"}>{message}</div> : null}
        <Button fullWidth type="submit" disabled={!configured || busy}>{busy ? "Procesando…" : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}</Button>
        {mode === "login" ? (
          <Button fullWidth type="button" variant="secondary" disabled={!configured || busy} onClick={() => void sendPasswordRecovery()}>
            Olvidé mi contraseña
          </Button>
        ) : null}
      </form>
    </div>
  );
}
