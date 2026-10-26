"use server";

import { revalidatePath } from "next/cache";
import { AdminAuthError, getAdminContext } from "../../../lib/auth/server.ts";
import { isLocalDevAdminUserId } from "../../../lib/auth/localDev.ts";
import type { AdminContext } from "../../../lib/auth/server.ts";
import { canPerformAdminOperation } from "../../../lib/admin/operations.ts";
import { canPerformPhase7Operation, type SchedulePricingInput } from "../../../lib/admin/phase7.ts";
import { createPhase7Repository } from "../../../lib/data/phase7Service.ts";
import { Phase7RepositoryError } from "../../../lib/data/repositories/phase7Repository.ts";
import { isNetHeightCm, normalizeCustomerName, normalizePeruWhatsApp } from "../../../lib/booking.ts";
import { createAdminOperationsRepository } from "../../../lib/data/adminOperationsService.ts";
import { createSiteContentRepository } from "../../../lib/data/siteContentService.ts";
import { createServerSupabaseClient } from "../../../lib/data/supabase/server.ts";
import { SiteContentRepositoryError } from "../../../lib/data/repositories/siteContentRepository.ts";
import { isAccessibleSiteTheme, isValidSiteThemeInput, normalizeSiteGallery, normalizeSiteLogoUrl, normalizeSiteServices, normalizeSiteTheme, type SiteGalleryItem, type SiteService, type SiteTheme } from "../../../lib/siteContent.ts";
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

export async function rejectPendingReservationAction(reservationId: string): Promise<AdminActionResult> {
  if (!isUuid(reservationId)) return fail("validation", "Identificador de solicitud inválido.");
  return runAuthorized("reject_reservation", async (context) => {
    await createAdminOperationsRepository({ local: isLocalDevAdminUserId(context.userId) }).rejectPendingReservation(reservationId);
    return "Solicitud rechazada. El cliente verá que el negocio no aceptó la reserva y el horario quedó liberado.";
  });
}

export async function expirePendingReservationAction(reservationId: string): Promise<AdminActionResult> {
  if (!isUuid(reservationId)) return fail("validation", "Identificador de solicitud inválido.");
  return runAuthorized("expire_pending_reservation", async (context) => {
    await createAdminOperationsRepository({ local: isLocalDevAdminUserId(context.userId) }).expirePendingReservation(reservationId);
    return "Solicitud expirada. El horario venció sin confirmación y el cliente verá el cierre correcto.";
  });
}

export async function completeReservationAction(reservationId: string): Promise<AdminActionResult> {
  if (!isUuid(reservationId)) return fail("validation", "Identificador de reserva inválido.");
  return runAuthorized("complete_reservation", async (context) => {
    await createAdminOperationsRepository({ local: isLocalDevAdminUserId(context.userId) }).completeReservation(reservationId);
    return "Reserva marcada como completada. Si está vinculada a una cuenta, el cliente ya puede dejar una reseña verificada.";
  });
}

export async function cancelReservationAction(reservationId: string): Promise<AdminActionResult> {
  if (!isUuid(reservationId)) return fail("validation", "Identificador de reserva inválido.");
  return runAuthorized("cancel_reservation", async (context) => {
    await createAdminOperationsRepository({ local: isLocalDevAdminUserId(context.userId) }).cancelReservation(reservationId);
    return "Reserva cancelada. El cliente verá que una reserva ya confirmada fue cancelada.";
  });
}

