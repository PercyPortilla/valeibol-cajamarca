import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeSiteTheme, SITE_THEME_PRESETS } from "../lib/siteContent.ts";

const read=(name:string)=>readFileSync(name,"utf8");
const pricing=read("app/admin/(protected)/precios/page.tsx");
const form=read("components/admin/AdminPricingForm.tsx");
const structure=read("components/admin/AdminBusinessStructureManager.tsx");
const tenantStudio=read("app/admin/(protected)/disenar/page.tsx");
const studio=read("components/platform-admin/PageBuilderStudio.tsx");
const globalList=read("components/platform-admin/PlatformAdminBusinessList.tsx");
const globalTeam=read("components/platform-admin/GlobalBusinessTeamPanel.tsx");
const teamSQL=read("supabase/migrations/20261111152000_platform_team_invites.sql");
const teamEdge=read("supabase/functions/platform-business-access/index.ts");
const ownerSQL=read("supabase/migrations/20261111151000_page_builder_tenant_owner_access.sql");
const tenantPage=read("app/complejo/[slug]/page.tsx");
const tenantStyles=read("app/styles/caxas-children-premium-2026.css");
const studioRoute=read("app/api/admin-global/page-builder/[businessId]/route.ts");

test("precios vacíos explican pasos y no ocultan creación de sede o tarifas iniciales",()=>{
  assert.match(pricing, /No existen tarifas|Establece la primera tarifa|Primero crea una cancha/);
  assert.match(pricing, /getAdminBusinessStructure\(/);
  assert.match(pricing, /Crear sede y cancha/);
  assert.match(pricing, /configuracion\/estructura#venues-title/);
  assert.match(pricing, /AdminPricingForm rules=\{rules\} courts=\{courts\}/);
  assert.match(form, /knownCourts/);
  assert.match(form, /businessToday/);
  assert.match(structure, /admin_create_court/);
  assert.match(structure, /p_rate_without_lights/);
  assert.match(structure, /p_rate_with_lights/);
  assert.match(structure, /admin_set_business_configuration_status/);
});

test("propietarios y gerentes tienen estudio visual, staff sin publicación de diseño",()=>{
  assert.match(tenantStudio, /requireAdminContext/);
  assert.match(tenantStudio, /context\.role === "staff"/);
  assert.match(tenantStudio, /platform_page_builder_get_state/);
  assert.match(tenantStudio, /mode="tenant"/);
  assert.match(studio, /mode === "global"/);
  assert.match(ownerSQL, /p\.role in \('owner', 'admin'\)/);
  assert.match(ownerSQL, /not v_is_global and exists/);
  assert.match(ownerSQL, /v_is_global and private\.platform_admin_selected_business_id/);
  assert.match(ownerSQL, /auth\.uid\(\) is null/);
  assert.match(studioRoute, /revalidatePath\("\/complejo\/\[slug\]", "page"\)/);
  assert.doesNotMatch(studioRoute,/findPageBuilderBusiness/);
});

test("invitaciones globales usan autenticación real y privilegios solo de servicio",()=>{
  assert.match(globalList, /GlobalBusinessTeamPanel/);
  assert.match(globalList, /Equipo y accesos/);
  assert.match(globalTeam, /Enviar invitación/);
  assert.match(globalTeam, /isPrimaryOwner/);
  assert.match(globalTeam, /platform-business-access/);
  assert.match(teamEdge, /auth\.getUser\(bearer\)/);
  assert.match(teamEdge, /account\.role !== "admin"/);
  assert.match(teamEdge, /inviteUserByEmail/);
  assert.match(teamEdge, /platform_admin_team_assert/);
  assert.match(teamEdge, /platform_admin_team_attach/);
  assert.match(teamEdge, /platform_admin_team_update/);
  assert.match(teamSQL, /a\.role = 'admin' and a\.is_active/);
  assert.match(teamSQL, /b\.id = p_business_id and b\.is_active/);
  assert.match(teamSQL, /v_current\.user_id = v_primary/);
  assert.match(teamSQL, /primary_owner_transfer_required/);
  assert.match(teamSQL, /user_assigned_elsewhere/);
  assert.match(teamSQL, /grant execute on function public\.platform_admin_team_attach[\s\S]*to service_role/);
  assert.doesNotMatch(teamSQL, /grant execute.*to authenticated/i);
  assert.doesNotMatch(teamEdge, /password:|setPassword|signInWithPassword/);
});

test("cinco estilos premium alteran ficha pública y no la marca madre",()=>{
  const base=SITE_THEME_PRESETS[0].theme;
  for (const style of ["signature","noir","editorial","stadium","glass"] as const) {
    assert.equal(normalizeSiteTheme({...base,visualStyle:style}).visualStyle, style);
    if(style !== "signature") assert.match(tenantStyles, new RegExp('data-tenant-style="'+style+'"'));
  }
  assert.equal(normalizeSiteTheme({...base,visualStyle:"malicious"}).visualStyle,"signature");
  assert.match(tenantPage,/data-tenant-style=\{siteContent\.theme\.visualStyle/);
  assert.match(studio,/studio-visual-styles/);
  assert.match(studio,/studio-preview--\$\{theme\.visualStyle/);
  assert.match(tenantStyles,/--tenant-accent: var\(--brand-blue/);
  assert.doesNotMatch(tenantStyles,/\.platform-public-premium--owner\[data-tenant-style/);
});
