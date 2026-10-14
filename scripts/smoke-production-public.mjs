const baseUrl = (process.env.PRODUCTION_BASE_URL || "https://valeibol-cajamarca-live.vercel.app").replace(/\/$/, "");

async function fetchChecked(path, expected) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual", cache: "no-store" });
  const ok = expected.includes(response.status);
  console.log(`${ok ? "PASS" : "FAIL"} · ${path} · HTTP ${response.status}`);
  if (!ok) process.exitCode = 1;
  return response;
}

const home = await fetchChecked("/", [200]);
const html = await home.text();
for (const forbidden of ["Modo demostración", "Supabase no configurado"]) {
  const ok = !html.toLowerCase().includes(forbidden.toLowerCase());
  console.log(`${ok ? "PASS" : "FAIL"} · producción sin "${forbidden}"`);
  if (!ok) process.exitCode = 1;
}

const admin = await fetchChecked("/admin", [301,302,303,307,308]);
const location = admin.headers.get("location") || "";
const adminProtected = location.includes("/admin/login");
console.log(`${adminProtected ? "PASS" : "FAIL"} · admin protegido · ${location || "sin location"}`);
if (!adminProtected) process.exitCode = 1;

await fetchChecked("/robots.txt", [200]);
await fetchChecked("/sitemap.xml", [200]);
await fetchChecked("/privacidad", [200]);
