import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";
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
  } else if (normalized.includes("invalid_interval") || normalized.includes("invalid_booking_increment")) {
    mapped = "invalid_interval";
    userMessage = "El intervalo seleccionado ya no es válido.";
  } else if (normalized.includes("pricing_not_found")) {
    mapped = "pricing_not_found";
    userMessage = "No existe una tarifa vigente para esa opción.";
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
    const client = createPublicBrowserSupabaseClient();
    const { data, error } = await client.rpc("create_public_reservation_request", {
      p_business_slug: request.businessSlug,
      p_court_id: request.courtId,
      p_date: request.date,
      p_start_time: request.start,
      p_end_time: request.end,
      p_lighting: request.lighting,
      p_customer_name: request.customerName,
      p_phone_e164: request.phoneE164,
      p_marketing_opt_in: request.marketingOptIn,
      p_request_token: request.requestToken,
    });

    if (error) throw mapError(error.message, error.code);

    type Row = Database["public"]["Functions"]["create_public_reservation_request"]["Returns"][number];
    const row = ((data ?? []) as Row[])[0];
    if (!row) throw new BookingRepositoryError("unknown", "El servidor no devolvió la solicitud creada.");

    return {
      persisted: true,
      requestId: row.request_id,
      status: "pending",
      courtId: row.court_id,
      startAt: row.start_at,
      endAt: row.end_at,
      lighting: row.lighting,
      hourlyRate: toNumber(row.hourly_rate),
      totalAmount: toNumber(row.total_amount),
      currency: row.currency,
    };
  }
}
