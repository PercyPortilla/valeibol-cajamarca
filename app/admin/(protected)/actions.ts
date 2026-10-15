"use server";

import { revalidatePath } from "next/cache";
import { AdminAuthError, getAdminContext } from "../../../lib/auth/server.ts";
import { isLocalDevAdminUserId } from "../../../lib/auth/localDev.ts";
import type { AdminContext } from "../../../lib/auth/server.ts";
import { canPerformAdminOperation } from "../../../lib/admin/operations.ts";
import { canPerformPhase7Operation, type SchedulePricingInput } from "../../../lib/admin/phase7.ts";
import { createPhase7Repository } from "../../../lib/data/phase7Service.ts";
import { Phase7RepositoryError } from "../../../lib/data/repositories/phase7Repository.ts";
import { normalizeCustomerName, normalizePeruWhatsApp } from "../../../lib/booking.ts";
import { createAdminOperationsRepository } from "../../../lib/data/adminOperationsService.ts";
import { createSiteContentRepository } from "../../../lib/data/siteContentService.ts";
import { SiteContentRepositoryError } from "../../../lib/data/repositories/siteContentRepository.ts";
import { normalizeSiteGallery, normalizeSiteServices, type SiteGalleryItem, type SiteService } from "../../../lib/siteContent.ts";
import {
  AdminOperationsRepositoryError,
  type CreateManualReservationInput,
  type CreateScheduleBlockInput,
  type EditReservationInput,
} from "../../../lib/data/repositories/adminOperationsRepository.ts";

export type AdminActionResult =
  | { ok: true; message: string }
  | {
      ok: false;
      code: "unauthenticated" | "unauthorized" | "conflict" | "validation" | "network" | "unknown";
      message: string;
    };

function refreshScheduleViews() {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/reservas");
  revalidatePath("/admin/disponibilidad");
}

