"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";

export function CustomerPasswordRecoveryForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    if (password.length < 8) {
      setSuccess(false);
      setMessage("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setSuccess(false);
      setMessage("Las contraseñas no coinciden.");
      return;
    }

    setBusy(true);
    setMessage(null);
    setSuccess(false);
    try {
      const supabase = createPublicBrowserSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMessage("No pudimos actualizar la contraseña. Solicita un nuevo enlace de recuperación e inténtalo nuevamente.");
        return;
      }

      setPassword("");
      setConfirmPassword("");
      setSuccess(true);
      setMessage("Contraseña actualizada correctamente. Ya puedes volver a Mi cuenta.");
      router.refresh();
    } catch {
      setMessage("No pudimos completar la recuperación. Inténtalo nuevamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={savePassword} noValidate>
      <Input
        label="Nueva contraseña"
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
        label="Confirmar nueva contraseña"
        name="confirm-password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
      />
      {message ? (
        <div className={success ? "auth-notice auth-notice--success" : "auth-error"} role={success ? "status" : "alert"}>
          {message}
        </div>
      ) : null}
      <Button fullWidth type="submit" disabled={busy}>
        {busy ? "Guardando…" : "Guardar nueva contraseña"}
      </Button>
      {success ? (
        <Button fullWidth type="button" variant="secondary" onClick={() => router.replace("/mi-cuenta")}>
          Volver a Mi cuenta
        </Button>
      ) : null}
    </form>
  );
}

