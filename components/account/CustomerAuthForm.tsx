"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createPublicBrowserSupabaseClient, hasPublicSupabaseConfig } from "@/lib/data/supabase/browser";

export function CustomerAuthForm() {
  const configured = hasPublicSupabaseConfig();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || busy) return;
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
        window.location.reload();
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
        window.location.reload();
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
      <div className="customer-auth-tabs" role="tablist" aria-label="Acceso de cliente">
        <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => setMode("login")}>Iniciar sesión</button>
        <button type="button" role="tab" aria-selected={mode === "register"} onClick={() => setMode("register")}>Crear cuenta</button>
      </div>
      {!configured ? <div className="auth-notice">El acceso de clientes se habilitará cuando Supabase Auth esté configurado.</div> : null}
      <form className="auth-form" onSubmit={submit} noValidate>
        <Input label="Correo" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" />
        <Input label="Contraseña" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" />
        {message ? <div className={success ? "auth-notice auth-notice--success" : "auth-error"} role={success ? "status" : "alert"}>{message}</div> : null}
        <Button fullWidth type="submit" disabled={!configured || busy}>{busy ? "Procesando…" : mode === "login" ? "Entrar" : "Crear cuenta"}</Button>
      </form>
    </div>
  );
}
