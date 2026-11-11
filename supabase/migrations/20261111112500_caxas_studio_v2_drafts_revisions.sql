-- CAXAS STUDIO V2. Migration is additive; no change to tenant operational roles.
-- Drafts and immutable published snapshots reside in private schema, never in Data API.

create table if not exists private.platform_page_builder_drafts (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  content jsonb not null,
  version bigint not null default 1 check (version > 0),
  based_on_updated_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  constraint platform_page_builder_draft_object check (jsonb_typeof(content) = 'object')
);
alter table private.platform_page_builder_drafts enable row level security;
revoke all on private.platform_page_builder_drafts from public, anon, authenticated;

create table if not exists private.platform_page_builder_revisions (
  revision_id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  snapshot jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users(id),
  constraint platform_page_builder_revision_object check (jsonb_typeof(snapshot) = 'object')
);
create index if not exists platform_page_builder_revisions_business_recent
  on private.platform_page_builder_revisions (business_id, revision_id desc);
alter table private.platform_page_builder_revisions enable row level security;
revoke all on private.platform_page_builder_revisions from public, anon, authenticated;

-- Exact-business scope comes from server validated request header; a global admin
-- cannot call the RPC for an unrelated businessId from the client.
create or replace function private.platform_page_builder_assert_actor(p_business_id uuid)
returns void language plpgsql stable security definer set search_path = public, private, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_platform_admin()
    or private.platform_admin_selected_business_id() is distinct from p_business_id
    or not exists (select 1 from public.businesses b where b.id = p_business_id)
  then
    raise exception 'page_builder_access_denied' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.platform_page_builder_assert_actor(uuid) from public, anon, authenticated;

create or replace function public.platform_page_builder_get_state(p_business_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, private, pg_temp
as $$
declare
  v_draft private.platform_page_builder_drafts%rowtype;
  v_published_at timestamptz;
  v_published public.business_site_content%rowtype;
  v_revisions jsonb;
begin
  perform private.platform_page_builder_assert_actor(p_business_id);

  select * into v_draft from private.platform_page_builder_drafts where business_id = p_business_id;
  select * into v_published from public.business_site_content where business_id = p_business_id;
  v_published_at := v_published.updated_at;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.revision_id::text,
    'publishedAt', r.published_at,
    'publishedBy', r.published_by
  ) order by r.revision_id desc), '[]'::jsonb)
  into v_revisions
  from (
    select revision_id, published_at, published_by
    from private.platform_page_builder_revisions
    where business_id = p_business_id
    order by revision_id desc limit 20
  ) r;
  return jsonb_build_object(
    'draft', case when v_draft.business_id is null then null else v_draft.content end,
    'draftVersion', coalesce(v_draft.version, 0),
    'draftUpdatedAt', v_draft.updated_at,
    'basedOnUpdatedAt', v_draft.based_on_updated_at,
    'draftPublished', v_draft.business_id is not null
      and v_published.business_id is not null
      and v_draft.content = jsonb_build_object(
        'logoUrl', coalesce(v_published.logo_url, ''),
        'services', v_published.services,
        'gallery', v_published.gallery,
        'theme', v_published.theme
      ),
    'published', case when v_published.business_id is null then null else jsonb_build_object(
      'logoUrl', coalesce(v_published.logo_url, ''),
      'services', v_published.services,
      'gallery', v_published.gallery,
      'theme', v_published.theme
    ) end,
    'publishedAt', v_published_at,
    'revisions', v_revisions
  );
end;
$$;

create or replace function public.platform_page_builder_save_draft(
  p_business_id uuid, p_content jsonb, p_expected_version bigint, p_expected_published_at timestamptz
)
returns jsonb language plpgsql volatile security definer set search_path = public, private, pg_temp
as $$
declare
  v_draft private.platform_page_builder_drafts%rowtype;
  v_live_at timestamptz;
  v_result private.platform_page_builder_drafts%rowtype;
