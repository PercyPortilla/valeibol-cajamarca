import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";
import { isNetHeightCm } from "@/lib/booking";
import type { Database, Json } from "@/lib/data/supabase/database.types";
import {
  BookingRepositoryError,
  type BookingErrorCode,
  type BookingRepository,
  type PublicBookingContext,
  type PublicBookingDatePricing,
  type PublicBookingCourt,
  type PublicBookingPricing,
  type PublicBookingRequest,
  type PublicBookingResult,
} from "./bookingRepository";

function toNumber(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

function parseCourts(value: Json): PublicBookingCourt[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((court) => {
    if (!court || Array.isArray(court) || typeof court !== "object") return [];
    if (typeof court.courtId !== "string" || typeof court.courtName !== "string") return [];

    const pricingSource = Array.isArray(court.pricing) ? court.pricing : [];
    const pricing = pricingSource.flatMap((rule) => {
      if (!rule || Array.isArray(rule) || typeof rule !== "object") return [];
      const lighting = rule.lighting;
      const status = rule.status;
      if (
        (lighting !== "without_lights" && lighting !== "with_lights") ||
        (status !== "provisional" && status !== "confirmed") ||
        typeof rule.label !== "string" ||
        (typeof rule.hourlyRate !== "number" && typeof rule.hourlyRate !== "string")
      ) return [];
      const parsed: PublicBookingPricing = {
        lighting,
        label: rule.label,
        hourlyRate: toNumber(rule.hourlyRate),
        status,
      };
      return [parsed];
    });

    return [{ courtId: court.courtId, courtName: court.courtName, pricing }];
  });
}

function mapError(message: string, code?: string): BookingRepositoryError {
  const normalized = message.toLowerCase();
  let mapped: BookingErrorCode = "unknown";
  let userMessage = "No pudimos enviar la solicitud. Inténtalo nuevamente.";

  if (code === "23P01" || normalized.includes("slot_unavailable")) {
    mapped = "slot_unavailable";
    userMessage = "Ese horario acaba de dejar de estar disponible. Actualizamos la agenda para que elijas otro.";
  } else if (normalized.includes("invalid_customer_name")) {
    mapped = "invalid_customer";
    userMessage = "Revisa el nombre ingresado.";
  } else if (normalized.includes("invalid_phone_e164")) {
    mapped = "invalid_phone";
    userMessage = "Revisa el número de WhatsApp.";
  } else if (normalized.includes("reservation_in_past")) {
    mapped = "reservation_in_past";
    userMessage = "No se puede solicitar un horario que ya pasó.";
  } else if (normalized.includes("court_closed")) {
    mapped = "court_closed";
    userMessage = "La cancha está cerrada en ese día según la configuración vigente.";
  } else if (normalized.includes("outside_operating_hours")) {
    mapped = "outside_operating_hours";
    userMessage = "El intervalo está fuera del horario configurado.";
  } else if (normalized.includes("lighting_cutoff_crossed")) {
    mapped = "lighting_cutoff_crossed";
    userMessage = "Ese intervalo cruza las 18:00. Elige un bloque que termine a las 18:00 o empiece desde las 18:00.";
  } else if (normalized.includes("invalid_net_height")) {
    mapped = "invalid_net_height";
    userMessage = "Selecciona una altura de red válida.";
  } else if (normalized.includes("invalid_interval") || normalized.includes("invalid_booking_increment")) {
    mapped = "invalid_interval";
    userMessage = "El intervalo seleccionado ya no es válido.";
  } else if (normalized.includes("pricing_not_found")) {
    mapped = "pricing_not_found";
    userMessage = "No existe una tarifa vigente para esa opción.";
  } else if (normalized.includes("rate_limited")) {
    mapped = "rate_limited";
    userMessage = "Recibimos demasiados intentos seguidos. Espera unos minutos antes de volver a solicitar.";
  } else if (
    normalized.includes("unauthorized")
    || normalized.includes("configuration")
    || normalized.includes("service_unavailable")
  ) {
    mapped = "network";
    userMessage = "El sistema de reservas está temporalmente no disponible. Inténtalo nuevamente en unos minutos.";
  } else if (normalized.includes("not_found")) {
    mapped = "not_found";
    userMessage = "La cancha o el negocio ya no están disponibles.";
  } else if (code === "PGRST301" || normalized.includes("fetch")) {
    mapped = "network";
    userMessage = "No pudimos conectar con el sistema de reservas. Comprueba tu conexión e inténtalo otra vez.";
  }

  return new BookingRepositoryError(mapped, userMessage);
}

export class SupabaseBookingRepository implements BookingRepository {
  async getContext(businessSlug: string): Promise<PublicBookingContext> {
    const client = createPublicBrowserSupabaseClient();
    const { data, error } = await client.rpc("get_public_booking_context", {
      p_business_slug: businessSlug,
    });

    if (error) throw mapError(error.message, error.code);

    type Row = Database["public"]["Functions"]["get_public_booking_context"]["Returns"][number];
    const row = ((data ?? []) as Row[])[0];
    if (!row) throw new BookingRepositoryError("not_found", "No encontramos la configuración pública de reservas.");

    return {
      source: "supabase",
      businessId: row.business_id,
      businessName: row.business_name,
      currency: row.currency,
      timezone: row.timezone,
      bookingIncrementMinutes: row.booking_increment_minutes,
      courts: parseCourts(row.courts),
    };
  }

  async getPricingForDate(businessSlug: string, date: string, courtId: string): Promise<PublicBookingDatePricing> {
    const client = createPublicBrowserSupabaseClient();
    const { data, error } = await client.rpc("get_public_pricing_for_date", {
      p_business_slug: businessSlug,
      p_date: date,
    });

    if (error) throw mapError(error.message, error.code);

    type Row = Database["public"]["Functions"]["get_public_pricing_for_date"]["Returns"][number];
    const rows = ((data ?? []) as Row[]).filter((row) => row.court_id === courtId);
    if (rows.length === 0) {
      throw new BookingRepositoryError("pricing_not_found", "No existe una tarifa vigente para la fecha seleccionada.");
    }

    const first = rows[0];
    return {
      source: "supabase",
      businessName: first.business_name,
      currency: first.currency,
      timezone: first.timezone,
      courtId: first.court_id,
      courtName: first.court_name,
      date,
      pricing: rows.map((row) => ({
        lighting: row.lighting,
        label: row.label,
        hourlyRate: toNumber(row.hourly_rate),
        status: row.configuration_status,
      })),
    };
  }

  async submit(request: PublicBookingRequest): Promise<PublicBookingResult> {
    let response: Response;
    try {
      response = await fetch("/api/public/reservation-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessSlug: request.businessSlug,
          courtId: request.courtId,
          date: request.date,
          start: request.start,
          end: request.end,
          netHeightCm: request.netHeightCm,
          customerName: request.customerName,
          phoneE164: request.phoneE164,
          marketingOptIn: request.marketingOptIn,
          requestToken: request.requestToken,
        }),
      });
    } catch {
      throw new BookingRepositoryError(
        "network",
        "No pudimos conectar con el sistema de reservas. Comprueba tu conexión e inténtalo otra vez.",
      );
    }

    const payload = await response.json().catch(() => null) as
      | {
          ok?: boolean;
          code?: string;
          requestId?: string;
          status?: string;
          accountLinked?: boolean | null;
          courtId?: string;
          startAt?: string;
          endAt?: string;
          lighting?: string;
          netHeightCm?: number | null;
          hourlyRate?: number | string;
          totalAmount?: number | string;
          currency?: string;
        }
      | null;

    if (!response.ok || !payload?.ok) {
      throw mapError(payload?.code ?? "unknown", payload?.code);
    }

    if (
      typeof payload.requestId !== "string" ||
      payload.status !== "pending" ||
      (payload.accountLinked !== null && typeof payload.accountLinked !== "boolean") ||
      typeof payload.courtId !== "string" ||
      typeof payload.startAt !== "string" ||
      typeof payload.endAt !== "string" ||
      (payload.lighting !== "without_lights" && payload.lighting !== "with_lights") ||
      (payload.netHeightCm !== null && !isNetHeightCm(payload.netHeightCm)) ||
      (typeof payload.hourlyRate !== "number" && typeof payload.hourlyRate !== "string") ||
      (typeof payload.totalAmount !== "number" && typeof payload.totalAmount !== "string") ||
      typeof payload.currency !== "string"
    ) {
      throw new BookingRepositoryError("unknown", "El servidor devolvió una respuesta de reserva inválida.");
    }

    return {
      persisted: true,
      requestId: payload.requestId,
      status: "pending",
      accountLinked: payload.accountLinked,
      recoveryCode: payload.accountLinked === true ? null : request.requestToken,
      courtId: payload.courtId,
      startAt: payload.startAt,
      endAt: payload.endAt,
      lighting: payload.lighting,
      netHeightCm: payload.netHeightCm,
      hourlyRate: toNumber(payload.hourlyRate),
      totalAmount: toNumber(payload.totalAmount),
      currency: payload.currency,
    };
  }}
