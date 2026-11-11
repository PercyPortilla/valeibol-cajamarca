// QA visual del panel en modo demo LOCAL. Sin Supabase, sin identidades reales.
import fs from "node:fs";
import path from "node:path";

const root = "http://127.0.0.1:4325";
const debuggerAddress = "http://127.0.0.1:9249";
const target = await (await fetch(`${debuggerAddress}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});
let id = 0;
const outstanding = new Map();
ws.addEventListener("message", (message) => {
  const response = JSON.parse(message.data);
  const promise = outstanding.get(response.id);
  if (!promise) return;
  outstanding.delete(response.id);
  if (response.error) promise.reject(Error(response.error.message));
  else promise.resolve(response.result);
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const requestId = ++id;
    outstanding.set(requestId, { resolve, reject });
    ws.send(JSON.stringify({ id: requestId, method, params }));
  });
}
const out = path.resolve("qa-caxas-v5");
fs.mkdirSync(out, { recursive: true });
await send("Page.enable");
await send("Network.enable");
await send("Runtime.enable");
// Solo sirve en Next dev y localhost: la cookie nunca habilita producción.
await send("Network.setCookie", { name: "valeibol_local_admin", value: "1", url: root, httpOnly: true, sameSite: "Lax" });
for (const width of [1440, 390]) {
  await send("Emulation.setDeviceMetricsOverride", { width, height: 940, deviceScaleFactor: 1, mobile: width < 600 });
  await send("Page.navigate", { url: `${root}/admin` });
  await new Promise((resolve) => setTimeout(resolve, 2600));
  const details = await send("Runtime.evaluate", {
    expression: `(() => {
      const secondary = document.querySelector('.admin-start-panel .button--secondary');
      const border = secondary ? getComputedStyle(secondary).borderColor : null;
      const nav = document.querySelectorAll('.admin-nav-item').length;
      return { url: location.pathname, title: document.querySelector('h1')?.innerText, width: innerWidth, scrollWidth: document.documentElement.scrollWidth, border, nav };
    })()`,
    returnByValue: true,
  });
  const screenshot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  const file = path.join(out, `admin-v5-${width}.png`);
  fs.writeFileSync(file, Buffer.from(screenshot.data, "base64"));
  console.log(JSON.stringify({ file, ...details.result.value }));
}
ws.close();
await fetch(`${debuggerAddress}/json/close/${target.id}`).catch(() => {});
