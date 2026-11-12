-- Campo 2 shares operating hours and prices with Campo 1 by owner instruction.
-- Each physical court keeps its own court_id, calendar and reservation history.
-- This is a bounded one-time data correction, NOT a permanent coupling of rates.
do $migration$
declare
  v_business constant uuid := '73426eb7-4a4f-405b-b0bd-be06cd53aa3f';
  v_source constant uuid := 'd86214c0-03bb-4104-a848-af70e34cbab7';
  v_target constant uuid := 'b8b5bffe-189d-4490-8671-0591a642be36';
  v_source_venue uuid;
  v_target_venue uuid;
  v_target_active boolean;
  v_today date;
  v_hours_count int;
  v_prices_count int;
begin
  select (now() at time zone b.timezone)::date into v_today
  from public.businesses b
  where b.id = v_business and b.slug = 'polideportivo-san-sebastian'
    and b.is_active and b.configuration_status = 'confirmed';
  if v_today is null then raise exception 'san_sebastian_business_not_ready'; end if;

  select c.venue_id into v_source_venue from public.courts c
  where c.id=v_source and c.business_id=v_business and c.name='Campo 1'
    and c.is_active and c.configuration_status='confirmed';
  select c.venue_id, c.is_active into v_target_venue, v_target_active
  from public.courts c where c.id=v_target and c.business_id=v_business and c.name='Campo 2'
  for update;
  if v_source_venue is null or v_target_venue is null or v_target_venue <> v_source_venue
     or not exists (select 1 from public.venues v where v.id=v_target_venue and v.is_active) then
    raise exception 'san_sebastian_court_identity_mismatch';
  end if;

  select count(*) into v_hours_count from public.operating_hours where court_id=v_target;
  select count(*) into v_prices_count from public.pricing_rules where court_id=v_target;
  if v_target_active and v_hours_count=7 and v_prices_count=2 then
    raise notice 'Campo 2 already configured; no operation required';
    return;
  end if;
  if v_target_active or v_hours_count<>0 or v_prices_count<>0 then
    raise exception 'campo2_has_preexisting_configuration_no_overwrite';
  end if;
  if exists (select 1 from public.reservations where court_id=v_target)
    or exists (select 1 from public.schedule_blocks where court_id=v_target) then
    raise exception 'campo2_has_history_no_overwrite';
  end if;

  if (select count(*) from public.operating_hours oh
      where oh.court_id=v_source and oh.configuration_status='confirmed'
      and oh.effective_from<=v_today and (oh.effective_until is null or oh.effective_until>=v_today)) <> 7
    or (select count(*) from public.pricing_rules pr
      where pr.court_id=v_source and pr.configuration_status='confirmed' and pr.is_active
      and pr.effective_from<=v_today and (pr.effective_until is null or pr.effective_until>=v_today)) <> 2 then
    raise exception 'campo1_rules_changed_review_before_copy';
  end if;

  insert into public.operating_hours (
    court_id, weekday, is_open, opens_at, closes_at,
    effective_from, effective_until, configuration_status
  )
  select v_target, weekday, is_open, opens_at, closes_at,
    effective_from, effective_until, configuration_status
  from public.operating_hours where court_id=v_source;

  insert into public.pricing_rules (
    court_id, lighting, label, hourly_rate,
    effective_from, effective_until, is_active, configuration_status
  )
  select v_target, lighting, label, hourly_rate,
    effective_from, effective_until, is_active, configuration_status
  from public.pricing_rules where court_id=v_source;

  if (select count(distinct oh.weekday) from public.operating_hours oh
      where oh.court_id=v_target and oh.configuration_status='confirmed'
      and oh.effective_from<=v_today and (oh.effective_until is null or oh.effective_until>=v_today)) <> 7
    or (select count(distinct pr.lighting) from public.pricing_rules pr
      where pr.court_id=v_target and pr.configuration_status='confirmed' and pr.is_active
      and pr.effective_from<=v_today and (pr.effective_until is null or pr.effective_until>=v_today)) <> 2 then
    raise exception 'campo2_operational_readiness_check_failed';
  end if;

  update public.courts
  set is_active=true, configuration_status='confirmed', updated_at=now()
  where id=v_target and business_id=v_business and not is_active;

  if not found then raise exception 'campo2_activation_failed'; end if;
end
$migration$;
