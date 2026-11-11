"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";

type Role = "owner" | "admin" | "staff";
type TeamUser = {
  userId: string;
  email: string;
  displayName: string | null;
  role: Role;
  isActive: boolean;
  emailConfirmed: boolean;
  isPrimaryOwner: boolean;
  lastSignInAt: string | null;
};
type ResponseBody = {
  ok?: boolean; code?: string; users?: TeamUser[]; user?: TeamUser; accessMode?: "linked" | "invited";
};
const ROLES: Array<{value: Role;label:string}> = [
  {value:"owner",label:"Propietario adicional"},
  {value:"admin",label:"Administrador del negocio"},
  {value:"staff",label:"Personal / empleado"},
];
function readableError(code: string) {
  const lookup: Record<string,string> = {
    user_assigned_elsewhere: "Esta cuenta ya está vinculada a otro negocio.",
    user_already_in_business: "La persona ya tiene acceso a este negocio. Puedes actualizar su rol abajo.",
    platform_admin_cannot_join_tenant: "Una cuenta administradora global no puede ser usuaria de un negocio hijo.",
    existing_account_unconfirmed: "El correo ya existe, pero primero debe verificarse antes de recibir otro acceso.",
    existing_account_inactive: "La cuenta está desactivada.",
    primary_owner_transfer_required: "El propietario principal se cambia únicamente mediante «Recuperar propietario».",
    active_owner_required: "Debe quedar al menos un propietario activo.",
    platform_admin_team_access_denied: "Tu sesión global no tiene permisos para este negocio.",
    email_in_use: "El correo ya está registrado. Revisa el estado de esa cuenta.",
    rate_limited: "Se alcanzó el límite de invitaciones por correo. Inténtalo más tarde.",
    service_unavailable: "No se pudo completar la solicitud. Inténtalo nuevamente.",
  };
  return lookup[code] || "No pudimos gestionar este acceso. Revisa los datos y vuelve a intentar.";
}
async function invoke(body: Record<string,unknown>): Promise<ResponseBody> {
  const { data, error } = await createPublicBrowserSupabaseClient()
    .functions.invoke<ResponseBody>("platform-business-access",{body});
  if (error) {
    const ctx = (error as {context?: unknown}).context;
    if (typeof Response !== "undefined" && ctx instanceof Response) {
      try { const payload = await ctx.clone().json() as ResponseBody; throw new Error(payload.code || "service_unavailable"); }
      catch (cause) { if (cause instanceof Error && cause.message !== "service_unavailable" && cause.name === "Error") throw cause; }
    }
    throw new Error("service_unavailable");
  }
  if (!data?.ok) throw new Error(data?.code || "service_unavailable");
  return data;
}

function TeamUserEditor({user,businessId,onSaved}: {
  user:TeamUser;businessId:string;onSaved:(user:TeamUser)=>void;
}) {
  const [role,setRole] = useState<Role>(user.role);
  const [name,setName] = useState(user.displayName || "");
  const [active,setActive] = useState(user.isActive);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState<string|null>(null);

  async function save() {
    if (busy || user.isPrimaryOwner) return;
    if (!active && user.role === "owner" && !window.confirm("¿Desactivar a este propietario? Perderá acceso al panel del negocio.")) return;
    setBusy(true);setMessage(null);
    try {
      const result=await invoke({action:"update",businessId,userId:user.userId,
        role,isActive:active,displayName:name.trim()});
      if (result.user) onSaved(result.user);
      setMessage("Acceso actualizado.");
    } catch(error) {
      setMessage(readableError(error instanceof Error ? error.message : ""));
    } finally {setBusy(false);}
  }
  return <article className="global-team-user">
    <div className="global-team-user__identity">
      <strong>{user.email}</strong>
      <small>{user.isPrimaryOwner ? "Propietario principal · solo mediante transferencia" :
        user.emailConfirmed ? "Correo verificado" : "Invitación pendiente de activación"}</small>
    </div>
    {user.isPrimaryOwner ? <span className="global-team-pill">Propiedad protegida</span> : <>
      <label>Nombre<input maxLength={120} value={name} onChange={(event)=>setName(event.target.value)}/></label>
      <label>Rol<select value={role} onChange={(event)=>setRole(event.target.value as Role)}>
        {ROLES.map((item)=><option value={item.value} key={item.value}>{item.label}</option>)}
      </select></label>
      <label className="global-team-active"><input type="checkbox" checked={active} onChange={(event)=>setActive(event.target.checked)}/> Acceso activo</label>
      <button type="button" className="button button--secondary" disabled={busy} onClick={()=>void save()}>{busy?"Guardando…":"Guardar rol"}</button>
    </>}
    {message ? <small className="global-team-message" role="status">{message}</small> : null}
  </article>;
}

