import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import puppeteer from "puppeteer-core";
import axe from "axe-core";

const baseUrl = (process.env.UI_BASE_URL || "").replace(/\/$/, "");
const chrome = process.env.CHROME_BIN;
const label = process.env.UI_LABEL || "preview";
if (!baseUrl || !chrome) {
  console.error("UI_BASE_URL y CHROME_BIN son obligatorios.");
  process.exit(2);
}

const viewports = [
  [360, 900],
  [390, 900],
  [430, 932],
  [768, 1024],
  [1024, 900],
  [1440, 1000],
];

const screenshots = resolve(process.env.SCREENSHOT_DIR || "ui-screenshots");
mkdirSync(screenshots, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

let failed = 0;
const summary = [];

function record(ok, viewport, check, detail = "") {
  summary.push({ viewport, check, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} · ${label} · ${viewport} · ${check}${detail ? ` · ${detail}` : ""}`);
  if (!ok) failed += 1;
}

try {
  for (const [width, height] of viewports) {
    const viewport = `${width}x${height}`;
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });

    const response = await page.goto(baseUrl, { waitUntil: "networkidle2", timeout: 60_000 });
    record(Boolean(response && (response.ok() || response.status() === 304)), viewport, "homepage HTTP", String(response?.status() ?? "no-response"));

    await page.addScriptTag({ content: axe.source });

    const layout = await page.evaluate(() => {
      const root = document.documentElement;
      const bodyText = document.body.innerText;
      const requiredIds = ["disponibilidad", "precios", "servicios", "galeria", "ubicacion"];
      const missingSections = requiredIds.filter((id) => !document.getElementById(id));
      const technicalCopy = ["Modo demostración", "Supabase no configurado", "checkpoint", "RPC", "backend"]
        .filter((term) => bodyText.toLowerCase().includes(term.toLowerCase()));

      const targetSelector = [
        "button",
        "[role='tab']",
        ".button",
        ".site-nav a",
        ".time-slot button",
        ".icon-button",
      ].join(",");
      const undersizedTargets = [...document.querySelectorAll(targetSelector)]
        .filter((node) => {
          if (!(node instanceof HTMLElement)) return false;
          const style = getComputedStyle(node);
          if (style.display === "none" || style.visibility === "hidden") return false;
          const rect = node.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return false;
          return rect.width < 44 || rect.height < 44;
        })
        .slice(0, 20)
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return `${node.tagName.toLowerCase()}.${node.className}: ${Math.round(rect.width)}x${Math.round(rect.height)}`;
        });

      return {
        scrollWidth: root.scrollWidth,
        innerWidth: window.innerWidth,
        missingSections,
        technicalCopy,
        undersizedTargets,
      };
    });

    record(layout.scrollWidth <= layout.innerWidth + 2, viewport, "sin overflow horizontal", `${layout.scrollWidth}/${layout.innerWidth}`);
    record(layout.missingSections.length === 0, viewport, "secciones comerciales", layout.missingSections.join(","));
    record(layout.technicalCopy.length === 0, viewport, "sin copy técnico visible", layout.technicalCopy.join(","));
    record(layout.undersizedTargets.length === 0, viewport, "targets táctiles >=44px", layout.undersizedTargets.join(" | "));

    const axeResult = await page.evaluate(async () => {
      const result = await window.axe.run(document, {
        resultTypes: ["violations"],
      });
      return result.violations
        .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
        .map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          nodes: violation.nodes.length,
        }));
    });
    record(axeResult.length === 0, viewport, "Axe serious/critical", JSON.stringify(axeResult));

    await page.screenshot({
      path: resolve(screenshots, `${label}-home-${width}.png`),
      fullPage: true,
    });

    const adminResponse = await page.goto(`${baseUrl}/admin`, { waitUntil: "networkidle2", timeout: 60_000 });
    const adminUrl = page.url();
    record(
      adminUrl.includes("/admin/login") && Boolean(adminResponse),
      viewport,
      "admin protegido",
      `${adminResponse?.status() ?? "no-response"} -> ${adminUrl}`,
    );

    const adminLayout = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    record(adminLayout.scrollWidth <= adminLayout.innerWidth + 2, viewport, "admin sin overflow", `${adminLayout.scrollWidth}/${adminLayout.innerWidth}`);

    await page.addScriptTag({ content: axe.source });
    const adminAxe = await page.evaluate(async () => {
      const result = await window.axe.run(document, { resultTypes: ["violations"] });
      return result.violations
        .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
        .map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.length }));
    });
    record(adminAxe.length === 0, viewport, "admin Axe serious/critical", JSON.stringify(adminAxe));

    await page.screenshot({
      path: resolve(screenshots, `${label}-admin-${width}.png`),
      fullPage: true,
    });
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ label, baseUrl, checks: summary.length, failures: failed }, null, 2));
if (failed) process.exit(1);
