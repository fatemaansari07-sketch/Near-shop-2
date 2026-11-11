-- NearShop follow-up: staff 'khata' permission + manager access to the combined dashboard.
-- Run AFTER 20261110_multishop_staff_plans_features.sql. Idempotent. Existing owner policies are untouched (additive policies only).

-- 1. allow the 'khata' permission
alter table public.shop_staff drop constraint if exists shop_staff_permissions_check;
alter table public.shop_staff add constraint shop_staff_permissions_check
  check (permissions <@ array['sell','inventory','reports','khata']::text[]);

-- 2. managers default to all four permissions
create or replace function public.owner_set_staff(p_shop_id uuid, p_username text, p_role text, p_permissions text[])
returns uuid language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_user uuid; v_id uuid; v_perms text[];
begin
  select owner_id into v_owner from public.shops where id = p_shop_id;
  if v_owner is null or v_owner <> public.current_nearshop_user_id() then raise exception 'NOT_OWNER'; end if;
  if public.nearshop_plan_rank(public.nearshop_owner_plan(v_owner)) < 2 then
    raise exception 'PLAN_REQUIRED: staff access needs Business Pro';
  end if;
  if p_role not in ('manager','employee') then raise exception 'Invalid role'; end if;
  select id into v_user from public.users where username = lower(trim(p_username));
  if v_user is null then raise exception 'USER_NOT_FOUND'; end if;
  if v_user = v_owner then raise exception 'Owner ko staff nahi bana sakte'; end if;
  v_perms := case when p_role = 'manager' and coalesce(array_length(p_permissions,1),0) = 0
                  then array['sell','inventory','reports','khata'] else coalesce(p_permissions, '{}') end;
  insert into public.shop_staff(shop_id, user_id, role, permissions, created_by)
  values (p_shop_id, v_user, p_role, v_perms, v_owner)
  on conflict (shop_id, user_id) do update set role = excluded.role, permissions = excluded.permissions, revoked_at = null
  returning id into v_id;
  return v_id;
end $$;

-- 3. Khata for staff with the 'khata' permission (read + add/update entries; delete stays owner-only)
drop policy if exists khata_entries_staff_read on public.khata_entries;
create policy khata_entries_staff_read on public.khata_entries for select to authenticated
using (public.nearshop_can(shop_id,'khata'));
drop policy if exists khata_entries_staff_insert on public.khata_entries;
create policy khata_entries_staff_insert on public.khata_entries for insert to authenticated
with check (public.nearshop_can(shop_id,'khata') and created_by = 'shop');
drop policy if exists khata_entries_staff_update on public.khata_entries;
create policy khata_entries_staff_update on public.khata_entries for update to authenticated
using (public.nearshop_can(shop_id,'khata')) with check (public.nearshop_can(shop_id,'khata'));
drop policy if exists khata_links_staff_read on public.khata_links;
create policy khata_links_staff_read on public.khata_links for select to authenticated
using (public.nearshop_can(shop_id,'khata'));

create or replace function public.get_shop_khata_profiles(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if not public.nearshop_can(p_shop_id,'khata') then return null; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id',u.id,'name',u.name,'username',u.username,'phone',u.phone))
    from public.users u
    where exists (select 1 from public.khata_links k where k.shop_id=p_shop_id and k.customer_id=u.id)
       or exists (select 1 from public.khata_entries e where e.shop_id=p_shop_id and e.customer_id=u.id)
  ), '[]'::jsonb);
end $$;