export async function resolveReservationChangeRequestAction(
  requestId: string,
  approve: boolean,
  resolutionNote: string | null = null,
): Promise<AdminActionResult> {
  if (!isUuid(requestId)) return fail("validation", "Identificador de solicitud inválido.");
  const normalizedNote = typeof resolutionNote === "string"
    ? resolutionNote.trim().replace(/\s+/g, " ")
    : "";
  if (normalizedNote.length > 500) {
    return fail("validation", "La respuesta al cliente no puede superar 500 caracteres.");
  }
  return runAuthorized("resolve_change_request", async () => {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("admin_resolve_reservation_change_request", {
      p_request_id: requestId,
      p_approve: approve,
      p_resolution_note: normalizedNote || null,
    });
    if (error) {
      const normalized = error.message.toLowerCase();
      if (normalized.includes("change_request_already_resolved") || normalized.includes("reservation_change_no_longer_applicable")) {
        throw new AdminOperationsRepositoryError("conflict", "La solicitud cambió de estado. Actualiza la página antes de continuar.");
      }
      if (normalized.includes("business_reschedule_requires_customer_response")) {
        throw new AdminOperationsRepositoryError("conflict", "Esta propuesta fue iniciada por el negocio y debe responderla el cliente desde Mi cuenta.");
      }
      if (normalized.includes("customer_change_request_expired_requires_expiration")) {
        throw new AdminOperationsRepositoryError("conflict", "La solicitud ya venció. Actualiza la página y usa Expirar solicitud.");
      }
      if (normalized.includes("slot_unavailable")) {
        throw new AdminOperationsRepositoryError("conflict", "El horario solicitado ya no está disponible. Rechaza la solicitud o pide al cliente elegir otro horario.");
      }
      if (normalized.includes("reschedule_quote_changed")) {
        throw new AdminOperationsRepositoryError("conflict", "La tarifa cambió desde la solicitud. El cliente debe enviar una nueva reprogramación con el valor vigente.");
      }
      if (normalized.includes("reservation_payment_requires_business_reschedule")) {
        throw new AdminOperationsRepositoryError("conflict", "La reserva tiene un registro de pago incompatible con el nuevo valor y requiere coordinación manual.");
      }
      if (normalized.includes("resolution_note_too_long")) {
        throw new AdminOperationsRepositoryError("validation", "La respuesta al cliente no puede superar 500 caracteres.");
      }
      throw new AdminOperationsRepositoryError("unknown", "No pudimos resolver la solicitud de cambio.");
    }
    return approve ? "Solicitud aprobada. La reserva fue actualizada de forma autoritativa." : "Solicitud de cambio rechazada.";
  });
}

export async function proposeReservationRescheduleAction(raw: {
  reservationId: string;
  courtId: string;
  date: string;
  startTime: string;
  endTime: string;
  note: string;
}): Promise<AdminActionResult> {
  if (!isUuid(raw.reservationId) || !isUuid(raw.courtId)) {
    return fail("validation", "Reserva o cancha inválida.");
  }
  if (!isDateKey(raw.date) || !isClockTime(raw.startTime) || !isClockTime(raw.endTime)) {
    return fail("validation", "Fecha u horario inválido.");
  }
  const note = raw.note.trim();
  if (note.length > 500) return fail("validation", "La nota no puede superar 500 caracteres.");

  return runAuthorized("propose_reschedule", async () => {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("admin_propose_reservation_reschedule", {
      p_reservation_id: raw.reservationId,
      p_court_id: raw.courtId,
      p_date: raw.date,
      p_start_time: raw.startTime,
      p_end_time: raw.endTime,
      p_note: note || null,
    });
    if (error) {
      const normalized = error.message.toLowerCase();
      if (normalized.includes("reservation_change_request_already_pending")) {
        throw new AdminOperationsRepositoryError("conflict", "Esta reserva ya tiene una solicitud o propuesta de cambio pendiente.");
      }
      if (normalized.includes("reservation_customer_account_required")) {
        throw new AdminOperationsRepositoryError("conflict", "El cliente debe tener una cuenta vinculada para aceptar una propuesta desde Mi cuenta.");
      }
      if (normalized.includes("slot_unavailable")) {
        throw new AdminOperationsRepositoryError("conflict", "Ese horario ya no está disponible. Elige otro.");
      }
      if (normalized.includes("reschedule_no_change")) {
        throw new AdminOperationsRepositoryError("conflict", "La propuesta debe cambiar la cancha o el horario actual.");
      }
      if (normalized.includes("reservation_payment_requires_business_reschedule")) {
        throw new AdminOperationsRepositoryError("conflict", "La reserva tiene un registro de pago que no coincide con el nuevo valor; no se modificó la reserva.");
      }
      if (
        normalized.includes("reservation_change_window_closed")
        || normalized.includes("reservation_not_reschedulable")
      ) {
        throw new AdminOperationsRepositoryError("conflict", "La reserva ya no admite una propuesta de reprogramación.");
      }
      if (
        normalized.includes("invalid_interval")
        || normalized.includes("invalid_booking_increment")
        || normalized.includes("outside_operating_hours")
        || normalized.includes("court_closed")
        || normalized.includes("lighting_cutoff_crossed")
      ) {
        throw new AdminOperationsRepositoryError("conflict", "El horario no cumple la configuración operativa de la cancha.");
      }
      throw new AdminOperationsRepositoryError("unknown", "No pudimos crear la propuesta de reprogramación.");
    }
    return "Propuesta enviada. La reserva original se mantiene hasta que el cliente acepte.";
  });
}