begin
  perform private.platform_page_builder_assert_actor(p_business_id);
  if p_content is null or jsonb_typeof(p_content) <> 'object'
    or pg_column_size(p_content) > 80000
    or jsonb_typeof(p_content->'services') <> 'array'
    or jsonb_array_length(p_content->'services') > 24
    or jsonb_typeof(p_content->'gallery') <> 'array'
    or jsonb_array_length(p_content->'gallery') > 16
    or jsonb_typeof(p_content->'theme') <> 'object'
    or jsonb_typeof(p_content->'logoUrl') <> 'string'
  then
    raise exception 'page_builder_invalid_content' using errcode = '22023';
  end if;

  perform 1 from public.businesses where id = p_business_id for update;
  select * into v_draft from private.platform_page_builder_drafts
    where business_id = p_business_id for update;
  if found then
    if v_draft.version is distinct from p_expected_version then
      raise exception 'page_builder_draft_changed' using errcode = '40001';
    end if;
    update private.platform_page_builder_drafts
    set content = p_content, version = version + 1, updated_at = clock_timestamp(), updated_by = auth.uid()
    where business_id = p_business_id returning * into v_result;
  else
    if p_expected_version is distinct from 0 then
      raise exception 'page_builder_draft_changed' using errcode = '40001';
    end if;
    select updated_at into v_live_at from public.business_site_content where business_id = p_business_id;
    if v_live_at is distinct from p_expected_published_at then
      raise exception 'page_builder_live_changed' using errcode = '40001';
    end if;
    insert into private.platform_page_builder_drafts
      (business_id, content, based_on_updated_at, updated_by)
    values (p_business_id, p_content, v_live_at, auth.uid())
    returning * into v_result;
  end if;
  return jsonb_build_object(
    'draftVersion', v_result.version,
    'draftUpdatedAt', v_result.updated_at,
    'basedOnUpdatedAt', v_result.based_on_updated_at
  );
end;
$$;

create or replace function public.platform_page_builder_publish_draft(
  p_business_id uuid, p_expected_version bigint
)
returns jsonb language plpgsql volatile security definer set search_path = public, private, pg_temp
as $$
declare
  v_draft private.platform_page_builder_drafts%rowtype;
  v_before public.business_site_content%rowtype;
  v_live_at timestamptz;
  v_updated_at timestamptz;
  v_revision bigint;
  v_version bigint;
begin
  perform private.platform_page_builder_assert_actor(p_business_id);
  perform 1 from public.businesses where id = p_business_id for update;
  select * into v_draft from private.platform_page_builder_drafts
    where business_id = p_business_id for update;
  if not found or v_draft.version is distinct from p_expected_version then
    raise exception 'page_builder_draft_changed' using errcode = '40001';
  end if;
  select * into v_before from public.business_site_content
    where business_id = p_business_id for update;
  v_live_at := v_before.updated_at;
  if v_live_at is distinct from v_draft.based_on_updated_at then
    raise exception 'page_builder_live_changed' using errcode = '40001';
  end if;
  -- Keep the legacy live design as a recoverable baseline the first time.
  if v_before.business_id is not null and not exists (
    select 1 from private.platform_page_builder_revisions where business_id = p_business_id
  ) then
    insert into private.platform_page_builder_revisions
      (business_id, snapshot, published_at, published_by)
    values (p_business_id, jsonb_build_object(
      'logoUrl', coalesce(v_before.logo_url, ''),
      'services', v_before.services, 'gallery', v_before.gallery, 'theme', v_before.theme
    ), v_before.updated_at, v_before.updated_by);
  end if;

  -- Reuse existing validated tenant RPC; it checks the actor role, payload and RLS scope.
  select updated_at into v_updated_at from public.admin_update_site_content(
    p_logo_url => nullif(v_draft.content->>'logoUrl', ''),
    p_services => v_draft.content->'services',
    p_gallery => v_draft.content->'gallery',
    p_theme => v_draft.content->'theme'
  );
  if v_updated_at is null then
    raise exception 'page_builder_publish_failed' using errcode = '22023';
  end if;
  insert into private.platform_page_builder_revisions (business_id, snapshot, published_by)
  values (p_business_id, v_draft.content, auth.uid())
  returning revision_id into v_revision;
  update private.platform_page_builder_drafts
    set based_on_updated_at = v_updated_at, version = version + 1,
        updated_at = clock_timestamp(), updated_by = auth.uid()
    where business_id = p_business_id returning version into v_version;
  -- Bound history per tenant without touching the latest snapshot.
  delete from private.platform_page_builder_revisions
  where business_id = p_business_id and revision_id not in (
    select revision_id from private.platform_page_builder_revisions
    where business_id = p_business_id order by revision_id desc limit 20
  );
  return jsonb_build_object('publishedAt', v_updated_at, 'revisionId', v_revision::text, 'draftVersion', v_version);
