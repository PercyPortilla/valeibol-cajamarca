// Chrome DevTools Protocol · solo lectura · página pública en localhost.
// No utiliza credenciales, no crea reservas ni modifica la base de datos.
import fs from "node:fs";
import path from "node:path";

const root = process.env.CAXAS_QA_ROOT || "http://127.0.0.1:4326";
const inspector = process.env.CAXAS_QA_CDP || "http://127.0.0.1:9250";
const business = "/complejo/polideportivo-san-sebastian";
const out = path.resolve("qa-caxas-san-sebastian");
fs.mkdirSync(out, { recursive: true });

const target = await (await fetch(`${inspector}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});
const requests = new Map();
let id = 0;
ws.addEventListener("message", (message) => {
  const result = JSON.parse(message.data);
  const pending = requests.get(result.id);
  if (!pending) return;
  requests.delete(result.id);
  if (result.error) pending.reject(new Error(result.error.message));
  else pending.resolve(result.result);
});
function cmd(method, params = {}) {
  return new Promise((resolve, reject) => {
    const current = ++id;
    requests.set(current, { resolve, reject });
    ws.send(JSON.stringify({ id: current, method, params }));
  });
}
await cmd("Page.enable");
await cmd("Runtime.enable");

let failed = false;
for (const scene of [
  { id: "portada-desktop", path: business, width: 1440 },
  { id: "portada-mobile", path: business, width: 390 },
  { id: "consulta-desktop", path: "/reservar?negocio=polideportivo-san-sebastian&cancha=d86214c0-03bb-4104-a848-af70e34cbab7", width: 1200 },
]) {
  await cmd("Emulation.setDeviceMetricsOverride", { width: scene.width, height: 980, mobile: scene.width <= 390, deviceScaleFactor: 1 });
  await cmd("Page.navigate", { url: root + scene.path });
  // Next App Router transmite primero un skeleton; esperar la vista REAL, no solo HTTP 200.
  let loaded = false;
  for (let attempt = 0; attempt < 35; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    const readiness = await cmd("Runtime.evaluate", {
      expression: "Boolean(document.querySelector('.business-site-header') && document.querySelector('main h1'))",
      returnByValue: true,
    });
    if (readiness.result.value === true) { loaded = true; break; }
  }
  const response = await cmd("Runtime.evaluate", {
    expression: `(() => ({
      url: location.pathname,
      title: document.querySelector('h1')?.innerText ?? '',
      header: document.querySelector('.business-site-header')?.innerText ?? '',
      headerCaxas: !!document.querySelector('.platform-header,.caxas-chrome-brand'),
      fields: [...document.querySelectorAll('.platform-court-card h4')].map(el=>el.innerText),
      sports: [...document.querySelectorAll('.business-court-sports')].map(el=>el.innerText),
      pending: document.querySelector('.platform-court-card:nth-child(2)')?.innerText ?? '',
      sportSelector: [...document.querySelectorAll('.availability-sport-choice button')].map(el=>el.innerText),
      bodyPreview: document.body.innerText.slice(0,350),
      width: innerWidth, scrollWidth: document.documentElement.scrollWidth
    }))()`,
    returnByValue: true,
  });
  const details = response.result.value;
  const image = await cmd("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  const file = path.join(out, scene.id + ".png");
  fs.writeFileSync(file, Buffer.from(image.data, "base64"));
  const good = loaded && details.url === scene.path.split("?")[0]
    && !details.headerCaxas
    && details.header.includes("Sebastián")
    && details.scrollWidth <= details.width + 1
    && (scene.id.startsWith("portada") ? details.fields.includes("Campo 1") && details.fields.includes("Campo 2") : true);
  if (!good) failed = true;
  console.log(JSON.stringify({ pass: good, file, ...details }));
}
ws.close();
await fetch(`${inspector}/json/close/${target.id}`).catch(() => {});
if (failed) process.exitCode = 1;
