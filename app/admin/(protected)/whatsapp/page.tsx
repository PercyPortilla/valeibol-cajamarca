import { redirect } from "next/navigation";

export default function AdminWhatsAppPage() {
  // La mensajería no se configura desde el panel. Conservamos esta ruta únicamente
  // por compatibilidad con checkpoints/enlaces antiguos y la enviamos a Configuración.
  redirect("/admin/configuracion");
}