end;
$$;

create or replace function public.platform_page_builder_restore_revision(
  p_business_id uuid, p_revision_id bigint, p_expected_version bigint
)
returns jsonb language plpgsql volatile security definer set search_path = public, private, pg_temp
as $$
declare
  v_snapshot jsonb;
  v_draft private.platform_page_builder_drafts%rowtype;
  v_live_at timestamptz;
  v_version bigint;
begin
  perform private.platform_page_builder_assert_actor(p_business_id);
  perform 1 from public.businesses where id = p_business_id for update;
  select snapshot into v_snapshot from private.platform_page_builder_revisions
    where business_id = p_business_id and revision_id = p_revision_id;
  if v_snapshot is null then
    raise exception 'page_builder_revision_not_found' using errcode = '22023';
  end if;
  select * into v_draft from private.platform_page_builder_drafts
    where business_id = p_business_id for update;
  if coalesce(v_draft.version, 0) is distinct from p_expected_version then
    raise exception 'page_builder_draft_changed' using errcode = '40001';
  end if;
  -- Restore into a draft ONLY; do not publish without an explicit second action.
  select updated_at into v_live_at from public.business_site_content where business_id = p_business_id;
  insert into private.platform_page_builder_drafts
    (business_id, content, version, based_on_updated_at, updated_by)
  values (p_business_id, v_snapshot, 1, v_live_at, auth.uid())
  on conflict (business_id) do update
    set content = excluded.content, version = platform_page_builder_drafts.version + 1,
        based_on_updated_at = excluded.based_on_updated_at,
        updated_at = clock_timestamp(), updated_by = excluded.updated_by
  returning version into v_version;
  return jsonb_build_object('draft', v_snapshot, 'draftVersion', v_version, 'basedOnUpdatedAt', v_live_at);
end;
$$;

create or replace function public.platform_page_builder_discard_draft(
  p_business_id uuid, p_expected_version bigint
)
returns boolean language plpgsql volatile security definer set search_path = public, private, pg_temp
as $$
declare
  v_version bigint;
begin
  perform private.platform_page_builder_assert_actor(p_business_id);
  perform 1 from public.businesses where id = p_business_id for update;
  select version into v_version from private.platform_page_builder_drafts
    where business_id = p_business_id for update;
  if v_version is distinct from p_expected_version then
    raise exception 'page_builder_draft_changed' using errcode = '40001';
  end if;
  delete from private.platform_page_builder_drafts where business_id = p_business_id;
  return true;
end;
$$;

revoke all on function public.platform_page_builder_get_state(uuid) from public, anon, authenticated;
revoke all on function public.platform_page_builder_save_draft(uuid,jsonb,bigint,timestamptz) from public, anon, authenticated;
revoke all on function public.platform_page_builder_publish_draft(uuid,bigint) from public, anon, authenticated;
revoke all on function public.platform_page_builder_restore_revision(uuid,bigint,bigint) from public, anon, authenticated;
revoke all on function public.platform_page_builder_discard_draft(uuid,bigint) from public, anon, authenticated;
grant execute on function public.platform_page_builder_get_state(uuid) to authenticated;
grant execute on function public.platform_page_builder_save_draft(uuid,jsonb,bigint,timestamptz) to authenticated;
grant execute on function public.platform_page_builder_publish_draft(uuid,bigint) to authenticated;
grant execute on function public.platform_page_builder_restore_revision(uuid,bigint,bigint) to authenticated;
grant execute on function public.platform_page_builder_discard_draft(uuid,bigint) to authenticated;