-- 4. Combined dashboard: owners (own shops) AND managers (shops where they are active manager with 'reports').
create or replace function public.owner_business_overview(p_from timestamptz default null, p_to timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := public.current_nearshop_user_id();
  v_rank integer; v_plan text;
  v_from timestamptz := coalesce(p_from, now() - interval '30 days');
  v_to timestamptz := coalesce(p_to, now());
  v_out jsonb;
  v_shop_ids uuid[];
  v_owned integer;
begin
  if v_uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  -- Shops in scope: ones I own + ones where I am an ACTIVE MANAGER with 'reports' permission (nearshop_can also re-checks owner is Business Pro).
  select coalesce(array_agg(s.id), '{}') into v_shop_ids from public.shops s
   where s.owner_id = v_uid
      or (exists (select 1 from public.shop_staff st where st.shop_id = s.id and st.user_id = v_uid and st.role = 'manager' and st.revoked_at is null)
          and public.nearshop_can(s.id, 'reports'));
  select count(*) into v_owned from public.shops where owner_id = v_uid;
  if v_owned > 0 then v_plan := public.nearshop_owner_plan(v_uid);
  elsif coalesce(array_length(v_shop_ids,1),0) > 0 then v_plan := 'business_pro';   -- pure manager: access exists only while the owner is Business Pro
  else v_plan := 'free'; end if;
  v_rank := public.nearshop_plan_rank(v_plan);
  if v_rank < 1 then raise exception 'PLAN_REQUIRED: combined dashboard needs Multi-Shop or Business Pro'; end if;

  v_out := jsonb_build_object('plan', v_plan, 'from', v_from, 'to', v_to);

  v_out := v_out || jsonb_build_object('shops', coalesce((
    select jsonb_agg(jsonb_build_object(
      'shop_id', s.id, 'name', s.name, 'area', s.area, 'category', s.category,
      'products', (select count(*) from public.products p where p.shop_id = s.id and p.archived_at is null),
      'low_stock', (select count(*) from public.products p where p.shop_id = s.id and p.archived_at is null and p.stock <= 3),
      'revenue', coalesce((select sum(l.revenue) from public.sales_log l where l.shop_id = s.id and l.created_at >= v_from and l.created_at <= v_to), 0),
      'bills', (select count(*) from public.bills b where b.shop_id = s.id and b.voided_at is null and b.created_at >= v_from and b.created_at <= v_to),
      'pending_udhar', coalesce((select sum(case k.kind when 'udhar' then k.amount when 'payment' then -k.amount else 0 end)
                                 from public.khata_entries k where k.shop_id = s.id and k.status <> 'disputed'), 0)
    ) order by s.name) from public.shops s where s.id = any(v_shop_ids)), '[]'::jsonb));

  v_out := v_out || jsonb_build_object('best_sellers', coalesce((
    select jsonb_agg(x) from (
      select l.product_name as name, sum(l.qty) as qty, sum(l.revenue) as revenue, count(distinct l.shop_id) as shops
      from public.sales_log l join public.shops s on s.id = l.shop_id
      where s.id = any(v_shop_ids) and l.created_at >= v_from and l.created_at <= v_to
      group by l.product_name order by sum(l.revenue) desc limit case when v_rank >= 2 then 15 else 5 end) x), '[]'::jsonb));

  if v_rank >= 2 then
    v_out := v_out || jsonb_build_object(
      'slow_moving', coalesce((select jsonb_agg(x) from (
        select p.name, s.name as shop, p.stock
        from public.products p join public.shops s on s.id = p.shop_id
        where s.id = any(v_shop_ids) and p.archived_at is null and p.stock > 0
          and not exists (select 1 from public.sales_log l where l.shop_id = p.shop_id and l.product_name = p.name
                          and l.created_at >= v_from and l.created_at <= v_to)
        order by p.stock desc limit 20) x), '[]'::jsonb),
      'stock_alerts', coalesce((select jsonb_agg(x) from (
        select p.name, s.name as shop, p.stock
        from public.products p join public.shops s on s.id = p.shop_id
        where s.id = any(v_shop_ids) and p.archived_at is null and p.stock <= 3
        order by p.stock asc limit 30) x), '[]'::jsonb),
      'daily', coalesce((select jsonb_agg(x) from (
        select (l.created_at at time zone 'Asia/Kolkata')::date as day, l.shop_id, sum(l.revenue) as revenue
        from public.sales_log l join public.shops s on s.id = l.shop_id
        where s.id = any(v_shop_ids) and l.created_at >= v_from and l.created_at <= v_to
        group by 1, 2 order by 1) x), '[]'::jsonb),
      -- Search demand: only areas/categories of the owner's own shops, grouped, with >=5 distinct searchers. No customer ids returned.
      'search_demand', coalesce((select jsonb_agg(x) from (
        select lower(trim(e.query)) as query, e.category, e.area, count(*)::integer as searches,
               count(distinct e.customer_id)::integer as searchers
        from public.search_events e
        where e.created_at >= v_from and e.created_at <= v_to and coalesce(trim(e.query),'') <> ''
          and e.customer_id is not null and e.customer_id <> ''
          and (e.area in (select s.area from public.shops s where s.id = any(v_shop_ids))
               or e.category in (select s.category from public.shops s where s.id = any(v_shop_ids)))
        group by 1, 2, 3 having count(distinct e.customer_id) >= 5
        order by count(*) desc limit 20) x), '[]'::jsonb));
  end if;
  return v_out;
end $$;
revoke all on function public.owner_business_overview(timestamptz,timestamptz) from public, anon;
grant execute on function public.owner_business_overview(timestamptz,timestamptz) to authenticated;
