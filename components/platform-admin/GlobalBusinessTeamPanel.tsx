"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";

type Role = "owner" | "admin" | "staff";
type ProvisionMode = "invite" | "provision";
type TeamUser = {
  userId: string;
  email: string;
  displayName: string | null;
  role: Role;
  isActive: boolean;
  emailConfirmed: boolean;
  isPrimaryOwner: boolean;
  lastSignInAt: string | null;
  pendingActivation?: boolean;
};
type AccessEvent = {
  id: number;
  targetUserId: string | null;
  eventType: "invite" | "provision" | "update" | "recovery" | "invitation_link";
  result: "pending" | "success" | "failed";
  errorCode: string | null;
  createdAt: string;
};
type ResponseBody = {
  ok?: boolean; code?: string; users?: TeamUser[]; user?: TeamUser;
  accessMode?: "linked" | "invited" | "temporary"; temporaryPassword?: string;
  partial?: boolean; unavailableCount?: number; totalProfiles?: number;
  events?: AccessEvent[]; delivery?: "email_requested";
};
const ROLES: Array<{value: Role;label:string}> = [
  {value:"owner",label:"Propietario adicional"},
  {value:"admin",label:"Administrador del negocio"},
  {value:"staff",label:"Personal / empleado"},
];
const ROLE_PERMISSIONS: Record<Role,string> = {
  owner: "Control completo del negocio: equipo, diseño, sedes, canchas, tarifas y operaciones. No transfiere la propiedad principal.",
  admin: "Puede gestionar diseño, canchas, tarifas, horarios, reservas y reportes, pero no recibe privilegios globales.",
  staff: "Puede operar la agenda y reservas con permisos limitados, sin modificar tarifas ni publicar diseños.",
};
function readableError(code: string) {
  const lookup: Record<string,string> = {
    authentication_required: "La sesión expiró. Inicia sesión nuevamente para gestionar accesos.",
    invalid_payload: "Revisa el correo, el nombre y el rol antes de continuar.",
    user_not_in_business: "Esta persona ya no pertenece al equipo del negocio. Actualiza la lista.",
    user_assigned_elsewhere: "Esta cuenta ya está vinculada a otra página hija. La plataforma actual permite un negocio por cuenta.",
    user_already_in_business: "Este correo ya tiene acceso a esta página hija. Revisa su ficha antes de enviar otra invitación.",
    platform_admin_cannot_join_tenant: "Una cuenta administradora global no puede ser usuaria de un negocio hijo.",
    existing_account_unconfirmed: "El correo ya existe, pero primero debe verificarse antes de recibir otro acceso.",
    existing_account_inactive: "La cuenta está desactivada.",
    primary_owner_transfer_required: "El propietario principal se cambia únicamente mediante «Recuperar propietario».",
    active_owner_required: "Debe quedar al menos un propietario activo.",
    platform_admin_team_access_denied: "Tu sesión global no tiene permisos para este negocio.",
    rate_limited: "Hay un límite temporal de solicitudes para esta cuenta. No repitas la operación inmediatamente.",
    account_not_active: "El perfil se encuentra suspendido. Actívalo con la autorización correspondiente antes de recuperar la clave.",
    invitation_not_pending: "El correo ya está confirmado o no existe una invitación pendiente. Usa recuperación de contraseña.",
    mail_delivery_failed: "El proveedor no confirmó el envío. Consulta la auditoría y comprueba la configuración del correo.",
    pending_password_activation: "Esta cuenta debe sustituir su clave provisional antes de quedar activa.",
    email_in_use: "El correo ya existe. Para evitar sobrescribir una contraseña, usa invitación o administra esa cuenta existente.",
    configuration: "El servidor de accesos no está configurado. Contacta al administrador técnico.",
    service_unavailable: "El servidor no pudo completar la operación. Comprueba la lista antes de reintentar para evitar duplicados.",
  };
  return lookup[code] || "No pudimos gestionar este acceso. Revisa los datos y vuelve a intentar.";
}
async function invoke(body: Record<string,unknown>): Promise<ResponseBody> {
  const client=createPublicBrowserSupabaseClient();
  // En el navegador getSession puede renovar el JWT caducado. Esto NO
  // autoriza ninguna acción: la Edge Function vuelve a validar el usuario.
  const {data:sessionData,error:sessionError}=await client.auth.getSession();
  if (sessionError || !sessionData.session) throw new Error("authentication_required");
  const { data, error } = await client.functions.invoke<ResponseBody>("platform-business-access",{body});
  if (error) {
    const ctx = (error as {context?: unknown}).context;
    if (typeof Response !== "undefined" && ctx instanceof Response) {
      // El Gateway puede devolver 401/403 SIN un código JSON de aplicación.
      // No disfrazar expiración de sesión como un error HTTP 503.
      let errorCode = ctx.status===401 ? "authentication_required"
        : ctx.status===403 ? "platform_admin_team_access_denied" : "service_unavailable";
      try {
        const payload = await ctx.clone().json() as ResponseBody;
        if (typeof payload.code === "string" && /^[a-z][a-z0-9_]{1,55}$/.test(payload.code)) {
          errorCode = payload.code;
        }
      } catch {
        // La respuesta podría ser texto plano o no estar disponible.
      }
      throw new Error(errorCode);
    }
    throw new Error("service_unavailable");
  }
  if (!data?.ok) throw new Error(data?.code || "service_unavailable");
  return data;
}

