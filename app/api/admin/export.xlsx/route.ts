import { NextRequest, NextResponse } from "next/server";
import { AdminAuthError, getAdminContext } from "@/lib/auth/server";
import { isLocalDevAdminUserId } from "@/lib/auth/localDev";
import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import type { Database } from "@/lib/data/supabase/database.types";
import { createAdminReservationRepository } from "@/lib/data/adminService";
import { createPhase7Repository } from "@/lib/data/phase7Service";
import {
  buildExportCustomers,
  formatExportLocalDateTime,
  sanitizeExcelText,
  type ExportReservation,
} from "@/lib/admin/export";
import { lightingLabel } from "@/lib/admin/reservations";
import { buildXlsxWorkbook, type XlsxCell } from "@/lib/admin/xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isDateKey(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function dateDistanceDays(from: string, to: string) {
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`);
  return Math.round((toMs - fromMs) / 86_400_000);
}

function numberValue(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

function sourceLabel(source: ExportReservation["source"]) {
  if (source === "public_web") return "Web pública";
  if (source === "phone") return "Llamada";
  if (source === "whatsapp") return "WhatsApp";
  if (source === "admin") return "Panel administrativo";
  return "Otro";
}

function statusLabel(status: ExportReservation["status"]) {
  if (status === "pending") return "Pendiente";
  if (status === "confirmed") return "Confirmada";
  if (status === "completed") return "Completada";
  return "Cancelada";
}

async function loadProductionExport(from: string, to: string) {
  const client = await createServerSupabaseClient();
  const [reservationsResult, metricsResult, pricingResult] = await Promise.all([
    client.rpc("get_admin_export_reservations", { p_from: from, p_to: to }),
    client.rpc("get_admin_operational_metrics", { p_from: from, p_to: to }),
    client.rpc("get_admin_pricing_rules"),
  ]);

  if (reservationsResult.error) throw reservationsResult.error;
  if (metricsResult.error) throw metricsResult.error;
  if (pricingResult.error) throw pricingResult.error;

  type ReservationRow = Database["public"]["Functions"]["get_admin_export_reservations"]["Returns"][number];
  type MetricsRow = Database["public"]["Functions"]["get_admin_operational_metrics"]["Returns"][number];
  type PricingRow = Database["public"]["Functions"]["get_admin_pricing_rules"]["Returns"][number];

  const reservations: ExportReservation[] = ((reservationsResult.data ?? []) as ReservationRow[]).map((row) => ({
    id: row.reservation_id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhoneE164: row.customer_phone_e164,
    marketingOptIn: row.marketing_opt_in,
    courtId: row.court_id,
    courtName: row.court_name,
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status,
    lighting: row.lighting,
    netHeightCm: row.net_height_cm,
    hourlyRate: numberValue(row.hourly_rate),
    totalAmount: numberValue(row.total_amount),
    currency: row.currency,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return {
    reservations,
    metrics: ((metricsResult.data ?? []) as MetricsRow[])[0] ?? null,
    pricing: (pricingResult.data ?? []) as PricingRow[],
  };
}

async function loadLocalExport(from: string, to: string, timezone: string) {
  const reservationsRepo = createAdminReservationRepository({ local: true });
  const phase7Repo = createPhase7Repository({ local: true });
  const all = await reservationsRepo.list(200);
  const reservations: ExportReservation[] = all
    .filter((item) => {
      const localDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(item.startAt));
      return localDate >= from && localDate <= to;
    })
    .map((item) => ({
      id: item.id,
      customerId: item.customerId,
      customerName: item.customerName,
      customerPhoneE164: item.customerPhoneE164,
      marketingOptIn: false,
      courtId: item.courtId,
      courtName: item.courtName,
      startAt: item.startAt,
      endAt: item.endAt,
      status: item.status,
      lighting: item.lighting,
      netHeightCm: item.netHeightCm,
      hourlyRate: item.hourlyRate,
      totalAmount: item.totalAmount,
      currency: item.currency,
      source: item.source,
      createdAt: item.createdAt,
      updatedAt: item.createdAt,
    }));
  const [metrics, pricing] = await Promise.all([
    phase7Repo.getOperationalMetrics(from, to),
    phase7Repo.listPricingRules(),
  ]);
  return { reservations, metrics, pricing };
}

export async function GET(request: NextRequest) {
  let context;
  try {
    context = await getAdminContext();
  } catch (error) {
    if (error instanceof AdminAuthError) {
      const status = error.code === "unauthenticated" ? 401 : error.code === "unauthorized" ? 403 : 503;
      return NextResponse.json({ ok: false, code: error.code }, { status });
    }
    return NextResponse.json({ ok: false, code: "unknown" }, { status: 500 });
  }

  if (context.role !== "owner" && context.role !== "admin") {
    return NextResponse.json({ ok: false, code: "insufficient_role" }, { status: 403 });
  }

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (!isDateKey(from) || !isDateKey(to)) {
    return NextResponse.json({ ok: false, code: "invalid_date_range" }, { status: 400 });
  }
  const days = dateDistanceDays(from, to);
  if (days < 0 || days > 366) {
    return NextResponse.json({ ok: false, code: "invalid_date_range" }, { status: 400 });
  }

  try {
    const local = isLocalDevAdminUserId(context.userId);
    const data = local
      ? await loadLocalExport(from, to, context.timezone)
      : await loadProductionExport(from, to);
    const customers = buildExportCustomers(data.reservations);
    const summaryRows: XlsxCell[][] = [
      ["Reporte operativo", sanitizeExcelText(context.businessName)],
      ["Periodo", `${from} a ${to}`],
      ["Zona horaria", context.timezone],
      ["Nota financiera", "Los importes son valores de reservas; no representan pagos cobrados."],
    ];

    if (data.metrics) {
      const metrics = data.metrics as {
        reservation_count?: number | string; pending_count?: number | string; confirmed_count?: number | string;
        completed_count?: number | string; cancelled_count?: number | string; confirmed_value?: number | string;
        completed_value?: number | string; reserved_hours?: number | string; occupancy_percent?: number | string;
        currency?: string; reservationCount?: number; pendingCount?: number; confirmedCount?: number;
        completedCount?: number; cancelledCount?: number; confirmedValue?: number; completedValue?: number;
        reservedHours?: number; occupancyPercent?: number;
      };
      summaryRows.push(
        ["Reservas del periodo", Number(metrics.reservation_count ?? metrics.reservationCount ?? 0)],
        ["Pendientes", Number(metrics.pending_count ?? metrics.pendingCount ?? 0)],
        ["Confirmadas", Number(metrics.confirmed_count ?? metrics.confirmedCount ?? 0)],
        ["Completadas", Number(metrics.completed_count ?? metrics.completedCount ?? 0)],
        ["Canceladas", Number(metrics.cancelled_count ?? metrics.cancelledCount ?? 0)],
        ["Horas reservadas", Number(metrics.reserved_hours ?? metrics.reservedHours ?? 0)],
        ["Valor confirmado (no cobrado)", Number(metrics.confirmed_value ?? metrics.confirmedValue ?? 0)],
        ["Valor completado (no cobrado)", Number(metrics.completed_value ?? metrics.completedValue ?? 0)],
        ["Ocupación de agenda %", Number(metrics.occupancy_percent ?? metrics.occupancyPercent ?? 0)],
      );
    }

    const reservationRows: XlsxCell[][] = [
      [
        "ID", "Cliente", "WhatsApp", "Cancha", "Inicio local", "Fin local", "Estado",
        "Iluminación automática", "Altura red (cm)", "Tarifa/h", "Valor reserva (no cobro)",
        "Moneda", "Origen", "Creada",
      ],
    ];
    for (const item of data.reservations) {
      reservationRows.push([
        sanitizeExcelText(item.id),
        sanitizeExcelText(item.customerName),
        sanitizeExcelText(item.customerPhoneE164),
        sanitizeExcelText(item.courtName),
        formatExportLocalDateTime(item.startAt, context.timezone),
        formatExportLocalDateTime(item.endAt, context.timezone),
        statusLabel(item.status),
        lightingLabel(item.lighting),
        item.netHeightCm ?? "",
        item.hourlyRate,
        item.totalAmount,
        item.currency,
        sourceLabel(item.source),
        formatExportLocalDateTime(item.createdAt, context.timezone),
      ]);
    }

    const customerRows: XlsxCell[][] = [
      [
        "Cliente", "WhatsApp", "Marketing opt-in", "Reservas", "Activas", "Completadas",
        "Canceladas", "Valor confirmado (no cobro)", "Valor completado (no cobro)", "Moneda",
        "Última reserva",
      ],
    ];
    for (const customer of customers) {
      customerRows.push([
        sanitizeExcelText(customer.fullName),
        sanitizeExcelText(customer.phoneE164),
        customer.marketingOptIn ? "Sí" : "No",
        customer.reservationCount,
        customer.activeReservationCount,
        customer.completedReservationCount,
        customer.cancelledReservationCount,
        customer.confirmedValue,
        customer.completedValue,
        customer.currency,
        formatExportLocalDateTime(customer.lastReservationAt, context.timezone),
      ]);
    }

    const pricingRows: XlsxCell[][] = [
      ["Cancha", "Franja", "Tarifa/h", "Moneda", "Desde", "Hasta", "Activa"],
    ];
    for (const raw of data.pricing as Array<Record<string, unknown>>) {
      const courtName = String(raw.court_name ?? raw.courtName ?? "");
      const lighting = String(raw.lighting ?? "") === "with_lights" ? "Desde 18:00 · con luz" : "Antes de 18:00 · sin luz";
      pricingRows.push([
        sanitizeExcelText(courtName),
        lighting,
        Number(raw.hourly_rate ?? raw.hourlyRate ?? 0),
        String(raw.currency ?? ""),
        String(raw.effective_from ?? raw.effectiveFrom ?? ""),
        String(raw.effective_until ?? raw.effectiveUntil ?? ""),
        Boolean(raw.is_active ?? raw.isActive) ? "Sí" : "No",
      ]);
    }

    const body = buildXlsxWorkbook([
      { name: "Resumen", rows: summaryRows, widths: [34, 24], boldFirstColumn: true },
      {
        name: "Reservas",
        rows: reservationRows,
        widths: [38, 26, 20, 24, 22, 22, 14, 22, 16, 14, 24, 10, 22, 22],
        freezeHeader: true,
        autoFilter: true,
      },
      {
        name: "Clientes",
        rows: customerRows,
        widths: [28, 20, 18, 12, 12, 14, 14, 26, 26, 10, 22],
        freezeHeader: true,
        autoFilter: true,
      },
      {
        name: "Precios",
        rows: pricingRows,
        widths: [26, 18, 14, 10, 14, 14, 10],
        freezeHeader: true,
        autoFilter: true,
      },
    ]);
    const filename = `valeibol-reporte-${from}-a-${to}.xlsx`;
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[admin-export] failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false, code: "export_failed" }, { status: 500 });
  }
}
