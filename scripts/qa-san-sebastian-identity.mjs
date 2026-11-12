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

async function clickChoice(group, test) {
  const clicked = await evaluate(`(() => {
    const group = document.querySelectorAll('.ss-booking-board__choice')[${group}];
    const button = [...(group?.querySelectorAll('button') ?? [])]
      .find((item) => ${test}.test(item.textContent ?? ''));
    if (!button) return false;
    button.click();
    return true;
  })()`);
  await pause(350);
  return clicked;
}

async function inspectCinematicHome() {
  const ready = await waitFor("document.querySelectorAll('.ss-cinema-field-card').length === 2");
  if (!ready) return { loaded: false };
  const opening = await evaluate(`(() => ({
    title: document.querySelector('.ss-cinema-hero h1')?.textContent ?? '',
    photo: !!document.querySelector('.ss-cinema-hero__photo'),
    cards: [...document.querySelectorAll('.ss-cinema-field-card__title')].map(e => e.textContent.trim()),
    headerCaxas: !!document.querySelector('.platform-header,.caxas-chrome-brand'),
  }))()`);
  await evaluate("document.querySelectorAll('.ss-cinema-sports__switch button')[1]?.click(); true");
  await pause(280);
  const voley = await evaluate("document.querySelector('.ss-cinema-pitch__board')?.getAttribute('aria-label') ?? ''");
  await evaluate("document.querySelectorAll('.ss-cinema-sports__switch button')[0]?.click(); true");
  await pause(180);
  const futbol = await evaluate("document.querySelector('.ss-cinema-pitch__board')?.getAttribute('aria-label') ?? ''");
  await evaluate("document.querySelectorAll('.ss-cinema-field-card')[1]?.click(); true");
  await pause(220);
  const campo2 = await evaluate(`(() => ({
    title: document.querySelector('.ss-cinema-fields__detail h3')?.textContent ?? '',
    pending: document.querySelector('.ss-cinema-fields__status')?.textContent.includes('HORARIOS POR CONFIRMAR'),
    href: document.querySelector('.ss-cinema-fields__detail a[href]')?.getAttribute('href') ?? '',
  }))()`);
  await evaluate("document.querySelectorAll('.ss-cinema-field-card')[0]?.click(); true");
  await pause(220);
  const campo1 = await evaluate(`(() => ({
    title: document.querySelector('.ss-cinema-fields__detail h3')?.textContent ?? '',
    href: document.querySelector('.ss-cinema-fields__detail a[href]')?.getAttribute('href') ?? '',
  }))()`);
  return {
    loaded: true,
    title: opening.title.includes('El partido') && opening.title.includes('aquí.'),
    realPhoto: opening.photo,
    ownBrand: !opening.headerCaxas,
    bothCourts: opening.cards.join(',') === 'Campo 1,Campo 2',
    switchesSports: voley.includes('vóley') && futbol.includes('fútbol'),
    campo2: campo2.title.includes('Campo 2') && campo2.pending && campo2.href.includes('b8b5bffe-189d-4490-8671-0591a642be36'),
    campo1: campo1.title.includes('Campo 1') && campo1.href.includes('d86214c0-03bb-4104-a848-af70e34cbab7'),
  };
}