function TeamUserEditor({user,businessId,onSaved,onChanged}: {
  user:TeamUser;businessId:string;onSaved:(user:TeamUser)=>void;onChanged:()=>void;
}) {
  const [role,setRole] = useState<Role>(user.role);
  const [name,setName] = useState(user.displayName || "");
  const [active,setActive] = useState(user.isActive);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState<string|null>(null);

  useEffect(() => {
    setRole(user.role);
    setName(user.displayName || "");
    setActive(user.isActive);
  }, [user.role, user.displayName, user.isActive]);

  async function recover() {
    if (busy || !window.confirm("¿Solicitar un correo de recuperación para esta cuenta existente? No se cambiará su contraseña desde este panel.")) return;
    setBusy(true);setMessage(null);
    try {
      const result = await invoke({action:"recover",businessId,userId:user.userId});
      setMessage(result.delivery==="email_requested"
        ? "Solicitud enviada al proveedor de correo. La persona debe abrir el enlace y establecer su propia contraseña."
        : "Solicitud procesada.");
      onChanged();
    } catch(error) {
      setMessage(readableError(error instanceof Error ? error.message : ""));
      onChanged();
    } finally {setBusy(false);}
  }

  async function resendInvitationEmail() {
    if (busy || !window.confirm("¿Solicitar otro correo de activación para esta invitación pendiente? No se crearán cuentas adicionales.")) return;
    setBusy(true);setMessage(null);
    try {
      const result=await invoke({action:"invitation_link",businessId,userId:user.userId});
      if (result.delivery!=="email_requested") throw new Error("service_unavailable");
      setMessage("Solicitud de reenvío aceptada. El enlace de activación se entrega solamente al correo del titular.");
      onChanged();
    } catch(error) {
      setMessage(readableError(error instanceof Error ? error.message : ""));
      onChanged();
    } finally {setBusy(false);}
  }

  async function save() {
    if (busy || user.isPrimaryOwner) return;
    if (!active && user.role === "owner" && !window.confirm("¿Desactivar a este propietario? Perderá acceso al panel del negocio.")) return;
    setBusy(true);setMessage(null);
    try {
      const result=await invoke({action:"update",businessId,userId:user.userId,
        role,isActive:active,displayName:name.trim()});
      if (result.user) onSaved(result.user);
      setMessage("Acceso actualizado.");
      onChanged();
    } catch(error) {
      setMessage(readableError(error instanceof Error ? error.message : ""));
    } finally {setBusy(false);}
  }
  return <article className="global-team-user">
    <div className="global-team-user__identity">
      <strong>{user.email}</strong>
      <small>{user.isPrimaryOwner ? "Propietario principal · solo mediante transferencia" :
        user.pendingActivation ? "Clave provisional emitida · pendiente de activación" :
        !user.emailConfirmed ? "Invitación pendiente · correo aún no verificado" :
        user.isActive ? "Correo verificado · perfil habilitado" : "Correo verificado · perfil suspendido"}</small>
      <small>{user.lastSignInAt
        ? `Último inicio registrado: ${new Date(user.lastSignInAt).toLocaleString("es-PE")}`
        : "Aún no hay un inicio de sesión registrado"}</small>
    </div>
    {user.isPrimaryOwner ? <span className="global-team-pill">Propiedad protegida</span> : <>
      <label>Nombre<input maxLength={120} value={name} onChange={(event)=>setName(event.target.value)}/></label>
      <label>Rol<select value={role} onChange={(event)=>setRole(event.target.value as Role)}>
        {ROLES.map((item)=><option value={item.value} key={item.value}>{item.label}</option>)}
      </select></label>
      <label className="global-team-active"><input type="checkbox" checked={active} disabled={Boolean(user.pendingActivation)} onChange={(event)=>setActive(event.target.checked)}/> Acceso activo</label>
      <button type="button" className="button button--secondary" disabled={busy} onClick={()=>void save()}>{busy?"Guardando…":"Guardar rol"}</button>
      {!user.pendingActivation && user.emailConfirmed && user.isActive
        ? <button type="button" className="button button--secondary" disabled={busy} onClick={()=>void recover()}>
          Enviar recuperación
        </button> : null}
      {!user.pendingActivation && !user.emailConfirmed
        ? <button type="button" className="button button--secondary" disabled={busy} onClick={()=>void resendInvitationEmail()}>
          Reenviar activación por correo
        </button> : null}
    </>}
    {message ? <small className="global-team-message" role="status">{message}</small> : null}
  </article>;
}

