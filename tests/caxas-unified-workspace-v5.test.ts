import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const read = (file: string) => readFileSync(file, "utf8");
const globalList = read("components/platform-admin/PlatformAdminBusinessList.tsx");
const onboard = read("components/platform-admin/PlatformAdminBusinessOnboarding.tsx");
const selection = read("app/api/admin-global/select-business/route.ts");
const center = read("app/admin/(protected)/centro/page.tsx");
const workspace = read("components/admin/CaxasBusinessWorkspace.tsx");
const core = read("components/admin/CaxasGlobalBusinessCore.tsx");
const dashboard = read("app/admin/(protected)/page.tsx");
const navigation = read("components/admin/AdminNavigation.tsx");
const css = read("app/styles/caxas-admin-clarity-2026.css");
const workspaceCss = read("app/admin/(protected)/centro/workspace.css");

test("la administración global abre un Centro de gestión en un solo paso con POST validado", () => {
  assert.match(globalList, /name="destination" value="workspace"/);
  assert.match(globalList, /Centro completo · configurar y diseñar/);
  assert.match(onboard, /name="destination" value="workspace"/);
  assert.match(selection, /await requirePlatformAdminContext\(\)/);
  assert.match(selection, /explicitPlatformBusinessId: businessId/);
  assert.match(selection, /get_current_admin_context/);
  assert.match(selection, /body\.get\("destination"\) === "workspace" \? "\/admin\/centro" : "\/admin"/);
  assert.match(selection, /Location: destination/);
  assert.doesNotMatch(selection, /new URL\(.*destination/);
});

test("Centro exige tenant de sesión y reutiliza la misma lógica operativa del panel", () => {
  assert.match(center, /requireAdminContext\(\)/);
  assert.match(center, /structure\.businessId !== context\.businessId/);
  assert.match(center, /getAdminBusinessStructure\(\)/);
  assert.match(center, /listPricingRules\(\)/);
  assert.match(center, /platform_page_builder_get_state/);
  assert.match(workspace, /AdminBusinessStructureManager/);
  assert.match(workspace, /AdminPricingForm/);
  assert.match(workspace, /PageBuilderStudio/);
  assert.match(workspace, /GlobalBusinessTeamPanel/);
  assert.match(workspace, /AdminAccessManagement/);
  assert.match(workspace, /href="\/admin\/disponibilidad"/);
  assert.match(workspace, /href="\/admin\/reservas"/);
  assert.match(workspace, /href="\/admin\/clientes"/);
  assert.match(workspace, /href="\/admin\/reportes"/);
  assert.doesNotMatch(center, /service_role|createAdminClient/);
});

test("se conservan los límites de permisos y la publicación separada del diseño", () => {
  assert.match(center, /context\.role === "staff"\) redirect\("\/admin"\)/);
  assert.match(navigation, /role !== "staff" \? \[\{ label: "Centro de gestión"/);
  assert.match(workspace, /context\.isPlatformAdmin \? <GlobalBusinessTeamPanel/);
  assert.match(workspace, /context\.role === "owner" \? <AdminAccessManagement/);
  assert.match(core, /platform_admin_update_business_core/);
  assert.match(core, /structure\.configurationStatus === "provisional"/);
  assert.match(workspace, /AdminBusinessStructureManager structure=\{structure\}/);
  assert.match(workspace, /Los cambios se versionan/);
  assert.match(navigation, /if \(role !== "staff"\)/);
});

test("el panel incluye ruta intuitiva y contraste robusto sin copiar identidad de Valeibol", () => {
  assert.match(dashboard, /¿Qué necesitas hacer hoy\?/);
  assert.match(dashboard, /href="\/admin\/centro"/);
  assert.match(navigation, /CENTRO DE GESTIÓN|Centro de gestión/);
  assert.match(css, /--admin-clarity-line: #b5bfcd/);
  assert.match(css, /\.admin-shell \.button--secondary/);
  assert.match(css, /\.admin-shell \.field__control/);
  assert.match(workspaceCss, /\.caxas-workspace__tabs/);
  assert.match(workspaceCss, /\.caxas-workspace \[hidden\]/);
  assert.match(workspaceCss, /@media\(max-width:690px\)/);
});
