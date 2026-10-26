"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
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
  isPrimaryOwner: boolean;
  canReceivePrimaryOwnership: boolean;
};

type AccessResponse = {
  ok?: boolean;
  users?: AccessUser[];
  user?: AccessUser;
  accessMode?: "linked" | "invited";
  canTransferPrimaryOwnership?: boolean;
  primaryOwnerUserId?: string;
  code?: string;
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
  if (!data?.ok) throw new Error(data?.code || data?.error || "access_management_failed");
  return data;
}

function accessMutationMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code.includes("primary_owner_transfer_required")) return "Ese usuario es el propietario principal. Transfiere primero la propiedad principal antes de cambiar su rol o acceso.";
  if (code.includes("primary_owner_required")) return "La propiedad principal cambió mientras tenías esta pantalla abierta. Recarga y revisa el propietario actual.";
  if (code.includes("ownership_target_inactive")) return "La persona seleccionada ya no está activa. Recarga la lista y elige otro usuario.";
  if (code.includes("ownership_target_unconfirmed")) return "La persona seleccionada todavía no confirmó su correo.";
  if (code.includes("ownership_target_not_found")) return "La persona seleccionada ya no pertenece a este negocio.";
  if (code.includes("platform_admin_cannot_be_tenant_owner")) return "Una cuenta ADMIN global no puede ser propietaria principal de un tenant.";
  return "No pudimos completar el cambio. Inténtalo nuevamente.";
}