export function GlobalBusinessTeamPanel({businessId,businessName}: {businessId:string;businessName:string}) {
  const [users,setUsers]=useState<TeamUser[]>([]);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState<string|null>(null);
  const [partialCount,setPartialCount]=useState(0);
  const [events,setEvents]=useState<AccessEvent[]>([]);
  const [auditError,setAuditError]=useState<string|null>(null);
  const [auditLoading,setAuditLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [email,setEmail]=useState("");
  const [displayName,setDisplayName]=useState("");
  const [role,setRole]=useState<Role>("staff");
  const [mode,setMode]=useState<ProvisionMode>("invite");
  const [oneTimeCredential,setOneTimeCredential]=useState<{email:string;password:string}|null>(null);
  const [message,setMessage]=useState<{error:boolean;text:string}|null>(null);
  const load=useCallback(async()=>{
    setLoading(true);
    setLoadError(null);
    try {
      const result=await invoke({action:"list",businessId});
      setUsers(result.users || []);
      setPartialCount(result.partial ? (result.unavailableCount ?? 1) : 0);
    } catch(error) {setLoadError(readableError(error instanceof Error ? error.message:""));}
    finally {setLoading(false);}
  },[businessId]);
  const loadAudit=useCallback(async()=>{
    setAuditLoading(true);setAuditError(null);
    try {
      const result=await invoke({action:"audit",businessId});
      setEvents(result.events || []);
    } catch(error) {
      setAuditError(readableError(error instanceof Error ? error.message : ""));
    } finally {setAuditLoading(false);}
  },[businessId]);
  useEffect(()=>{
    setOneTimeCredential(null);
    setEmail("");setDisplayName("");setRole("staff");setMessage(null);
    setUsers([]);setEvents([]);setPartialCount(0);
    void load();void loadAudit();
  },[load,loadAudit]);

  async function invite(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(busy) return;
    const normalizedEmail=email.trim().toLowerCase();
    if(users.some((user)=>user.email.trim().toLowerCase()===normalizedEmail)) {
      setMessage({error:true,text:"Este correo ya aparece en el equipo. No vuelvas a crearlo; utiliza la ficha existente o la recuperación de propietario."});
      return;
    }
    setBusy(true);setMessage(null);
    try{
      const result=await invoke({action:mode,businessId,
        email:normalizedEmail,displayName:displayName.trim(),role});
      setEmail("");setDisplayName("");setRole("staff");
      if(mode==="provision") {
        if(!result.temporaryPassword) throw new Error("service_unavailable");
        setOneTimeCredential({email:normalizedEmail,password:result.temporaryPassword});
      } else setOneTimeCredential(null);
      await load();
      void loadAudit();
      setMessage({error:false,text:mode==="provision"
        ? "Cuenta creada con acceso suspendido. Entrega la clave provisional de forma privada; al cambiarla, sus permisos se activarán."
        : result.accessMode==="linked"
          ? "Cuenta existente vinculada al negocio. La persona puede iniciar sesión con sus credenciales."
          : "Invitación segura enviada por correo. La persona deberá activarla para acceder."});
    } catch(error) {setMessage({error:true,text:readableError(error instanceof Error?error.message:"")});}
    finally {setBusy(false);}
  }

  return <section className="global-team-panel" aria-label={`Equipo y accesos de ${businessName}`}>
    <div className="global-team-panel__heading">
      <div><span className="eyebrow">CONTROL DE ACCESOS</span><h3>Equipo de {businessName}</h3>
        <p>Desde este panel global autorizas correos para esta página hija, eliges su rol y puedes retirar acceso. Cada persona tendrá una clave independiente de la tuya.</p></div>
      <button type="button" className="button button--secondary" onClick={()=>{void load();void loadAudit();}} disabled={loading}>Actualizar lista</button>
    </div>
    <div className="global-team-roles" aria-label="Permisos por rol">
      <div><b>Propietario</b><span>Configuración, diseño, precios, empleados y operación.</span></div>
      <div><b>Administrador</b><span>Diseño, canchas, horarios, tarifas, reservas y reportes.</span></div>
      <div><b>Personal</b><span>Operación de reservas, agenda y lecturas autorizadas; sin acceso para publicar diseños ni modificar tarifas.</span></div>
    </div>
    <div className="global-team-access-mode" role="group" aria-label="Método de creación de acceso">
      <button type="button" className={mode==="invite"?"is-selected":""} aria-pressed={mode==="invite"} onClick={()=>setMode("invite")}>Enviar invitación por correo</button>
      <button type="button" className={mode==="provision"?"is-selected":""} aria-pressed={mode==="provision"} onClick={()=>setMode("provision")}>Crear con clave temporal</button>
    </div>
    <p className="global-team-panel__note">{mode==="provision"
      ? "La plataforma genera una clave segura que solo verás una vez. Comparte correo y clave por un canal privado. La cuenta queda sin permisos operativos hasta que su titular cree una nueva contraseña."
      : "El destinatario recibe un enlace protegido para establecer su propia contraseña. No necesitas conocer ni compartir su clave."}</p>
    <form className="global-team-invite" onSubmit={(event)=>void invite(event)}>
      <label>Correo electrónico<input type="email" value={email} onChange={(event)=>setEmail(event.target.value)} placeholder="colaborador@correo.com" required maxLength={254}/></label>
      <label>Nombre (opcional)<input value={displayName} onChange={(event)=>setDisplayName(event.target.value)} maxLength={120} placeholder="Nombre y apellido"/></label>
      <label>Rol inicial<select value={role} onChange={(event)=>setRole(event.target.value as Role)}>{ROLES.map((item)=><option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
      <button type="submit" className="button button--primary" disabled={busy || loading || Boolean(loadError) || partialCount>0}>{busy?"Procesando…":mode==="provision"?"Crear acceso y clave":"Enviar invitación"}</button>
    </form>
    <p className="global-team-panel__note" role="status"><strong>Permisos del rol seleccionado:</strong> {ROLE_PERMISSIONS[role]}</p>
    <p className="global-team-panel__note">El propietario principal se asigna en el alta del negocio o mediante «Recuperar propietario». Invitar a un propietario adicional no transfiere esa propiedad.</p>
    {message ? <p className={message.error?"auth-error":"global-admin-notice"} role={message.error?"alert":"status"}>{message.text}</p>:null}
    {partialCount>0 ? <p className="auth-error" role="alert">
      La consulta está incompleta: {partialCount} perfil(es) no pudieron verificarse en Auth.
      No crees accesos nuevos mientras esta lista sea parcial. Actualiza para comprobarlos.
    </p>:null}
    {oneTimeCredential ? <section className="global-team-one-time" aria-label="Clave provisional de un solo uso visual">
      <strong>Credenciales provisionales · copiar ahora</strong>
      <p>El acceso todavía no está activado. Esta clave no podrá volver a consultarse desde el panel.</p>
      <p>Correo: <b>{oneTimeCredential.email}</b></p>
      <label>Clave provisional<input type="text" readOnly value={oneTimeCredential.password} onFocus={(event)=>event.currentTarget.select()}/></label>
      <p>Enlace de activación: <a href="/admin/activar?modo=temporal" target="_blank" rel="noreferrer">Abrir formulario para sustituir la clave</a></p>
      <div className="global-team-one-time__actions">
        <button type="button" className="button button--secondary" onClick={()=>{
          void navigator.clipboard.writeText(`Caxas SportCenter · ${businessName}\nCorreo: ${oneTimeCredential.email}\nClave temporal: ${oneTimeCredential.password}\nActivar en: ${window.location.origin}/admin/activar?modo=temporal`).catch(()=>{
            setMessage({error:true,text:"No fue posible copiar automáticamente. Selecciona la clave provisional y cópiala manualmente."});
          });
        }}>Copiar instrucciones y clave</button>
        <button type="button" className="button button--secondary" onClick={()=>setOneTimeCredential(null)}>Ocultar clave definitivamente</button>
      </div>
    </section>:null}
    <div className="global-team-users">{loading ? <p>Cargando usuarios…</p> : loadError ? (
      <div role="alert" className="auth-error"><p>{loadError}</p>
        <p>Si tenías una lista anterior, se conserva como referencia, pero no confirma el estado actual.</p>
        <div className="global-team-one-time__actions">
          <button type="button" className="button button--secondary" onClick={()=>void load()}>Reintentar consulta</button>
          <a className="button button--secondary" href="/admin/login?next=%2Fadmin-global">Volver a iniciar sesión</a>
        </div>
      </div>
    ) : null}
    {!loading && users.length ? users.map((user)=><TeamUserEditor key={user.userId} businessId={businessId}
      user={user} onSaved={(updated)=>setUsers((current)=>current.map((item)=>item.userId===updated.userId?updated:item))}
      onChanged={()=>void loadAudit()}/>) :
      !loading && !loadError && partialCount===0 ?
      <p>No se encontraron perfiles para este negocio. Revisa la invitación del propietario principal.</p> : null}
    </div>
    <section className="global-team-audit" aria-label="Historial de control de accesos">
      <div className="global-team-panel__heading">
        <div><span className="eyebrow">AUDITORÍA</span><h4>Últimas acciones de acceso</h4>
          <p>Registro del negocio actual. No almacena contraseñas ni enlaces confidenciales.</p></div>
        <button type="button" className="button button--secondary" disabled={auditLoading} onClick={()=>void loadAudit()}>
          {auditLoading?"Consultando…":"Actualizar historial"}
        </button>
      </div>
      {auditError ? <p className="auth-error" role="alert">No se pudo leer la auditoría: {auditError}</p> : null}
      {!auditError && !auditLoading && events.length===0 ? <p className="global-team-panel__note">
        No hay acciones registradas desde la activación de la auditoría.
      </p> : null}
      {events.length>0 ? <div className="global-team-audit__list">
        {events.map((event)=>{
          const eventLabels:Record<AccessEvent["eventType"],string>={
            invite:"Invitación / vinculación",provision:"Alta con clave provisional",
            update:"Actualización de rol o estado",recovery:"Solicitud de recuperación",
            invitation_link:"Reenvío de activación",
          };
          const related=users.find((user)=>user.userId===event.targetUserId);
          return <div key={event.id} className="global-team-audit__item">
            <div><strong>{eventLabels[event.eventType]}</strong>
              <small>{related?.email || (event.targetUserId ? "Usuario del negocio" : "Sin destinatario")}</small></div>
            <div><small>{new Date(event.createdAt).toLocaleString("es-PE")}</small>
              <small>{event.result==="success" ? "Completado" : event.result==="failed" ? "Fallido" : "En curso"}
                {event.errorCode ? ` · ${event.errorCode}` : ""}</small></div>
          </div>;
        })}
      </div> : null}
    </section>
  </section>;
}
