import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/20261111140500_caxas_studio_fix_publish_business_id.sql", "utf8");
const publishSql = readFileSync("supabase/migrations/20261111112500_caxas_studio_v2_drafts_revisions.sql", "utf8");
const route = readFileSync("app/api/admin-global/page-builder/[businessId]/route.ts", "utf8");

test("fix SQL resolves ambiguous RETURNS TABLE business_id while keeping the legacy RPC", () => {
  assert.match(sql, /pg_get_functiondef\(p\.oid\)/);
  assert.match(sql, /admin_update_site_content/);
  assert.match(sql, /on conflict on constraint business_site_content_pkey do update set/);
  assert.match(sql, /v_old text := 'on conflict \(business_id\) do update set'/);
  assert.match(sql, /execute replace\(v_definition, v_old, v_new\)/);
  assert.doesNotMatch(sql, /drop function|drop table|truncate|delete from/i);
});

test("publish calls validated existing tenant update within scoped RPC transaction", () => {
  assert.match(publishSql, /perform private\.platform_page_builder_assert_actor\(p_business_id\)/);
  assert.match(publishSql, /public\.admin_update_site_content\(/);
  assert.match(publishSql, /page_builder_live_changed/);
  assert.match(route, /platform_page_builder_publish_draft/);
  assert.match(route, /database RPC failed/);
  assert.match(route, /sqlstate: error.code/);
});
