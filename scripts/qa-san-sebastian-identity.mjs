// Chrome DevTools Protocol · solo lectura · página pública (local o producción).
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

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function evaluate(expression) {
  const result = await cmd("Runtime.evaluate", { expression, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Error en el navegador");
  return result.result.value;
}
async function waitFor(expression, attempts = 45) {
  for (let i = 0; i < attempts; i++) {
    await pause(600);
    if (await evaluate(expression)) return true;
  }
  return false;
}

async function inspectSportSelection(slug) {
  const clicked = await evaluate(`(() => {
    const label = ${JSON.stringify(slug)} === 'futbol' ? /f[uú]tbol/i : /v[oó]ley/i;
    const button = [...document.querySelectorAll('.availability-sport-choice button')]
      .find((element) => label.test(element.textContent || ''));
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!clicked) return { clicked: false };
  await pause(450);
  return evaluate(`(() => {
    const label = ${JSON.stringify(slug)} === 'futbol' ? /f[uú]tbol/i : /v[oó]ley/i;
    const buttons = [...document.querySelectorAll('.availability-sport-choice button')];
    const chosen = buttons.find((element) => label.test(element.textContent || ''));
    const links = [...document.querySelectorAll('.desktop-week a.slot-cta[href]')];
    const messages = links.map((element) => {
      try { return new URL(element.href).searchParams.get('text') || ''; }
      catch { return ''; }
    });
    return {
      clicked: true,
      selected: chosen?.getAttribute('aria-pressed') === 'true',
      selectedCount: buttons.filter((button) => button.getAttribute('aria-pressed') === 'true').length,
      court: document.querySelector('.platform-reservation-hero__copy')?.innerText.includes('Campo 1') ?? false,
      agenda: document.querySelector('.desktop-week')?.innerText ?? '',
      availableLinks: links.length,
      whatsappCorrect: messages.length ? messages.every((message) =>
        message.includes('Campo 1 (' + ${JSON.stringify(slug)} + ')') &&
        message.includes('¿Podrían confirmar disponibilidad y tarifa?')) : null,
    };
  })()`);
}

let failed = false;
for (const scene of [
  { id: "portada-desktop", path: business, width: 1440 },
  { id: "portada-mobile", path: business, width: 390 },
  { id: "consulta-desktop", path: "/reservar?negocio=polideportivo-san-sebastian&cancha=d86214c0-03bb-4104-a848-af70e34cbab7", width: 1200 },
]) {
  await cmd("Emulation.setDeviceMetricsOverride", { width: scene.width, height: 980, mobile: scene.width <= 390, deviceScaleFactor: 1 });
  await cmd("Page.navigate", { url: root + scene.path });
  // Next App Router transmite primero un skeleton; esperar la vista REAL, no solo HTTP 200.
  const loaded = await waitFor("Boolean(document.querySelector('.business-site-header') && document.querySelector('main h1'))");
  // La cabecera puede estar lista antes de que se hidrate el calendario cliente.
  const hydrated = scene.id !== "consulta-desktop" || (loaded && await waitFor(
    "document.querySelectorAll('.availability-sport-choice button').length === 2",
  ));
  let sportProbe = null;
  if (scene.id === "consulta-desktop" && hydrated) {
    const voley = await inspectSportSelection("voley");
    const futbol = await inspectSportSelection("futbol");
    const bothHaveLinks = voley.availableLinks > 0 && futbol.availableLinks > 0;
    sportProbe = {
      sports: ["voley", "futbol"],
      selectionWorks: voley.selected && futbol.selected && voley.selectedCount === 1 && futbol.selectedCount === 1,
      samePhysicalCourt: voley.court && futbol.court && voley.agenda === futbol.agenda,
      availableLinks: { voley: voley.availableLinks, futbol: futbol.availableLinks },
      whatsappVerified: bothHaveLinks ? voley.whatsappCorrect && futbol.whatsappCorrect : null,
      whatsappNote: bothHaveLinks ? "Mensajes de ambos deportes validados" : "Sin enlaces consultables en la semana actual; no se verifica mensaje",
    };
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
      geometry: (() => {
        const title = document.querySelector('.platform-complex-title-row h1');
        const row = document.querySelector('.platform-complex-title-row');
        if (!title || !row) return null;
        const a = title.getBoundingClientRect(), b = row.getBoundingClientRect();
        return { titleX:a.x,titleWidth:a.width,titleScrollWidth:title.scrollWidth,rowX:b.x,rowWidth:b.width,
          fontSize:getComputedStyle(title).fontSize,textWrap:getComputedStyle(title).textWrap };
      })(),
      bodyPreview: document.body.innerText.slice(0,350),
      width: innerWidth, scrollWidth: document.documentElement.scrollWidth
    }))()`,
    returnByValue: true,
  });
  const details = response.result.value;
  const image = await cmd("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  const file = path.join(out, scene.id + ".png");
  fs.writeFileSync(file, Buffer.from(image.data, "base64"));
  const good = loaded && hydrated && details.url === scene.path.split("?")[0]
    && !details.headerCaxas
    && details.header.includes("Sebastián")
    && details.scrollWidth <= details.width + 1
    && (scene.id.startsWith("portada") ? details.fields.includes("Campo 1") && details.fields.includes("Campo 2") : true)
    && (scene.id === "consulta-desktop" ? sportProbe?.selectionWorks && sportProbe?.samePhysicalCourt && sportProbe?.whatsappVerified !== false : true);
  if (!good) failed = true;
  console.log(JSON.stringify({ pass: good, file, hydrated, sportProbe, ...details }));
}
ws.close();
await fetch(`${inspector}/json/close/${target.id}`).catch(() => {});
if (failed) process.exitCode = 1;
