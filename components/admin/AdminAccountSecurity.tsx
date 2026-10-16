"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";

type AdminAccountSecurityProps = {
  email: string | null;
  localMode: boolean;
};

export function AdminAccountSecurity({ email, localMode }: AdminAccountSecurityProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<"error" | "success">("error");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (localMode || busy) return;

    if (password.length < 8) {
      setMessageKind("error");
      setMessage("La contraseÃ±a debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setMessageKind("error");
      setMessage("Las contraseÃ±as no coinciden.");
      return;
    }

    setBusy(true);
    setMessage(null);
    setMessageKind("error");
    try {
      const supabase = createPublicBrowserSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMessage("No pudimos actualizar la contraseÃ±a. Vuelve a iniciar sesiÃ³n e intÃ©ntalo nuevamente.");
        return;
      }

      setPassword("");
      setConfirmPassword("");
      setMessageKind("success");
      setMessage("ContraseÃ±a actualizada correctamente.");
    } catch {
      setMessage("No pudimos conectar con el servicio de autenticaciÃ³n. IntÃ©ntalo nuevamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-account-card" id="mi-cuenta" aria-labelledby="mi-cuenta-title">
      <div className="admin-content-editor__head">
        <div>
          <span className="metric-label">MI CUENTA</span>
          <h2 id="mi-cuenta-title">ContraseÃ±a de acceso</h2>
          <p>
            {email
              ? `Cuenta: ${email}. Puedes crear o cambiar tu contraseÃ±a desde aquÃ­.`
              : "Puedes crear o cambiar tu contraseÃ±a desde aquÃ­."}
          </p>
        </div>
      </div>

      {localMode ? (
        <div className="auth-notice" role="status">
          El acceso local usa las credenciales de desarrollo y no permite cambiar contraseÃ±a desde el panel.
        </div>
      ) : (
        <form className="admin-account-form" onSubmit={onSubmit} noValidate>
          <Input
            label="Nueva contraseÃ±a"
            name="new-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            hint="MÃ­nimo 8 caracteres."
          />
          <Input
            label="Confirmar nueva contraseÃ±a"
            name="confirm-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />

          {message ? (
            <div
              className={messageKind === "success" ? "auth-notice auth-notice--success" : "auth-error"}
              role={messageKind === "success" ? "status" : "alert"}
            >
              {message}
            </div>
          ) : null}

          <div className="admin-config-actions">
            <Button type="submit" disabled={busy}>
              {busy ? "Guardandoâ€¦" : "Guardar contraseÃ±a"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