function fail(code: Exclude<AdminActionResult, { ok: true }>["code"], message: string): AdminActionResult {
  return { ok: false, code, message };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isClockTime(value: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

async function runAuthorized(
  operation: Parameters<typeof canPerformAdminOperation>[1],
  work: (context: AdminContext) => Promise<string>,
): Promise<AdminActionResult> {
  try {
    const context = await getAdminContext();
    if (!canPerformAdminOperation(context.role, operation)) {
      return fail("unauthorized", "Tu rol no permite realizar esta operación.");
    }
    const message = await work(context);
    refreshScheduleViews();
    return { ok: true, message };
  } catch (error) {
    if (error instanceof AdminAuthError) {
      if (error.code === "unauthenticated") return fail("unauthenticated", "La sesión expiró. Vuelve a iniciar sesión.");
      if (error.code === "unauthorized") return fail("unauthorized", "Tu cuenta no tiene un perfil administrativo autorizado.");
      if (error.code === "network") return fail("network", "No pudimos validar tu sesión con Supabase.");
      return fail("unknown", "Supabase/Auth no está configurado.");
    }
    if (error instanceof AdminOperationsRepositoryError) {
      const code = error.code === "not_found" ? "validation" : error.code;
      return fail(code, error.message);
    }
    return fail("unknown", "Ocurrió un error inesperado al procesar la operación.");
  }
}

export async function confirmReservationAction(reservationId: string): Promise<AdminActionResult> {
  if (!isUuid(reservationId)) return fail("validation", "Identificador de reserva inválido.");
  return runAuthorized("confirm_reservation", async (context) => {
    await createAdminOperationsRepository({ local: isLocalDevAdminUserId(context.userId) }).confirmReservation(reservationId);
    return "Solicitud confirmada. El intervalo permanece ocupado sin crear una segunda ocupación.";
  });
}

export async function cancelReservationAction(reservationId: string): Promise<AdminActionResult> {
  if (!isUuid(reservationId)) return fail("validation", "Identificador de reserva inválido.");
  return runAuthorized("cancel_reservation", async (context) => {
    await createAdminOperationsRepository({ local: isLocalDevAdminUserId(context.userId) }).cancelReservation(reservationId);
    return "Reserva cancelada. El intervalo quedó liberado según las reglas de agenda.";
  });
}

function validateReservationInput(
  raw: Omit<CreateManualReservationInput, "phoneE164"> & { phoneE164: string },
): { ok: true; input: CreateManualReservationInput } | { ok: false; result: AdminActionResult } {
  if (!isUuid(raw.courtId)) return { ok: false, result: fail("validation", "Cancha inválida.") };
  if (!isDateKey(raw.date) || !isClockTime(raw.startTime) || !isClockTime(raw.endTime)) {
    return { ok: false, result: fail("validation", "Fecha u horario inválido.") };
  }
  if (raw.lighting !== "without_lights" && raw.lighting !== "with_lights") {
    return { ok: false, result: fail("validation", "Modalidad de iluminación inválida.") };
  }
  if (!["admin", "phone", "whatsapp", "other"].includes(raw.source)) {
    return { ok: false, result: fail("validation", "Origen administrativo inválido.") };
  }
  const customerName = normalizeCustomerName(raw.customerName);
  if (customerName.length < 2 || customerName.length > 120) {
    return { ok: false, result: fail("validation", "Ingresa un nombre de cliente válido.") };
  }
  const phoneE164 = normalizePeruWhatsApp(raw.phoneE164);
  if (!phoneE164) return { ok: false, result: fail("validation", "Ingresa un WhatsApp válido.") };

  return { ok: true, input: { ...raw, customerName, phoneE164 } };
}

export async function createManualReservationAction(
  raw: CreateManualReservationInput,
): Promise<AdminActionResult> {
  const validated = validateReservationInput(raw);
  if (!validated.ok) return validated.result;
  return runAuthorized("create_manual_reservation", async (context) => {
    const result = await createAdminOperationsRepository({ local: isLocalDevAdminUserId(context.userId) }).createManualReservation(validated.input);
    return `Reserva manual confirmada. Total autoritativo: ${result.currency ?? "PEN"} ${Number(result.totalAmount ?? 0).toFixed(2)}.`;
  });
}

export async function editReservationAction(raw: EditReservationInput): Promise<AdminActionResult> {
  if (!isUuid(raw.reservationId)) return fail("validation", "Identificador de reserva inválido.");
  const validated = validateReservationInput({ ...raw, source: "admin" });
  if (!validated.ok) return validated.result;

  return runAuthorized("edit_reservation", async (context) => {
    await createAdminOperationsRepository({ local: isLocalDevAdminUserId(context.userId) }).editReservation({
      reservationId: raw.reservationId,
      courtId: validated.input.courtId,
      date: validated.input.date,
      startTime: validated.input.startTime,
      endTime: validated.input.endTime,
      lighting: validated.input.lighting,
      customerName: validated.input.customerName,
      phoneE164: validated.input.phoneE164,
    });
    return "Reserva actualizada y revalidada contra horario, tarifa y agenda.";
  });
}

export async function createScheduleBlockAction(raw: CreateScheduleBlockInput): Promise<AdminActionResult> {
  if (!isUuid(raw.courtId)) return fail("validation", "Cancha inválida.");
  if (!isDateKey(raw.date) || !isClockTime(raw.startTime) || !isClockTime(raw.endTime)) {
    return fail("validation", "Fecha u horario inválido.");
  }
  if (!["maintenance", "academy", "tournament", "event", "closure", "other"].includes(raw.reason)) {
    return fail("validation", "Motivo de bloqueo inválido.");
  }
  const internalNote = raw.internalNote?.trim().slice(0, 500) || null;

  return runAuthorized("create_block", async (context) => {
    await createAdminOperationsRepository({ local: isLocalDevAdminUserId(context.userId) }).createScheduleBlock({ ...raw, internalNote });
    return "Horario bloqueado. La web pública lo mostrará como No disponible.";
  });
}

export async function unblockScheduleAction(blockId: string): Promise<AdminActionResult> {
  if (!isUuid(blockId)) return fail("validation", "Identificador de bloqueo inválido.");
  return runAuthorized("unblock", async (context) => {
    await createAdminOperationsRepository({ local: isLocalDevAdminUserId(context.userId) }).unblock(blockId);
    return "Bloqueo retirado. El intervalo vuelve a calcularse desde la agenda real.";
  });
}


async function runPhase7Authorized(
  operation: Parameters<typeof canPerformPhase7Operation>[1],
  work: (context: AdminContext) => Promise<string>,
): Promise<AdminActionResult> {
  try {
    const context = await getAdminContext();
    if (!canPerformPhase7Operation(context.role, operation)) {
      return fail("unauthorized", "Tu rol no permite realizar esta operación.");
    }
    const message = await work(context);
    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/precios");
    revalidatePath("/admin/ingresos");
    revalidatePath("/admin/clientes");
    return { ok: true, message };
  } catch (error) {
    if (error instanceof AdminAuthError) {
      if (error.code === "unauthenticated") return fail("unauthenticated", "La sesión expiró. Vuelve a iniciar sesión.");
      if (error.code === "unauthorized") return fail("unauthorized", "Tu cuenta no tiene un perfil administrativo autorizado.");
      if (error.code === "network") return fail("network", "No pudimos validar tu sesión con Supabase.");
      return fail("unknown", "Supabase/Auth no está configurado.");
    }
    if (error instanceof Phase7RepositoryError) {
      const code = error.code === "not_found" ? "validation" : error.code;
      return fail(code, error.message);
    }
    return fail("unknown", "Ocurrió un error inesperado al procesar la tarifa.");
  }
}

export async function schedulePricingRuleAction(raw: SchedulePricingInput): Promise<AdminActionResult> {
  if (!isUuid(raw.courtId)) return fail("validation", "Cancha inválida.");
  if (raw.lighting !== "without_lights" && raw.lighting !== "with_lights") {
    return fail("validation", "Modalidad de iluminación inválida.");
  }
  if (!isDateKey(raw.effectiveFrom)) return fail("validation", "Fecha de vigencia inválida.");
  if (!Number.isFinite(raw.hourlyRate) || raw.hourlyRate <= 0 || raw.hourlyRate > 10000) {
    return fail("validation", "Ingresa una tarifa válida mayor que cero.");
  }

  return runPhase7Authorized("manage_pricing", async (context) => {
    const result = await createPhase7Repository({ local: isLocalDevAdminUserId(context.userId) }).schedulePricingRule({
      ...raw,
      hourlyRate: Number(raw.hourlyRate.toFixed(2)),
    });
    return `Nueva tarifa programada: ${result.currency} ${result.hourlyRate.toFixed(2)} desde ${result.effectiveFrom}. Las reservas históricas conservan su precio.`;
  });
}

export async function updateSiteContentAction(raw: {
  services: SiteService[];
  gallery: SiteGalleryItem[];
}): Promise<AdminActionResult> {
  try {
    const context = await getAdminContext();
    if (context.role !== "owner" && context.role !== "admin") {
      return fail("unauthorized", "Solo propietario y administrador pueden editar el contenido público.");
    }
    if (!Array.isArray(raw.services) || raw.services.length < 1 || raw.services.length > 24) {
      return fail("validation", "Configura entre 1 y 24 servicios.");
    }
    if (!Array.isArray(raw.gallery) || raw.gallery.length > 16) {
      return fail("validation", "La galería admite hasta 16 elementos.");
    }

    const services = normalizeSiteServices(raw.services);
    const gallery = normalizeSiteGallery(raw.gallery);
    if (services.length !== raw.services.length || gallery.length !== raw.gallery.length) {
      return fail("validation", "Revisa títulos, descripciones y datos de la galería antes de guardar.");
    }

    await createSiteContentRepository({ local: isLocalDevAdminUserId(context.userId) }).updateAdminContent({ services, gallery });
    revalidatePath("/");
    revalidatePath("/admin/configuracion");
    return { ok: true, message: "Contenido público actualizado. Servicios y galería ya usan esta configuración." };
  } catch (error) {
    if (error instanceof AdminAuthError) {
      if (error.code === "unauthenticated") return fail("unauthenticated", "La sesión expiró. Vuelve a iniciar sesión.");
      if (error.code === "unauthorized") return fail("unauthorized", "Tu cuenta no tiene un perfil administrativo autorizado.");
      if (error.code === "network") return fail("network", "No pudimos validar tu sesión con Supabase.");
      return fail("unknown", "Supabase/Auth no está configurado.");
    }
    if (error instanceof SiteContentRepositoryError) {
      const code = error.code === "unauthorized" || error.code === "validation" || error.code === "network" ? error.code : "unknown";
      return fail(code, error.message);
    }
    return fail("unknown", "No pudimos actualizar el contenido público.");
  }
}
