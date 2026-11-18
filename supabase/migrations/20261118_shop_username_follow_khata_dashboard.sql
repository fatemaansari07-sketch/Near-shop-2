-- NearShop shop usernames + per-shop combined dashboard Khata.
-- Safe to re-run. Run after 20261113_feed_follow_like_comment.sql.

-- 1) Every shop gets a stable, unique public handle.
alter table public.shops add column if not exists username text;

create or replace function public.nearshop_assign_shop_username()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_suffix text;
begin
  if nullif(trim(new.username), '') is not null then
    new.username := lower(regexp_replace(trim(new.username), '^@', ''));
    return new;
  end if;

  v_base := lower(coalesce(new.name, 'shop'));
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '_', 'g');
  v_base := trim(both '_' from v_base);
  v_base := coalesce(nullif(v_base, ''), 'shop');
  if length(v_base) < 2 then v_base := 'shop'; end if;

  v_suffix := substr(replace(new.id::text, '-', ''), 1, 6);
  new.username := left(v_base, 20 - length(v_suffix) - 1) || '_' || v_suffix;
  return new;
end;
$$;

drop trigger if exists shops_assign_username on public.shops;
create trigger shops_assign_username
before insert or update of username on public.shops
for each row execute function public.nearshop_assign_shop_username();

-- Backfill old shops. UUID suffix guarantees that same-name shops remain unique.
update public.shops
set username =
  coalesce(
    nullif(left(trim(both '_' from regexp_replace(
      lower(coalesce(name, 'shop')), '[^a-z0-9]+', '_', 'g'
    )), 13), ''),
    'shop'
  ) || '_' || substr(replace(id::text, '-', ''), 1, 6)
where username is null or trim(username) = '';

create unique index if not exists shops_username_lower_unique
  on public.shops (lower(username))
  where username is not null;

alter table public.shops drop constraint if exists shops_username_format;
alter table public.shops add constraint shops_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,20}$');