export async function withdrawBusinessRescheduleProposalAction(requestId: string): Promise<AdminActionResult> {
  if (!isUuid(requestId)) return fail("validation", "Identificador de propuesta inválido.");
  return runAuthorized("withdraw_reschedule_proposal", async () => {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("admin_withdraw_business_reschedule_proposal", {
      p_request_id: requestId,
      p_note: null,
    });
    if (error) {
      const normalized = error.message.toLowerCase();
      if (normalized.includes("business_reschedule_proposal_expired_requires_expiration")) {
        throw new AdminOperationsRepositoryError("conflict", "La propuesta venció antes de retirarla. Actualiza la página y usa Expirar propuesta.");
      }
      if (normalized.includes("business_reschedule_proposal_already_resolved")) {
        throw new AdminOperationsRepositoryError("conflict", "La propuesta ya fue respondida o cerrada. Actualiza la página.");
      }
      if (normalized.includes("business_reschedule_proposal_not_found")) {
        throw new AdminOperationsRepositoryError("not_found", "La propuesta ya no está disponible en este negocio.");
      }
      if (normalized.includes("business_reschedule_withdrawal_forbidden")) {
        throw new AdminOperationsRepositoryError("conflict", "Tu rol o tenant activo ya no permite retirar esta propuesta.");
      }
      throw new AdminOperationsRepositoryError("unknown", "No pudimos retirar la propuesta de reprogramación.");
    }
    return "Propuesta retirada. La reserva original permanece sin cambios.";
  });
}

export async function expireBusinessRescheduleProposalAction(requestId: string): Promise<AdminActionResult> {
  if (!isUuid(requestId)) return fail("validation", "Identificador de propuesta inválido.");
  return runAuthorized("expire_reschedule_proposal", async () => {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("admin_expire_business_reschedule_proposal", {
      p_request_id: requestId,
    });
    if (error) {
      const normalized = error.message.toLowerCase();
      if (normalized.includes("business_reschedule_proposal_not_expired")) {
        throw new AdminOperationsRepositoryError("conflict", "La propuesta todavía puede ser respondida. Retírala si deseas cerrarla antes de tiempo.");
      }
      if (normalized.includes("business_reschedule_proposal_already_resolved")) {
        throw new AdminOperationsRepositoryError("conflict", "La propuesta ya fue respondida o cerrada. Actualiza la página.");
      }
      if (normalized.includes("business_reschedule_proposal_not_found")) {
        throw new AdminOperationsRepositoryError("not_found", "La propuesta ya no está disponible en este negocio.");
      }
      if (normalized.includes("business_reschedule_expiration_forbidden")) {
        throw new AdminOperationsRepositoryError("conflict", "Tu rol o tenant activo ya no permite expirar esta propuesta.");
      }
      throw new AdminOperationsRepositoryError("unknown", "No pudimos expirar la propuesta de reprogramación.");
    }
    return "Propuesta expirada. La reserva original permanece sin cambios.";
  });
}

