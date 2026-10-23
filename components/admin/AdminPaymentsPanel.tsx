"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";
import type { PaymentMethod, PaymentStatus } from "@/lib/data/supabase/database.types";
import { formatMoney } from "@/lib/booking";
import { paymentMethodLabel, paymentStatusLabel } from "@/lib/payments";

type MethodRow = {
  method: PaymentMethod;
  label: string;
  destination: string | null;
  instructions: string | null;
  is_active: boolean;
  sort_order: number;
};

type PaymentRow = {
  payment_id: string;
  reservation_id: string;
  customer_name: string | null;
  court_name: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number | string;
  currency: string;
  customer_reference: string | null;
  internal_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export function AdminPaymentsPanel({
  methods: initialMethods,
  payments,
  canManage,
  localMode,
}: {
  methods: MethodRow[];
  payments: PaymentRow[];
  canManage: boolean;
  localMode: boolean;
}) {
  const router = useRouter();
  const [methods, setMethods] = useState(initialMethods);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const ordered = useMemo(() => [...methods].sort((a, b) => a.sort_order - b.sort_order), [methods]);

  function updateMethod(method: PaymentMethod, field: "is_active" | "destination" | "instructions", value: boolean | string) {
    setMethods((current) => current.map((item) => item.method === method ? { ...item, [field]: value } : item));
  }

  async function saveMethod(row: MethodRow) {
    if (!canManage || localMode) return;
    setBusyKey(`method:${row.method}`);
    setMessage(null);
    try {
      const { error } = await createPublicBrowserSupabaseClient().rpc("admin_set_payment_method", {
        p_method: row.method,
        p_enabled: row.is_active,
        p_destination: row.destination?.trim() || null,
        p_instructions: row.instructions?.trim() || null,
      });
      setMessage(error ? "No pudimos guardar el método de pago." : `${row.label} actualizado.`);
      if (!error) router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  async function review(paymentId: string, status: "verified" | "rejected") {
    if (!canManage || localMode) return;
    setBusyKey(`payment:${paymentId}`);
    setMessage(null);
    try {
      const { error } = await createPublicBrowserSupabaseClient().rpc("admin_review_payment", {
        p_payment_id: paymentId,
        p_status: status,
        p_internal_note: null,
      });
      setMessage(error ? "No pudimos actualizar el pago." : status === "verified" ? "Pago marcado como verificado." : "Reporte rechazado.");
      if (!error) router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="admin-payments-layout">
      {message ? <div className="admin-inline-notice" role="status">{message}</div> : null}
      <section className="admin-board">
        <div className="admin-board__header"><div><span className="eyebrow">MÉTODOS</span><h2>Yape, Plin y pagos manuales</h2><p>Activa únicamente destinos reales del negocio.</p></div></div>
        <div className="admin-payment-methods">
          {ordered.map((row) => (
            <article key={row.method} className="admin-payment-method">
              <label className="admin-payment-toggle"><input type="checkbox" checked={row.is_active} disabled={!canManage || localMode} onChange={(event) => updateMethod(row.method, "is_active", event.target.checked)} /><strong>{row.label}</strong></label>
              <label><span>Destino / número</span><input value={row.destination ?? ""} disabled={!canManage || localMode || row.method === "cash"} onChange={(event) => updateMethod(row.method, "destination", event.target.value)} placeholder={row.method === "cash" ? "No aplica" : "Dato real del negocio"} /></label>
              <label><span>Instrucciones</span><textarea maxLength={500} value={row.instructions ?? ""} disabled={!canManage || localMode} onChange={(event) => updateMethod(row.method, "instructions", event.target.value)} /></label>
              <button className="button button--secondary" type="button" disabled={!canManage || localMode || busyKey === `method:${row.method}`} onClick={() => saveMethod(row)}>{busyKey === `method:${row.method}` ? "Guardando…" : "Guardar"}</button>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-board">
        <div className="admin-board__header"><div><span className="eyebrow">REPORTES</span><h2>Pagos reportados por clientes</h2><p>“Reportado” no equivale a cobrado. Verifica el movimiento antes de marcarlo.</p></div></div>
        {payments.length === 0 ? <div className="state-box"><strong>Sin reportes de pago</strong><span>Cuando un cliente reporte un pago manual aparecerá aquí.</span></div> : (
          <div className="admin-payment-list">
            {payments.map((payment) => (
              <article className="admin-payment-row" key={payment.payment_id}>
                <div><strong>{payment.customer_name ?? "Cliente"}</strong><span>{payment.court_name} · {paymentMethodLabel(payment.method)}</span>{payment.customer_reference ? <small>Ref.: {payment.customer_reference}</small> : null}</div>
                <div><small>{paymentStatusLabel(payment.status)}</small><strong>{formatMoney(Number(payment.amount), payment.currency)}</strong></div>
                {payment.status === "reported" && canManage && !localMode ? <div className="admin-payment-actions"><button type="button" onClick={() => review(payment.payment_id, "verified")} disabled={busyKey === `payment:${payment.payment_id}`}>Verificar</button><button type="button" onClick={() => review(payment.payment_id, "rejected")} disabled={busyKey === `payment:${payment.payment_id}`}>Rechazar</button></div> : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
