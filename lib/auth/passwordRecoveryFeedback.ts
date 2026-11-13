type RecoveryRequestError = {
  code?: string | undefined;
  status?: number | undefined;
};

export type RecoveryFailure =
  | "email_rate_limit"
  | "email_recipient_restricted"
  | "other";

// No comprueba ni expone si un correo existe en Supabase Auth.
// La cuota de emails es del PROYECTO, no del usuario ni del perfil tenant.
export function passwordRecoveryFailure(error: RecoveryRequestError): {
  kind: RecoveryFailure;
  message: string;
} {
  if (
    error.status === 429 ||
    error.code === "over_email_send_rate_limit" ||
    error.code === "over_request_rate_limit"
  ) {
    return {
      kind: "email_rate_limit",
      message:
        "El servicio de correo de la plataforma alcanzó temporalmente su límite de envíos (HTTP 429). No se generó un nuevo correo. No repitas la solicitud continuamente: revisa si ya recibiste un enlace anterior y, si no, vuelve a intentarlo más tarde. El administrador de Caxas debe revisar los límites de correo y configurar SMTP propio para una solución estable.",
    };
  }
  if (error.code === "email_address_not_authorized") {
    return {
      kind: "email_recipient_restricted",
      message:
        "El servicio de correo configurado no permite enviar a este destinatario. El administrador de Caxas debe configurar un proveedor SMTP propio en Supabase. No es necesario crear otra cuenta.",
    };
  }
  return {
    kind: "other",
    message:
      "No se pudo solicitar el correo de recuperación. Inténtalo más tarde o comunícate con el administrador de Caxas. No crees otra cuenta.",
  };
}
