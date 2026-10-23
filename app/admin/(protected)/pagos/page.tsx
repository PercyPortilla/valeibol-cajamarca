import { AdminPaymentsPanel } from "@/components/admin/AdminPaymentsPanel";
import { Badge } from "@/components/ui/Badge";
import { requireAdminContext } from "@/lib/auth/server";
import { isLocalDevAdminUserId } from "@/lib/auth/localDev";
import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import type { Database } from "@/lib/data/supabase/database.types";

export default async function AdminPaymentsPage() {
  const context = await requireAdminContext();
  const localMode = isLocalDevAdminUserId(context.userId);
  let methods: Database["public"]["Functions"]["get_admin_payment_methods"]["Returns"] = [];
  let payments: Database["public"]["Functions"]["get_admin_payments"]["Returns"] = [];
  let loadFailed = false;

  if (!localMode) {
    try {
      const client = await createServerSupabaseClient();
      const [methodsResult, paymentsResult] = await Promise.all([
        client.rpc("get_admin_payment_methods"),
        client.rpc("get_admin_payments", { p_limit: 100 }),
      ]);
      if (methodsResult.error || paymentsResult.error) loadFailed = true;
      else {
        methods = methodsResult.data ?? [];
        payments = paymentsResult.data ?? [];
      }
    } catch {
      loadFailed = true;
    }
  }

  return (
    <>
      <header className="admin-topbar"><div><span className="eyebrow">PAGOS</span><h1>Pagos manuales</h1><p className="admin-subtitle">Configura medios reales y verifica reportes sin confundirlos con cobros automáticos.</p></div><Badge tone={localMode ? "warning" : loadFailed ? "danger" : "success"}>{localMode ? "Modo local" : loadFailed ? "No disponible" : "Trazabilidad activa"}</Badge></header>
      {localMode ? <div className="state-box"><strong>Pagos manuales no se simulan en modo local.</strong><span>La UI está disponible, pero no se inventan movimientos financieros sin Supabase.</span></div> : loadFailed ? <div className="state-box state-box--error"><strong>No pudimos cargar pagos.</strong><span>Recarga cuando el backend esté disponible.</span></div> : <AdminPaymentsPanel methods={methods} payments={payments} canManage={context.role === "owner" || context.role === "admin"} localMode={false} />}
    </>
  );
}
