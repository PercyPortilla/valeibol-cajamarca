import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const complex = readFileSync("app/complejo/[slug]/page.tsx", "utf8");
const tenant = readFileSync("components/site/ValeibolLanding.tsx", "utf8");
const reservation = readFileSync("app/reservar/page.tsx", "utf8");
const account = readFileSync("app/mi-cuenta/page.tsx", "utf8");
const recovery = readFileSync("app/mi-cuenta/recuperar/page.tsx", "utf8");
const owner = readFileSync("app/propietario/page.tsx", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("B86 aplica la carcasa premium a superficies de la madre sin invadir el tenant", () => {
  assert.match(complex, /platform-public-premium--complex/);
  assert.match(reservation, /platform-public-premium--reservation/g);
  assert.match(account, /platform-public-premium--account/);
  assert.match(recovery, /platform-public-premium--recovery/);
  assert.match(owner, /platform-public-premium--owner/);
  assert.match(tenant, /className="site-theme"/);
  assert.doesNotMatch(tenant, /platform-public-premium--tenant/);
});

test("B86 reutiliza B85 sin rediseñar los shells administrativos", () => {
  for (const source of [complex, reservation, account, recovery, owner]) assert.match(source, /<PlatformHeader premium \/>/);
  assert.doesNotMatch(css, /\.platform-public-premium[^\n{]*\.admin-shell/);
  assert.doesNotMatch(owner, /admin-shell|AdminShell/);
});

test("B86 conserva contenido y flujos públicos existentes", () => {
  assert.match(complex, /business\.venues\.map/);
  assert.match(complex, /PublicReviewsSection/);
  assert.match(complex, /formatMoney\(court\.priceFrom/);
  assert.match(tenant, /AvailabilityCalendar/);
  assert.match(reservation, /AvailabilityCalendar/);
  assert.match(account, /CustomerAuthForm/);
  assert.match(account, /CustomerNotificationCenter/);
  assert.match(account, /CustomerReservationClaimForm/);
  assert.match(owner, /requireAdminContext/);
});

test("B86 elimina azul y blanco legacy dentro de la nueva capa visual", () => {
  assert.match(css, /B86 · Superficies públicas premium/);
  assert.match(css, /\.platform-public-premium \{[\s\S]*?--public-premium-canvas:\s*#080a0c/);
  assert.match(css, /platform-public-premium--reservation \.platform-reservation-hero[\s\S]*?linear-gradient\(145deg,#151a1f,#080a0c/);
  assert.match(css, /platform-public-premium--account \.account-page[\s\S]*?background:[\s\S]*?#080a0c/);
  assert.match(css, /platform-public-premium--owner \.owner-portal__hero[\s\S]*?linear-gradient\(145deg,#1b2127,#090b0e/);
});

test("B86 mantiene targets foco responsive y reduced motion", () => {
  assert.match(css, /platform-public-premium :is\(a,button,input,select,textarea\):focus-visible[\s\S]*?outline:\s*3px solid #f4b740/);
  assert.match(css, /platform-public-premium \.button[\s\S]*?min-height:\s*44px/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?platform-public-premium \.platform-complex-summary/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?platform-public-premium/);
});

test("B86 queda registrado como bloque del proyecto", () => {
  assert.match(completeness, /platform-public-premium-shells\.test\.ts/);
  assert.match(completeness, /BLOCK86_PROMPT\.md/);
});