-- 2) Return a correct, independent pending balance for EACH shop.
-- Mirrors khataApi.balanceOf():
-- confirmed entries count; shop-created customer udhar counts while pending;
-- disputed entries and other pending entries do not count.
create or replace function public.owner_business_overview(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.current_nearshop_user_id();
  v_rank integer;
  v_plan text;
  v_from timestamptz := coalesce(p_from, now() - interval '30 days');
  v_to timestamptz := coalesce(p_to, now());
  v_out jsonb;
  v_shop_ids uuid[];
  v_owned integer;
begin
  if v_uid is null then raise exception 'NOT_SIGNED_IN'; end if;

  select coalesce(array_agg(s.id), '{}') into v_shop_ids
  from public.shops s
  where s.owner_id = v_uid
     or (
       exists (
         select 1 from public.shop_staff st
         where st.shop_id = s.id and st.user_id = v_uid
           and st.role = 'manager' and st.revoked_at is null
       )
       and public.nearshop_can(s.id, 'reports')
     );

  select count(*) into v_owned from public.shops where owner_id = v_uid;
  if v_owned > 0 then
    v_plan := public.nearshop_owner_plan(v_uid);
  elsif coalesce(array_length(v_shop_ids,1),0) > 0 then
    v_plan := 'business_pro';
  else
    v_plan := 'free';
  end if;

  v_rank := public.nearshop_plan_rank(v_plan);
  if v_rank < 1 then
    raise exception 'PLAN_REQUIRED: combined dashboard needs Multi-Shop or Business Pro';
  end if;

  v_out := jsonb_build_object('plan', v_plan, 'from', v_from, 'to', v_to);

  v_out := v_out || jsonb_build_object('shops', coalesce((
    select jsonb_agg(jsonb_build_object(
      'shop_id', s.id,
      'name', s.name,
      'area', s.area,
      'category', s.category,
      'products', (select count(*) from public.products p where p.shop_id = s.id and p.archived_at is null),
      'low_stock', (select count(*) from public.products p where p.shop_id = s.id and p.archived_at is null and p.stock <= 3),
      'revenue', coalesce((select sum(l.revenue) from public.sales_log l where l.shop_id = s.id and l.created_at >= v_from and l.created_at <= v_to), 0),
      'bills', (select count(*) from public.bills b where b.shop_id = s.id and b.voided_at is null and b.created_at >= v_from and b.created_at <= v_to),
      'pending_udhar', coalesce((
        select sum(
          case
            when k.kind = 'udhar' and k.party = 'customer' then k.amount
            when k.kind = 'udhar' and k.party = 'shop' then -k.amount
            when k.kind = 'payment' and k.party = 'customer' then -k.amount
            when k.kind = 'payment' and k.party = 'shop' then k.amount
            else 0
          end
        )
        from public.khata_entries k
        where k.shop_id = s.id
          and (
            k.status = 'confirmed'
            or (
              k.status = 'pending'
              and k.kind = 'udhar'
              and k.created_by = 'shop'
              and k.party = 'customer'
            )
          )
      ), 0)
    ) order by s.name)
    from public.shops s where s.id = any(v_shop_ids)
  ), '[]'::jsonb));

  v_out := v_out || jsonb_build_object('best_sellers', coalesce((
    select jsonb_agg(x) from (
      select l.product_name as name, sum(l.qty) as qty,
             sum(l.revenue) as revenue, count(distinct l.shop_id) as shops
      from public.sales_log l
      join public.shops s on s.id = l.shop_id
      where s.id = any(v_shop_ids)
        and l.created_at >= v_from and l.created_at <= v_to
      group by l.product_name
      order by sum(l.revenue) desc
      limit case when v_rank >= 2 then 15 else 5 end
    ) x
  ), '[]'::jsonb));

  if v_rank >= 2 then
    v_out := v_out || jsonb_build_object(
      'slow_moving', coalesce((
        select jsonb_agg(x) from (
          select p.name, s.name as shop, p.stock
          from public.products p
          join public.shops s on s.id = p.shop_id
          where s.id = any(v_shop_ids)
            and p.archived_at is null and p.stock > 0
            and not exists (
              select 1 from public.sales_log l
              where l.shop_id = p.shop_id and l.product_name = p.name
                and l.created_at >= v_from and l.created_at <= v_to
            )
          order by p.stock desc limit 20
        ) x
      ), '[]'::jsonb),
      'stock_alerts', coalesce((
        select jsonb_agg(x) from (
          select p.name, s.name as shop, p.stock
          from public.products p
          join public.shops s on s.id = p.shop_id
          where s.id = any(v_shop_ids)
            and p.archived_at is null and p.stock <= 3
          order by p.stock asc limit 30
        ) x
      ), '[]'::jsonb),
      'daily', coalesce((
        select jsonb_agg(x) from (
          select (l.created_at at time zone 'Asia/Kolkata')::date as day,
                 l.shop_id, sum(l.revenue) as revenue
          from public.sales_log l
          join public.shops s on s.id = l.shop_id
          where s.id = any(v_shop_ids)
            and l.created_at >= v_from and l.created_at <= v_to
          group by 1, 2 order by 1
        ) x
      ), '[]'::jsonb),
      'search_demand', coalesce((
        select jsonb_agg(x) from (
          select lower(trim(e.query)) as query, e.category, e.area,
                 count(*)::integer as searches,
                 count(distinct e.customer_id)::integer as searchers
          from public.search_events e
          where e.created_at >= v_from and e.created_at <= v_to
            and coalesce(trim(e.query),'') <> ''
            and e.customer_id is not null and e.customer_id <> ''
            and (
              e.area in (select s.area from public.shops s where s.id = any(v_shop_ids))
              or e.category in (select s.category from public.shops s where s.id = any(v_shop_ids))
            )
          group by 1, 2, 3
          having count(distinct e.customer_id) >= 5
          order by count(*) desc limit 20
        ) x
      ), '[]'::jsonb)
    );
  end if;

  return v_out;
end;
$$;

revoke all on function public.owner_business_overview(timestamptz,timestamptz) from public, anon;
grant execute on function public.owner_business_overview(timestamptz,timestamptz) to authenticated;
