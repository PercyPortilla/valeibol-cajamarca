import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildBusinessDetail, groupCatalogByBusiness, type PlatformCatalogItem } from "../lib/data/repositories/platformRepository.ts";
import { isAccessibleSiteTheme, normalizeSiteTheme, SITE_THEME_PRESETS } from "../lib/siteContent.ts";

const read = (filename: string) => readFileSync(filename, "utf8");
const migration = read("supabase/migrations/20261111214813_san_sebastian_multisport_courts.sql");
const detailPage = read("app/complejo/[slug]/page.tsx");
const reservePage = read("app/reservar/page.tsx");
const header = read("components/platform/BusinessSiteHeader.tsx");
const footer = read("components/platform/BusinessSiteFooter.tsx");
const styles = read("app/styles/caxas-business-independent-2026.css");
const calendar = read("components/availability/AvailabilityCalendar.tsx");
const adminCourtSports = read("components/admin/AdminCourtSportSettings.tsx");
const browserQa = read("scripts/qa-san-sebastian-identity.mjs");

const voley: PlatformCatalogItem = {
  businessId: "business-1", businessSlug: "polideportivo-san-sebastian",
  businessName: "Polideportivo San Sebastián", businessCity: "Cajamarca",
  businessCountry: "Perú", businessTimezone: "America/Lima",
  logoUrl: "/images/brand.png", coverImageUrl: null, coverAltText: null,
  ratingAverage: null, reviewCount: 0,
  venueId: "venue-1", venueSlug: "san-sebastian", venueName: "San Sebastián",
  venueCity: "Cajamarca", venueAddress: "Jirón Silva Santisteban 1182",
  latitude: null, longitude: null,
  courtId: "campo-1", courtSlug: "campo-1", courtName: "Campo 1", courtSurface: null,
  sportId: "voley-id", sportSlug: "voley", sportName: "Vóley",
  priceFrom: 25, currency: "PEN",
};

test("un campo físico que admite fútbol y vóley cuenta como UNA cancha y DOS deportes", () => {
  const rows = [voley, { ...voley, sportId: "futbol-id", sportSlug: "futbol", sportName: "Fútbol" }];
  const business = buildBusinessDetail(rows, "polideportivo-san-sebastian");
  assert.ok(business);
  assert.equal(business.venues.length, 1);
  assert.equal(business.venues[0].courts.length, 1);
  assert.deepEqual(business.venues[0].courts[0].sports.map((sport) => sport.slug), ["voley", "futbol"]);
  const card = groupCatalogByBusiness(rows)[0];
  assert.equal(card.courts, 1);
  assert.deepEqual(card.sports, ["Fútbol", "Vóley"]);
});

test("San Sebastián publica dos campos físicos sin inventar horarios ni tarifas para Campo 2", () => {
  assert.match(migration, /set name='Campo 1'/);
  assert.match(migration, /'campo-2','Campo 2',2,false,'provisional'/);
  assert.match(migration, /create table if not exists public.court_extra_sports/);
  assert.match(migration, /create table if not exists public.court_public_showcase/);
  assert.match(migration, /get_public_business_showcase/);
  assert.match(migration, /c\.is_active and c\.configuration_status='confirmed'/);
  assert.match(migration, /insert into public.court_public_showcase/);
  assert.match(migration, /grant execute on function public.admin_update_court_sport_settings.*to authenticated/);
  assert.match(migration, /select \* into v_actor from public.phase6_admin_actor/);
  assert.doesNotMatch(migration, /insert into public\.pricing_rules|insert into public\.operating_hours/);
});

test("sitio y consulta conservan logotipo propio y no muestran el header de CAXAS", () => {
  assert.match(detailPage, /<BusinessSiteHeader businessName=\{business\.name\}/);
  assert.match(detailPage, /<BusinessSiteFooter businessName=\{business\.name\}/);
  assert.match(reservePage, /<BusinessSiteHeader businessName=\{selectedCourt\.businessName\}/);
  assert.match(reservePage, /<BusinessSiteFooter businessName=\{selectedCourt\.businessName\}/);
  assert.doesNotMatch(header + footer, /CaxasChromeBrand|PlatformHeader|platformConfig\.name/);
  assert.match(header, /business-site-header__logo/);
  assert.match(styles, /business-site-header/);
  assert.match(styles, /data-business-slug="polideportivo-san-sebastian"/);
  assert.match(styles, /\.platform-complex-hero__copy \{[\s\S]*?background: rgba\(3,28,14,\.86\)/);
});

test("la selección de fútbol y vóley comparte la agenda y cambia el mensaje de WhatsApp", () => {
  assert.match(reservePage, /courtSports: Record<string, \{ slug: string; name: string \}\[]>/);
  assert.match(reservePage, /initialSportSlug=\{selectedSport\?\.slug/);
  assert.match(calendar, /setSelectedSportSlug\(sport\.slug\)/);
  assert.match(calendar, /activeCourtSports\.some/);
  assert.match(calendar, /Ambos deportes comparten la disponibilidad del mismo campo físico/);
  assert.match(detailPage, /!court\.bookable \? "Horarios y tarifas por confirmar"/);
});

test("paleta del escudo verde bosque/lima mantiene contraste legible", () => {
  const theme = normalizeSiteTheme({
    ...SITE_THEME_PRESETS[0].theme,
    navy: "#082819", blue: "#266039", blueDark: "#174528",
    red: "#295C2F", redDark: "#194324", yellow: "#A1C92F", canvas: "#F3F8EC",
  });
  assert.equal(theme.navy, "#082819");
  assert.equal(isAccessibleSiteTheme(theme), true);
  for (const token of ["#082819", "#a1c92f", "#f5f8ee"]) {
    assert.match(styles.toLowerCase(), new RegExp(token.toLowerCase()));
  }
});

test("el administrador no permite sobrescribir deportes si la carga falla o cambia de campo", () => {
  assert.match(adminCourtSports, /setLoadedCourtId\(courtId\)/);
  assert.match(adminCourtSports, /loadFailed \|\| loadedCourtId !== courtId\) return/);
  assert.match(adminCourtSports, /Por seguridad no se pueden guardar cambios/);
  assert.match(adminCourtSports, /Reintentar carga/);
  assert.match(adminCourtSports, /disabled=\{isPrimary \|\| !canManage \|\| busy\}/);
  assert.match(adminCourtSports, /admin_update_court_sport_settings/);
});

test("el QA de producción espera calendario hidratado y prueba ambos mensajes de WhatsApp", () => {
  assert.match(browserQa, /waitFor\(/);
  assert.match(browserQa, /availability-sport-choice button/);
  assert.match(browserQa, /inspectSportSelection\("voley"\)/);
  assert.match(browserQa, /inspectSportSelection\("futbol"\)/);
  assert.match(browserQa, /whatsappVerified/);
});