export async function expireCustomerChangeRequestAction(requestId: string): Promise<AdminActionResult> {
  if (!isUuid(requestId)) return fail("validation", "Identificador de solicitud inválido.");
  return runAuthorized("expire_customer_change_request", async () => {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("admin_expire_customer_change_request", {
      p_request_id: requestId,
    });
    if (error) {
      const normalized = error.message.toLowerCase();
      if (normalized.includes("customer_change_request_not_expired")) {
        throw new AdminOperationsRepositoryError("conflict", "La solicitud todavía puede resolverse. Apruébala o recházala normalmente.");
      }
      if (normalized.includes("customer_change_request_already_resolved")) {
        throw new AdminOperationsRepositoryError("conflict", "La solicitud ya fue resuelta o cerrada. Actualiza la página.");
      }
      if (normalized.includes("customer_change_request_not_found")) {
        throw new AdminOperationsRepositoryError("not_found", "La solicitud ya no está disponible en este negocio.");
      }
      if (normalized.includes("customer_change_request_expiration_forbidden")) {
        throw new AdminOperationsRepositoryError("conflict", "Tu rol o tenant activo ya no permite expirar esta solicitud.");
      }
      throw new AdminOperationsRepositoryError("unknown", "No pudimos expirar la solicitud de cambio.");
    }
    return "Solicitud expirada. La reserva no fue modificada.";
  });
}

export async function archiveCancelledReservationAction(reservationId: string): Promise<AdminActionResult> {
  if (!isUuid(reservationId)) return fail("validation", "Identificador de reserva inválido.");
  return runAuthorized("archive_reservation", async (context) => {
    await createAdminOperationsRepository({ local: isLocalDevAdminUserId(context.userId) }).archiveCancelledReservation(reservationId);
    return "Reserva cancelada archivada. Se conserva para auditoría y puede restaurarse.";
  });
}

export async function restoreArchivedReservationAction(reservationId: string): Promise<AdminActionResult> {
  if (!isUuid(reservationId)) return fail("validation", "Identificador de reserva inválido.");
  return runAuthorized("restore_archived_reservation", async (context) => {
    await createAdminOperationsRepository({ local: isLocalDevAdminUserId(context.userId) }).restoreArchivedReservation(reservationId);
    return "Reserva restaurada al historial principal.";
  });
}

function validateReservationInput(
  raw: Omit<CreateManualReservationInput, "phoneE164"> & { phoneE164: string },
): { ok: true; input: CreateManualReservationInput } | { ok: false; result: AdminActionResult } {
  if (!isUuid(raw.courtId)) return { ok: false, result: fail("validation", "Cancha inválida.") };
  if (!isDateKey(raw.date) || !isClockTime(raw.startTime) || !isClockTime(raw.endTime)) {
    return { ok: false, result: fail("validation", "Fecha u horario inválido.") };
  }
  if (!isNetHeightCm(raw.netHeightCm)) return { ok: false, result: fail("validation", "La altura de red debe estar entre 180 y 250 cm.") };
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
      netHeightCm: validated.input.netHeightCm,
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
  logoUrl: string;
  services: SiteService[];
  gallery: SiteGalleryItem[];
  theme: SiteTheme;
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

    const logoUrl = normalizeSiteLogoUrl(raw.logoUrl);
    if (raw.logoUrl.trim() && !logoUrl) {
      return fail("validation", "Revisa la URL del logo antes de guardar.");
    }
    const services = normalizeSiteServices(raw.services);
    const gallery = normalizeSiteGallery(raw.gallery);
    if (!isValidSiteThemeInput(raw.theme)) {
      return fail("validation", "Revisa la paleta: cada color debe usar el formato hexadecimal #RRGGBB.");
    }
    const theme = normalizeSiteTheme(raw.theme);
    if (services.length !== raw.services.length || gallery.length !== raw.gallery.length) {
      return fail("validation", "Revisa títulos, descripciones y datos de la galería antes de guardar.");
    }
    if (!isAccessibleSiteTheme(theme)) {
      return fail("validation", "La paleta necesita más contraste. Usa colores principales suficientemente oscuros y mantén buen contraste entre fondo y texto.");
    }

    await createSiteContentRepository({ local: isLocalDevAdminUserId(context.userId) }).updateAdminContent({ logoUrl, services, gallery, theme });
    revalidatePath("/");
    revalidatePath("/buscar");
    revalidatePath("/complejo/[slug]", "page");
    revalidatePath("/admin", "layout");
    revalidatePath("/admin/configuracion");
    return { ok: true, message: "Contenido público actualizado. Logo, servicios, galería y paleta ya usan esta configuración." };
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

