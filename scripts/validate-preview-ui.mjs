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
  [844, 390],
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
      const requiredPlatformSelectors = [
        ".platform-home-hero",
        ".platform-home-search",
        ".platform-sport-diorama",
        ".platform-home-sports",
        ".platform-home-featured",
        ".platform-home-owner",
      ];
      const missingPlatformSections = requiredPlatformSelectors.filter((selector) => !document.querySelector(selector));
      const technicalCopy = ["Modo demostración", "Supabase no configurado", "checkpoint", "RPC", "backend"]
        .filter((term) => bodyText.toLowerCase().includes(term.toLowerCase()));

      const targetSelector = [
        "button",
        "[role='tab']",
        ".button",
        ".platform-brand",
        ".platform-nav a",
        ".platform-page .text-link",
        ".platform-footer a",
        ".platform-home-search input:not([type='hidden'])",
        ".platform-home-search select",
        ".site-nav a",
        ".owner-portal a",
        ".global-admin-links a",
        ".global-admin-pagination a",
        ".account-reservation-actions a",
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
        missingPlatformSections,
        technicalCopy,
        undersizedTargets,
      };
    });

    record(layout.scrollWidth <= layout.innerWidth + 2, viewport, "sin overflow horizontal", `${layout.scrollWidth}/${layout.innerWidth}`);
    record(layout.missingPlatformSections.length === 0, viewport, "secciones plataforma", layout.missingPlatformSections.join(","));
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
          targets: violation.nodes.slice(0, 12).map((node) => node.target.join(" ")),
        }));
    });
    record(axeResult.length === 0, viewport, "Axe serious/critical", JSON.stringify(axeResult));

    await page.screenshot({
      path: resolve(screenshots, `${label}-home-${width}.png`),
      fullPage: true,
    });

    const searchResponse = await page.goto(`${baseUrl}/buscar?deporte=voley&ciudad=Cajamarca`, { waitUntil: "networkidle2", timeout: 60_000 });
    const searchLayout = await page.evaluate(() => ({
      hasSearch: Boolean(document.querySelector(".platform-search-form")),
      hasResultsSection: Boolean(document.querySelector(".platform-section")),
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    record(Boolean(searchResponse && (searchResponse.ok() || searchResponse.status() === 304)), viewport, "Buscar HTTP", String(searchResponse?.status() ?? "no-response"));
    record(searchLayout.hasSearch && searchLayout.hasResultsSection, viewport, "Buscar estructura", JSON.stringify(searchLayout));
    record(searchLayout.scrollWidth <= searchLayout.innerWidth + 2, viewport, "Buscar sin overflow", `${searchLayout.scrollWidth}/${searchLayout.innerWidth}`);

    await page.addScriptTag({ content: axe.source });
    const searchAxe = await page.evaluate(async () => {
      const result = await window.axe.run(document, { resultTypes: ["violations"] });
      return result.violations
        .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
        .map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.length }));
    });
    record(searchAxe.length === 0, viewport, "Buscar Axe serious/critical", JSON.stringify(searchAxe));

    await page.screenshot({
      path: resolve(screenshots, `${label}-buscar-${width}x${height}.png`),
      fullPage: true,
    });

    const valeibolResponse = await page.goto(`${baseUrl}/complejo/valeibol-cajamarca`, { waitUntil: "networkidle2", timeout: 60_000 });
    const valeibolLayout = await page.evaluate(() => {
      const requiredIds = ["disponibilidad", "precios", "servicios", "galeria", "ubicacion"];
      return {
        statusSections: requiredIds.filter((id) => !document.getElementById(id)),
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      };
    });
    record(Boolean(valeibolResponse && (valeibolResponse.ok() || valeibolResponse.status() === 304)), viewport, "Valeibol HTTP", String(valeibolResponse?.status() ?? "no-response"));
    record(valeibolLayout.statusSections.length === 0, viewport, "secciones Valeibol", valeibolLayout.statusSections.join(","));
    record(valeibolLayout.scrollWidth <= valeibolLayout.innerWidth + 2, viewport, "Valeibol sin overflow", `${valeibolLayout.scrollWidth}/${valeibolLayout.innerWidth}`);

    await page.addScriptTag({ content: axe.source });
    const valeibolAxe = await page.evaluate(async () => {
      const result = await window.axe.run(document, { resultTypes: ["violations"] });
      return result.violations
        .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
        .map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.length }));
    });
    record(valeibolAxe.length === 0, viewport, "Valeibol Axe serious/critical", JSON.stringify(valeibolAxe));

    await page.screenshot({
      path: resolve(screenshots, `${label}-valeibol-${width}.png`),
      fullPage: true,
    });

    const accountResponse = await page.goto(`${baseUrl}/mi-cuenta`, { waitUntil: "networkidle2", timeout: 60_000 });
    const accountLayout = await page.evaluate(() => {
      const root = document.documentElement;
      const targets = [...document.querySelectorAll(".account-page button, .account-page .button")]
        .filter((node) => {
          if (!(node instanceof HTMLElement)) return false;
          const style = getComputedStyle(node);
          if (style.display === "none" || style.visibility === "hidden") return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
        })
        .slice(0, 12)
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return `${node.tagName.toLowerCase()}.${node.className}: ${Math.round(rect.width)}x${Math.round(rect.height)}`;
        });
      return {
        hasHeading: Boolean(document.querySelector(".account-page__heading h1")),
        hasAuthOrAccount: Boolean(document.querySelector(".customer-auth-card, .account-user-bar")),
        scrollWidth: root.scrollWidth,
        innerWidth: window.innerWidth,
        undersizedTargets: targets,
      };
    });
    record(Boolean(accountResponse && (accountResponse.ok() || accountResponse.status() === 304)), viewport, "Mi cuenta HTTP", String(accountResponse?.status() ?? "no-response"));
    record(accountLayout.hasHeading && accountLayout.hasAuthOrAccount, viewport, "Mi cuenta estructura", JSON.stringify(accountLayout));
    record(accountLayout.scrollWidth <= accountLayout.innerWidth + 2, viewport, "Mi cuenta sin overflow", `${accountLayout.scrollWidth}/${accountLayout.innerWidth}`);
    record(accountLayout.undersizedTargets.length === 0, viewport, "Mi cuenta targets >=44px", accountLayout.undersizedTargets.join(" | "));

    await page.addScriptTag({ content: axe.source });
    const accountAxe = await page.evaluate(async () => {
      const result = await window.axe.run(document, { resultTypes: ["violations"] });
      return result.violations
        .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
        .map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.length }));
    });
    record(accountAxe.length === 0, viewport, "Mi cuenta Axe serious/critical", JSON.stringify(accountAxe));

    await page.screenshot({
      path: resolve(screenshots, `${label}-account-${width}x${height}.png`),
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
