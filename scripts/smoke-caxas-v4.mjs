// Comprobación segura de rutas públicas y denegación anónima en producción.
// No usa cookies, claves de servicio, cuentas de prueba ni altera negocios.
const site = process.env.CAXAS_SITE_URL || "https://caxas-sportcenter.vercel.app";
const supabase = "https://tuwkvkiurykecwqklvqe.supabase.co";
const business = "73426eb7-4a4f-405b-b0bd-be06cd53aa3f";

const checks = [
  { label: "Portada pública", url: `${site}/`, status: 200 },
  { label: "Global requiere login", url: `${site}/admin-global`, status: 307 },
  { label: "Estudio tenant requiere login", url: `${site}/admin/disenar`, status: 307 },
  { label: "Precios requiere login", url: `${site}/admin/precios`, status: 307 },
  { label: "Page builder no acepta acceso anónimo", url: `${site}/api/admin-global/page-builder/${business}`, status: 403, code: "unauthorized" },
  { label: "Invitaciones Edge no aceptan acceso anónimo", url: `${supabase}/functions/v1/platform-business-access`, method: "POST", status: 401 },
];

let failed = false;
for (const item of checks) {
  try {
    const response = await fetch(item.url, {
      method: item.method || "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(12000),
      headers: item.method ? { "content-type": "application/json" } : undefined,
      body: item.method ? "{}" : undefined,
    });
    let code = null;
    if (item.code && response.headers.get("content-type")?.includes("json")) {
      code = (await response.json()).code ?? null;
    }
    const ok = response.status === item.status && (!item.code || code === item.code);
    console.log(`${ok ? "PASS" : "FAIL"} · ${item.label} · HTTP ${response.status}${code ? ` · ${code}` : ""}`);
    if (!ok) failed = true;
  } catch (error) {
    console.log(`FAIL · ${item.label} · ${error instanceof Error ? error.message : "error de red"}`);
    failed = true;
  }
}
if (failed) process.exitCode = 1;
