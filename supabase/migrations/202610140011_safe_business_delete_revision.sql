-- Valeibol · permitir cascada segura al eliminar un negocio
create or replace function public.touch_availability_revision()
returns trigger
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_business_id uuid;
begin
  v_business_id := case when tg_op = 'DELETE' then old.business_id else new.business_id end;

  -- Durante ON DELETE CASCADE del negocio, la fila padre puede haber dejado de
  -- existir antes de que corran los triggers de sus entradas de agenda.
  if not exists (
    select 1 from public.businesses b where b.id = v_business_id
  ) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  insert into public.availability_revisions (business_id, revision, updated_at)
  values (v_business_id, 1, now())
  on conflict (business_id) do update
    set revision = public.availability_revisions.revision + 1,
        updated_at = now();

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.touch_availability_revision() from public, anon, authenticated;
