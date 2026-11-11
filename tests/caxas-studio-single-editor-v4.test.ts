import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const configuration = readFileSync("app/admin/(protected)/configuracion/page.tsx", "utf8");
const studio = readFileSync("components/platform-admin/PageBuilderStudio.tsx", "utf8");
const globalTeam = readFileSync("components/platform-admin/GlobalBusinessTeamPanel.tsx", "utf8");

test("la configuración remota de owner/admin deriva al estudio con borradores, no al editor de publicación directa", () => {
  assert.match(configuration, /!localMode\s*&&\s*\(context\.role\s*===\s*"owner"\s*\|\|\s*context\.role\s*===\s*"admin"\)/);
  assert.match(configuration, /Abrir estudio de diseño/);
  assert.match(configuration, /Edición segura · sin publicaciones accidentales/);
  assert.match(configuration, /: \(\s*<AdminSiteContentEditor\b/);
  assert.match(configuration, /contentLoadFailed\s*\?/);
});

test("el estudio compara temas normalizados para no provocar cambios fantasma en diseños anteriores", () => {
  assert.match(studio, /setTheme\]\s*=\s*useState\(\(\) => normalizeSiteTheme\(initialWork\.theme\)\)/);
  assert.match(studio, /isDirty\s*=\s*JSON\.stringify\(\{\s*logoUrl,\s*services,\s*gallery,\s*theme:\s*normalizeSiteTheme\(theme\)/);
  assert.match(studio, /setTheme\(normalizeSiteTheme\(content\.theme\)\)/);
});

test("el estudio protege cambios sin guardar ante descarga de página y navegación interna", () => {
  assert.match(studio, /window\.addEventListener\("beforeunload",\s*warnBeforeUnload\)/);
  assert.match(studio, /document\.addEventListener\("click",\s*warnOnLink,\s*true\)/);
  assert.match(studio, /window\.confirm\("Tienes cambios sin guardar/);
  assert.match(studio, /window\.removeEventListener\("beforeunload",\s*warnBeforeUnload\)/);
  assert.match(studio, /document\.removeEventListener\("click",\s*warnOnLink,\s*true\)/);
});

test("equipo global diferencia errores de carga de una lista de miembros vacía", () => {
  assert.match(globalTeam, /const \[loadError,setLoadError\]/);
  assert.match(globalTeam, /setLoadError\(readableError\(/);
  assert.match(globalTeam, /loadError\s*\?\s*\(/);
  assert.match(globalTeam, /Reintentar consulta/);
  assert.match(globalTeam, /ctx\.clone\(\)\.json\(\)/);
});
