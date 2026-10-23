import type { PaymentMethod, PaymentStatus } from "@/lib/data/supabase/database.types";

export type PublicPaymentMethod = {
  method: PaymentMethod;
  label: string;
  destination: string | null;
  instructions: string | null;
};

export function paymentMethodLabel(method: PaymentMethod) {
  if (method === "yape") return "Yape";
  if (method === "plin") return "Plin";
  if (method === "cash") return "Efectivo";
  return "Transferencia bancaria";
}

export function paymentStatusLabel(status: PaymentStatus) {
  if (status === "reported") return "Reportado";
  if (status === "verified") return "Verificado";
  if (status === "rejected") return "Rechazado";
  return "Reembolsado";
}
