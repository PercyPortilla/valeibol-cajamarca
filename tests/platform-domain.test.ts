import assert from "node:assert/strict";
import test from "node:test";
import { sports } from "../config/sports.ts";
import {
  demoBusiness,
  demoCourt,
  demoOwner,
  demoPlatformData,
  demoVenue,
} from "../lib/data/demoPlatform.ts";
import { USER_ROLES } from "../lib/domain/models.ts";
import { complexRoute, platformRoutes } from "../lib/platform/routes.ts";

test("los roles globales base quedan definidos sin alterar los roles admin heredados", () => {
  assert.deepEqual(USER_ROLES, ["CUSTOMER", "OWNER", "ADMIN"]);
  assert.equal(demoOwner.role, "OWNER");
});

test("la configuración central contiene los cuatro deportes iniciales con slugs únicos", () => {
  assert.deepEqual(sports.map((sport) => sport.slug), ["voley", "futbol", "futsal", "basquet"]);
  assert.equal(new Set(sports.map((sport) => sport.slug)).size, sports.length);
  assert.ok(sports.every((sport) => sport.active));
});

test("Valeibol queda representado como primer negocio, sede y cancha relacionados por IDs", () => {
  assert.equal(demoBusiness.ownerId, demoOwner.id);
  assert.equal(demoVenue.businessId, demoBusiness.id);
  assert.equal(demoCourt.venueId, demoVenue.id);
  assert.ok(sports.some((sport) => sport.id === demoCourt.sportId && sport.slug === "voley"));
  assert.equal(demoPlatformData.businesses[0]?.slug, "valeibol-cajamarca");
});

test("los slugs demo son seguros para rutas", () => {
  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  assert.match(demoBusiness.slug, slugPattern);
  assert.match(demoVenue.slug, slugPattern);
  assert.match(demoCourt.slug, slugPattern);
});

test("el catálogo de rutas deja preparada la expansión sin publicar páginas incompletas", () => {
  assert.equal(platformRoutes.search, "/buscar");
  assert.equal(platformRoutes.volleyball, "/voley");
  assert.equal(platformRoutes.football, "/futbol");
  assert.equal(platformRoutes.complexPattern, "/complejo/[slug]");
  assert.equal(platformRoutes.reservation, "/reservar");
  assert.equal(platformRoutes.account, "/mi-cuenta");
  assert.equal(platformRoutes.owner, "/propietario");
  assert.equal(platformRoutes.admin, "/admin");
  assert.equal(complexRoute("arena norte"), "/complejo/arena%20norte");
});
