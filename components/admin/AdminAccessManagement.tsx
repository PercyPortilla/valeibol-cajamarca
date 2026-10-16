"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { adminRoleLabel, type AdminRole } from "@/lib/auth";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";

type AccessUser = {
  userId: string;
  email: string;
  displayName: string | null;
  role: AdminRole;
  isActive: boolean;
  emailConfirmed: boolean;
  lastSignInAt: string | null;
  createdAt: string;
};

type AccessResponse = {
  ok?: boolean;
  users?: AccessUser[];
  user?: AccessUser;
  error?: string;
};

const roleOptions = [
  { value: "owner", label: "Propietario" },
  { value: "admin", label: "Administrador" },
  { value: "staff", label: "Personal" },
];

function formatAccessDate(value: string | null) {
  if (!value) return "Sin ingreso registrado";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sin ingreso registrado";
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

async function invokeAccessManagement(body: Record<string, unknown>) {
  const supabase = createPublicBrowserSupabaseClient();
  const { data, error } = await supabase.functions.invoke<AccessResponse>("admin-access-management", { body });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "access_management_failed");
  return data;
}

function AdminAccessUserRow({
  user,
  currentUserId,
  onSaved,
}: {
  user: AccessUser;
  currentUserId: string;
  onSaved: (user: AccessUser) => void;
}) {
  const isCurrentUser = user.userId === currentUserId;
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [role, setRole] = useState<AdminRole>(user.role);
  const [isActive, setIsActive] = useState(user.isActive);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const data = await invokeAccessManagement({
        action: "update",
        userId: user.userId,
        displayName: displayName.trim(),
        role,
        isActive,
      });
      if (data.user) onSaved(data.user);
      setMessage("Acceso actualizado.");
    } catch {
      setMessage("No pudimos actualizar este acceso.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="admin-access-user">
      <div className="admin-access-user__identity">
        <div>
          <strong>{user.email}</strong>
          <span>{isCurrentUser ? "Tu cuenta" : adminRoleLabel(user.role)}</span>
        </div>
        <div className="admin-access-user__badges">
          <Badge tone={user.isActive ? "success" : "neutral"}>{user.isActive ? "Activo" : "Desactivado"}</Badge>
          <Badge tone={user.emailConfirmed ? "info" : "warning"}>
            {user.emailConfirmed ? "Correo verificado" : "Invitación pendiente"}
          </Badge>
        </div>
      </div>

      <div className="admin-access-user__fields">
        <Input
          label="Nombre"
          name={`display-name-${user.userId}`}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Nombre visible"
        />
        <Select
          label="Rol"
          name={`role-${user.userId}`}
          options={roleOptions}
          value={role}
          disabled={isCurrentUser}
          onChange={(event) => setRole(event.target.value as AdminRole)}
        />
        <label className="admin-access-toggle">
          <input
            type="checkbox"
            checked={isActive}
            disabled={isCurrentUser}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          <span>Puede acceder al panel</span>
        </label>
      </div>

      <div className="admin-access-user__footer">
        <small>Último ingreso: {formatAccessDate(user.lastSignInAt)}</small>
        <div className="admin-access-user__actions">
          {message ? <span role="status">{message}</span> : null}
          <Button type="button" variant="secondary" disabled={busy} onClick={save}>
            {busy ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </article>
  );
}

export function AdminAccessManagement({
  currentUserId,
  localMode,
}: {
  currentUserId: string;
  localMode: boolean;
}) {
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [loading, setLoading] = useState(!localMode);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<AdminRole>("staff");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteMessageKind, setInviteMessageKind] = useState<"error" | "success">("error");

  const loadUsers = useCallback(async () => {
    if (localMode) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await invokeAccessManagement({ action: "list" });
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch {
      setLoadError("No pudimos cargar las cuentas con acceso. Inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  }, [localMode]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function inviteUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inviteBusy || localMode) return;

    const email = inviteEmail.trim();
    if (!email) {
      setInviteMessageKind("error");
      setInviteMessage("Ingresa el correo de la persona que quieres invitar.");
      return;
    }

    setInviteBusy(true);
    setInviteMessage(null);
    setInviteMessageKind("error");
    try {
      const data = await invokeAccessManagement({
        action: "invite",
        email,
        displayName: inviteName.trim(),
        role: inviteRole,
      });
      if (data.user) {
        setUsers((current) => {
          const withoutInvited = current.filter((item) => item.userId !== data.user?.userId);
          return data.user ? [data.user, ...withoutInvited] : current;
        });
      } else {
        await loadUsers();
      }
      setInviteEmail("");
      setInviteName("");
      setInviteRole("staff");
      setInviteMessageKind("success");
      setInviteMessage("Invitación enviada. La persona recibirá un correo para activar su acceso.");
    } catch {
      setInviteMessage("No pudimos enviar la invitación. Revisa el correo o inténtalo nuevamente.");
    } finally {
      setInviteBusy(false);
    }
  }

  function replaceUser(updated: AccessUser) {
    setUsers((current) => current.map((user) => (user.userId === updated.userId ? updated : user)));
  }

  return (
    <section className="admin-access-card" id="usuarios-accesos" aria-labelledby="usuarios-accesos-title">
      <div className="admin-content-editor__head">
        <div>
          <span className="metric-label">SEGURIDAD</span>
          <h2 id="usuarios-accesos-title">Usuarios y accesos</h2>
          <p>Invita personas, asigna Owner/Admin/Staff y controla quién puede entrar al panel.</p>
        </div>
      </div>

      {localMode ? (
        <div className="auth-notice" role="status">
          La gestión de usuarios está disponible cuando el panel usa la autenticación de producción.
        </div>
      ) : (
        <>
          <form className="admin-access-invite" onSubmit={inviteUser} noValidate>
            <Input
              label="Correo"
              name="invite-email"
              type="email"
              autoComplete="off"
              required
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="persona@correo.com"
            />
            <Input
              label="Nombre"
              name="invite-name"
              value={inviteName}
              onChange={(event) => setInviteName(event.target.value)}
              placeholder="Nombre de la persona"
            />
            <Select
              label="Rol"
              name="invite-role"
              options={roleOptions}
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as AdminRole)}
            />
            <Button type="submit" disabled={inviteBusy}>
              {inviteBusy ? "Enviando…" : "Invitar usuario"}
            </Button>
          </form>

          {inviteMessage ? (
            <div
              className={inviteMessageKind === "success" ? "auth-notice auth-notice--success" : "auth-error"}
              role={inviteMessageKind === "success" ? "status" : "alert"}
            >
              {inviteMessage}
            </div>
          ) : null}

          <div className="admin-access-list" aria-live="polite">
            {loading ? <div className="state-card">Cargando usuarios…</div> : null}
            {!loading && loadError ? (
              <div className="state-card">
                <p>{loadError}</p>
                <Button type="button" variant="secondary" onClick={() => void loadUsers()}>
                  Reintentar
                </Button>
              </div>
            ) : null}
            {!loading && !loadError && users.length === 0 ? (
              <div className="state-card">Todavía no hay otros usuarios para mostrar.</div>
            ) : null}
            {!loading && !loadError
              ? users.map((user) => (
                  <AdminAccessUserRow
                    key={user.userId}
                    user={user}
                    currentUserId={currentUserId}
                    onSaved={replaceUser}
                  />
                ))
              : null}
          </div>
        </>
      )}
    </section>
  );
}