async function inspectBookingPlanner(startOnPending) {
  const boardReady = await waitFor("document.querySelectorAll('.ss-booking-board__choice').length === 3");
  if (!boardReady) return { loaded: false };
  if (startOnPending) {
    const dayClick = await evaluate(`(() => {
      const day = document.querySelectorAll('.ss-booking-board__date')[4];
      if (!day) return false;
      day.click();
      return true;
    })()`);
    await pause(400);
    return evaluate(`(() => {
      const selected = document.querySelector('.ss-booking-board__choice .is-selected')?.textContent ?? '';
      const pending = document.querySelector('.ss-booking-board__pending')?.textContent ?? '';
      const link = document.querySelector('.ss-booking-board__summary a[href]')?.href;
      const message = link ? new URL(link).searchParams.get('text') : '';
      return { loaded:true, pending: pending.includes('Campo 2') && pending.includes('Horarios y tarifas por confirmar'),
        selectedCampo2:selected.includes('Campo 2'), noInventedSlots:!document.querySelector('.ss-booking-board__slot'),
        sevenDays:document.querySelectorAll('.ss-booking-board__date').length === 7,
        dayCanBeSelected:${dayClick} && !!document.querySelector('.ss-booking-board__date.is-selected'),
        whatsappInformative:!!message && message.includes('Campo 2') && message.includes('preferentemente el') };
    })()`);
  }
  const hourChoice = await clickChoice(2, /^2 horas$/i);
  const dates = await evaluate("document.querySelectorAll('.ss-booking-board__date').length");
  let chosen = false;
  for (let index = 0; index < dates && !chosen; index++) {
    await evaluate(`(() => { document.querySelectorAll('.ss-booking-board__date')[${index}]?.click(); return true; })()`);
    await pause(250);
    chosen = await evaluate(`(() => { const slot = document.querySelector('.ss-booking-board__slot:not(:disabled)'); if (!slot) return false; slot.click(); return true; })()`);
    if (chosen) await pause(250);
  }
  const read = () => evaluate(`(() => {
    const board = document.querySelector('.ss-booking-board');
    const link = board?.querySelector('.ss-booking-board__summary a[href]');
    const buttons = [...document.querySelectorAll('.ss-booking-board__choice:nth-child(2) button')];
    const message = link ? new URL(link.href).searchParams.get('text') : '';
    return { message, available: document.querySelectorAll('.ss-booking-board__slot:not(:disabled)').length,
      selectedSlot: document.querySelector('.ss-booking-board__slot.is-selected')?.textContent ?? '',
      selectedSport: buttons.find((button) => button.getAttribute('aria-pressed') === 'true')?.textContent ?? '',
      boardBackground: board ? getComputedStyle(board).backgroundColor : '',
      statusSemantics: !!document.querySelector('.ss-booking-board__slot-status') &&
        !document.body.textContent.includes('Disponible para consultar') &&
        !!document.querySelector('.ss-booking-board__slot-status'),
      duration: document.querySelector('.ss-booking-board__choice:nth-child(3) .is-selected')?.textContent ?? '' };
  })()`);
  const voleyClicked = await clickChoice(1, /v[oó]ley/i);
  const voley = await read();
  const futbolClicked = await clickChoice(1, /f[uú]tbol/i);
  const futbol = await read();
  const campo2Clicked = await clickChoice(0, /Campo 2/i);
  const pending = await evaluate(`(() => {
    const link = document.querySelector('.ss-booking-board__summary a[href]');
    return { status: document.querySelector('.ss-booking-board__pending')?.textContent.includes('Horarios y tarifas por confirmar'),
      noInventedSlots: !document.querySelector('.ss-booking-board__slot'),
      sevenDays:document.querySelectorAll('.ss-booking-board__date').length === 7,
      whatsapp: link ? new URL(link.href).searchParams.get('text') : '' };
  })()`);
  return {
    loaded: true, hourChoice, chosen, voleyClicked, futbolClicked, campo2Clicked,
    twoHours: voley.duration.trim() === '2 horas' && futbol.duration.trim() === '2 horas',
    selectedSportWorks: /v[oó]ley/i.test(voley.selectedSport) && /f[uú]tbol/i.test(futbol.selectedSport),
    samePhysicalSlot: voley.selectedSlot === futbol.selectedSlot && !!voley.selectedSlot,
    messageWorks: !!voley.message && !!futbol.message &&
      voley.message.includes('Campo 1') && voley.message.includes('Vóley') && voley.message.includes('2 horas') &&
      futbol.message.includes('Campo 1') && futbol.message.includes('Fútbol') && futbol.message.includes('2 horas'),
    lightOwnTheme: voley.boardBackground === 'rgb(255, 255, 255)',
    statusSemantics: voley.statusSemantics && futbol.statusSemantics,
    campo2Pending: pending.status && pending.noInventedSlots && pending.sevenDays && pending.whatsapp?.includes('Campo 2') && pending.whatsapp?.includes('2 horas'),
  };
}