function AdminAccessUserRow({
  user,
  currentUserId,
  businessName,
  canTransferPrimaryOwnership,
  onSaved,
  onTransferred,
}: {
  user: AccessUser;
  currentUserId: string;
  businessName: string;
  canTransferPrimaryOwnership: boolean;
  onSaved: (user: AccessUser) => void;
  onTransferred: (email: string) => Promise<void>;
}) {
  const isCurrentUser = user.userId === currentUserId;
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [role, setRole] = useState<AdminRole>(user.role);
  const [isActive, setIsActive] = useState(user.isActive);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<"success" | "error">("success");
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const [transferBusy, setTransferBusy] = useState(false);
  const cancelTransferRef = useRef<HTMLButtonElement>(null);
  const transferTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setDisplayName(user.displayName ?? "");
    setRole(user.role);
    setIsActive(user.isActive);
  }, [user.displayName, user.role, user.isActive]);

  useEffect(() => {
    if (confirmTransfer) cancelTransferRef.current?.focus();
  }, [confirmTransfer]);

  function cancelTransfer() {
    if (transferBusy) return;
    setConfirmTransfer(false);
    requestAnimationFrame(() => transferTriggerRef.current?.focus());
  }

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
      setMessageKind("success");
      setMessage("Acceso actualizado.");
    } catch (error) {
      setMessageKind("error");
      setMessage(accessMutationMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function transferOwnership() {
    if (transferBusy || !canTransferPrimaryOwnership || !user.canReceivePrimaryOwnership) return;
    setTransferBusy(true);
    setMessage(null);
    try {
      await invokeAccessManagement({ action: "transfer_owner", userId: user.userId });
      setConfirmTransfer(false);
      await onTransferred(user.email);
    } catch (error) {
      setMessageKind("error");
      setMessage(accessMutationMessage(error));
    } finally {
      setTransferBusy(false);
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
          {user.isPrimaryOwner ? <Badge tone="warning">Propietario principal</Badge> : null}
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
          disabled={isCurrentUser || user.isPrimaryOwner}
          onChange={(event) => setRole(event.target.value as AdminRole)}
        />
        <label className="admin-access-toggle">
          <input
            type="checkbox"
            checked={isActive}
            disabled={isCurrentUser || user.isPrimaryOwner}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          <span>Puede acceder al panel</span>
        </label>
      </div>

      <div className="admin-access-user__footer">
        <small>Último ingreso: {formatAccessDate(user.lastSignInAt)}</small>
        <div className="admin-access-user__actions">
          {message ? <span role={messageKind === "error" ? "alert" : "status"}>{message}</span> : null}
          <Button type="button" variant="secondary" disabled={busy} onClick={save}>
            {busy ? "Guardando…" : "Guardar cambios"}
          </Button>
          {canTransferPrimaryOwnership && user.canReceivePrimaryOwnership && !isCurrentUser ? (
            <button ref={transferTriggerRef} type="button" className="button button--ghost" disabled={transferBusy} onClick={() => setConfirmTransfer(true)}>
              Transferir propiedad principal
            </button>
          ) : null}
        </div>
      </div>

      {confirmTransfer ? (
        <div className="admin-owner-transfer" role="group" aria-labelledby={`transfer-title-${user.userId}`} aria-describedby={`transfer-detail-${user.userId}`}>
          <div>
            <strong id={`transfer-title-${user.userId}`}>Transferir propiedad principal</strong>
            <p id={`transfer-detail-${user.userId}`}>
              {user.email} será el nuevo propietario principal de {businessName}. {user.role !== "owner" ? "Pasará a tener rol Propietario. " : ""}Tu cuenta seguirá como Propietario activo.
            </p>
          </div>
          <div className="admin-owner-transfer__actions">
            <button ref={cancelTransferRef} type="button" className="button button--secondary" disabled={transferBusy} onClick={cancelTransfer}>Cancelar</button>
            <Button type="button" disabled={transferBusy} onClick={() => void transferOwnership()}>{transferBusy ? "Transfiriendo…" : "Transferir propiedad principal"}</Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function AdminAccessManagement({
  currentUserId,
  businessName,
  localMode,
}: {
  currentUserId: string;
  businessName: string;
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
  const [canTransferPrimaryOwnership, setCanTransferPrimaryOwnership] = useState(false);
  const [transferMessage, setTransferMessage] = useState<string | null>(null);
  const transferMessageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transferMessage) transferMessageRef.current?.focus();
  }, [transferMessage]);

  const loadUsers = useCallback(async () => {
    if (localMode) return;
    setLoading(true);
    setLoadError(null);
    setCanTransferPrimaryOwnership(false);
    try {
      const data = await invokeAccessManagement({ action: "list" });
      setUsers(Array.isArray(data.users) ? data.users : []);
      setCanTransferPrimaryOwnership(data.canTransferPrimaryOwnership === true);
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
      setInviteMessage(data.accessMode === "linked"
        ? "La cuenta ya existía en Caxas y quedó vinculada a este negocio."
        : "Invitación enviada. La persona recibirá un correo para activar su acceso.");
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setInviteMessage(
        code.includes("user_assigned_elsewhere")
          ? "Esa cuenta ya pertenece a otro negocio y no puede vincularse aquí."
          : code.includes("platform_admin_cannot_join_tenant")
            ? "La cuenta ADMIN global no puede añadirse como usuario de un tenant."
            : code.includes("existing_account_unconfirmed")
              ? "Esa cuenta ya existe, pero todavía debe confirmar su correo antes de recibir acceso."
              : code.includes("existing_account_inactive")
                ? "Esa cuenta está desactivada a nivel de plataforma y no puede recibir acceso."
                : code.includes("user_already_in_business")
                  ? "Esa cuenta ya pertenece a este negocio. Actualiza su acceso desde la lista de usuarios."
                  : "No pudimos agregar a la persona. Revisa el correo o inténtalo nuevamente.",
      );
    } finally {
      setInviteBusy(false);
    }
  }

  function replaceUser(updated: AccessUser) {
    setUsers((current) => current.map((user) => (user.userId === updated.userId ? updated : user)));
  }

  async function refreshAfterTransfer(email: string) {
    setCanTransferPrimaryOwnership(false);
    setTransferMessage(null);
    await loadUsers();
    setTransferMessage(`La propiedad principal se transfirió a ${email}. Conservas acceso como Propietario.`);
  }

  const eligibleTransferCount = users.filter((user) => user.canReceivePrimaryOwnership).length;

  return (
    <section className="admin-access-card" id="usuarios-accesos" aria-labelledby="usuarios-accesos-title">
      <div className="admin-content-editor__head">
        <div>
          <span className="metric-label">SEGURIDAD</span>
          <h2 id="usuarios-accesos-title">Usuarios y accesos</h2>
          <p>Invita personas, asigna Propietario/Administrador/Personal y controla quién puede entrar al panel. El Propietario principal es único y solo cambia mediante una transferencia explícita.</p>
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
              {inviteBusy ? "Agregando…" : "Agregar usuario"}
            </Button>
          </form>

          <p className="admin-access-invite__hint">Si el correo ya tiene una cuenta en Caxas, se vinculará sin crear otra. Si todavía no existe, enviaremos una invitación segura.</p>

          {inviteMessage ? (
            <div
              className={inviteMessageKind === "success" ? "auth-notice auth-notice--success" : "auth-error"}
              role={inviteMessageKind === "success" ? "status" : "alert"}
            >
              {inviteMessage}
            </div>
          ) : null}

          {!loading && !loadError && canTransferPrimaryOwnership && eligibleTransferCount === 0 ? (
            <div className="auth-notice" role="status">
              No hay otro usuario activo y verificado elegible. Invita o activa a una persona antes de transferir la propiedad principal.
            </div>
          ) : null}

          {transferMessage ? (
            <div ref={transferMessageRef} className="auth-notice auth-notice--success" role="status" tabIndex={-1}>
              {transferMessage}
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
                    businessName={businessName}
                    canTransferPrimaryOwnership={canTransferPrimaryOwnership}
                    onSaved={replaceUser}
                    onTransferred={refreshAfterTransfer}
                  />
                ))
              : null}
          </div>
        </>
      )}
    </section>
  );
}


