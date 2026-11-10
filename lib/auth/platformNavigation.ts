/**
 * Limpiar el scope solo al abrir la administración global como documento.
 * Una precarga RSC/prefetch de la página global no debe cancelar la selección
 * hecha segundos después desde «Administrar negocio».
 */
export function shouldClearPlatformBusinessSelection(input: {
  pathname: string;
  method: string;
  headers: Pick<Headers, "get">;
}): boolean {
  const { pathname, method, headers } = input;
  if (pathname !== "/admin-global" && !pathname.startsWith("/admin-global/")) return false;
  if (method !== "GET") return false;

  const destination = headers.get("sec-fetch-dest");
  if (destination && destination !== "document") return false;
  if (headers.get("rsc") === "1" || headers.get("next-router-prefetch") === "1") return false;
  if ((headers.get("purpose") ?? "").toLowerCase().includes("prefetch")) return false;
  if ((headers.get("sec-purpose") ?? "").toLowerCase().includes("prefetch")) return false;

  return destination === "document" || (headers.get("accept") ?? "").includes("text/html");
}