let failed = false;
for (const scene of [
  { id: "portada-desktop", path: business, width: 1440 },
  { id: "portada-mobile", path: business, width: 390 },
  { id: "consulta-desktop", path: "/reservar?negocio=polideportivo-san-sebastian&cancha=d86214c0-03bb-4104-a848-af70e34cbab7", width: 1200 },
  { id: "consulta-mobile", path: "/reservar?negocio=polideportivo-san-sebastian&cancha=d86214c0-03bb-4104-a848-af70e34cbab7", width: 390 },
  { id: "campo2-desktop", path: "/reservar?negocio=polideportivo-san-sebastian&cancha=b8b5bffe-189d-4490-8671-0591a642be36", width: 1200 },
  { id: "campo2-mobile", path: "/reservar?negocio=polideportivo-san-sebastian&cancha=b8b5bffe-189d-4490-8671-0591a642be36", width: 390 },
]) {
  await cmd("Emulation.setDeviceMetricsOverride", { width: scene.width, height: 980, mobile: scene.width <= 390, deviceScaleFactor: 1 });
  await cmd("Page.navigate", { url: root + scene.path });
  // Next App Router transmite primero un skeleton; esperar la vista REAL, no solo HTTP 200.
  const loaded = await waitFor("Boolean(document.querySelector('.business-site-header') && document.querySelector('main h1'))");
  // La cabecera puede estar lista antes de que se hidrate el calendario cliente.
  const isPlanner = scene.id.startsWith("consulta") || scene.id.startsWith("campo2");
  const hydrated = !isPlanner || (loaded && await waitFor(
    "document.querySelectorAll('.ss-booking-board__choice').length === 3",
  ));
  let sportProbe = null;
  if (isPlanner && hydrated) sportProbe = await inspectBookingPlanner(scene.id.startsWith("campo2"));
  const cinemaProbe = scene.id.startsWith("portada") && loaded ? await inspectCinematicHome() : null;
  const response = await cmd("Runtime.evaluate", {
    expression: `(() => ({
      url: location.pathname,
      title: document.querySelector('h1')?.innerText ?? '',
      header: document.querySelector('.business-site-header')?.innerText ?? '',
      headerCaxas: !!document.querySelector('.platform-header,.caxas-chrome-brand'),
      fields: [...document.querySelectorAll('.platform-court-card h4,.ss-cinema-field-card__title')].map(el=>el.innerText),
      sports: [...document.querySelectorAll('.business-court-sports')].map(el=>el.innerText),
      pending: document.querySelector('.platform-court-card:nth-child(2)')?.innerText ?? '',
      sportSelector: [...document.querySelectorAll('.ss-booking-board__choice:nth-child(2) button')].map(el=>el.innerText),
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
  if (isPlanner && hydrated) {
    // Captura de la pizarra, no solo del hero por encima de ella.
    if (scene.id.startsWith("consulta")) {
      await evaluate("document.querySelector('.ss-booking-board__choice button')?.click(); true");
      await pause(200);
    }
    await evaluate("document.querySelector('.ss-booking-board')?.scrollIntoView({block:'start'}); true");
    await pause(250);
  }
  const image = await cmd("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  const file = path.join(out, scene.id + ".png");
  fs.writeFileSync(file, Buffer.from(image.data, "base64"));
  if (scene.id.startsWith("portada") && cinemaProbe?.loaded) {
    await evaluate("document.querySelector('.ss-cinema-fields__deck')?.scrollIntoView({block:'center'}); true");
    await pause(650);
    const cardShot = await cmd("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    fs.writeFileSync(path.join(out, scene.id + "-cinematic-campos.png"), Buffer.from(cardShot.data, "base64"));
  }
  if (scene.id.startsWith("consulta") && hydrated) {
    await evaluate("document.querySelector('.ss-booking-board__slots')?.scrollIntoView({block:'start'}); true");
    await pause(250);
    const slotsShot = await cmd("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    fs.writeFileSync(path.join(out, scene.id + "-horarios.png"), Buffer.from(slotsShot.data, "base64"));
  }
  const good = loaded && hydrated && details.url === scene.path.split("?")[0]
    && !details.headerCaxas
    && details.header.includes("Sebastián")
    && details.scrollWidth <= details.width + 1
    && (scene.id.startsWith("portada") ? details.fields.includes("Campo 1") && details.fields.includes("Campo 2") : true)
    && (scene.id.startsWith("portada") ? Object.values(cinemaProbe ?? {}).every(Boolean) && cinemaProbe?.loaded : true)
    && (scene.id.startsWith("consulta") ? sportProbe?.loaded && sportProbe?.twoHours && sportProbe?.selectedSportWorks && sportProbe?.samePhysicalSlot && sportProbe?.messageWorks && sportProbe?.statusSemantics && sportProbe?.lightOwnTheme && sportProbe?.campo2Pending : true)
    && (scene.id.startsWith("campo2") ? sportProbe?.pending && sportProbe?.selectedCampo2 && sportProbe?.sevenDays && sportProbe?.dayCanBeSelected && sportProbe?.noInventedSlots && sportProbe?.whatsappInformative : true);
  if (!good) failed = true;
  console.log(JSON.stringify({ pass: good, file, hydrated, sportProbe, cinemaProbe, ...details }));
}
ws.close();
await fetch(`${inspector}/json/close/${target.id}`).catch(() => {});
if (failed) process.exitCode = 1;