export function GlobalBusinessTeamPanel({businessId,businessName}: {businessId:string;businessName:string}) {
  const [users,setUsers]=useState<TeamUser[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [email,setEmail]=useState("");
  const [displayName,setDisplayName]=useState("");
  const [role,setRole]=useState<Role>("staff");
  const [message,setMessage]=useState<{error:boolean;text:string}|null>(null);
  const load=useCallback(async()=>{
    setLoading(true);
    try {
      const result=await invoke({action:"list",businessId});
      setUsers(result.users || []);
      setMessage(null);
    } catch(error) {setMessage({error:true,text:readableError(error instanceof Error ? error.message:"")});}
    finally {setLoading(false);}
  },[businessId]);
  useEffect(()=>{void load();},[load]);

  async function invite(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(busy) return;
    setBusy(true);setMessage(null);
    try{
      const result=await invoke({action:"invite",businessId,
        email:email.trim(),displayName:displayName.trim(),role});
      setEmail("");setDisplayName("");setRole("staff");
      await load();
      setMessage({error:false,text:result.accessMode==="linked"
        ? "Cuenta existente vinculada al negocio. La persona puede iniciar sesión con sus credenciales."
        : "Invitación segura enviada por correo. La persona deberá activarla para acceder."});
    } catch(error) {setMessage({error:true,text:readableError(error instanceof Error?error.message:"")});}
    finally {setBusy(false);}
  }

  return <section className="global-team-panel" aria-label={`Equipo y accesos de ${businessName}`}>
    <div className="global-team-panel__heading">
      <div><span className="eyebrow">CONTROL DE ACCESOS</span><h3>Equipo de {businessName}</h3>
        <p>Cada persona usa su propio correo y contraseña. Las invitaciones son individuales, sin compartir tu sesión de administrador global.</p></div>
      <button type="button" className="button button--secondary" onClick={()=>void load()} disabled={loading}>Actualizar lista</button>
    </div>
    <div className="global-team-roles" aria-label="Permisos por rol">
      <div><b>Propietario</b><span>Configuración, diseño, precios, empleados y operación.</span></div>
      <div><b>Administrador</b><span>Diseño, canchas, horarios, tarifas, reservas y reportes.</span></div>
      <div><b>Personal</b><span>Operación de reservas, agenda y lecturas autorizadas; sin acceso para publicar diseños ni modificar tarifas.</span></div>
    </div>
    <form className="global-team-invite" onSubmit={(event)=>void invite(event)}>
      <label>Correo electrónico<input type="email" value={email} onChange={(event)=>setEmail(event.target.value)} placeholder="colaborador@correo.com" required maxLength={254}/></label>
      <label>Nombre (opcional)<input value={displayName} onChange={(event)=>setDisplayName(event.target.value)} maxLength={120} placeholder="Nombre y apellido"/></label>
      <label>Rol inicial<select value={role} onChange={(event)=>setRole(event.target.value as Role)}>{ROLES.map((item)=><option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
      <button type="submit" className="button button--primary" disabled={busy}>{busy?"Enviando…":"Enviar invitación"}</button>
    </form>
    <p className="global-team-panel__note">El propietario principal se asigna en el alta del negocio o mediante «Recuperar propietario». Invitar a un propietario adicional no transfiere esa propiedad.</p>
    {message ? <p className={message.error?"auth-error":"global-admin-notice"} role={message.error?"alert":"status"}>{message.text}</p>:null}
    <div className="global-team-users">{loading ? <p>Cargando usuarios…</p> :
      users.length?users.map((user)=><TeamUserEditor key={user.userId} businessId={businessId} user={user} onSaved={(updated)=>setUsers((current)=>current.map((item)=>item.userId===updated.userId?updated:item))}/>):
      <p>No se encontraron perfiles para este negocio. Revisa la invitación del propietario principal.</p>}
    </div>
  </section>;
}
