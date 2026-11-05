-- NearShop Ads, Admin Pricing, Wholesale and Shop Type
-- Run after the existing NearShop migrations. Safe to re-run.
alter table public.shops
  add column if not exists shop_type text not null default 'retail'
    check (shop_type in ('retail','wholesale','both')),
  add column if not exists wholesale_market_intelligence jsonb not null default '{}'::jsonb;

alter table public.broadcasts
  add column if not exists audience text not null default 'everyone'
    check (audience in ('everyone','shopkeepers')),
  add column if not exists target_scope text not null default 'city'
    check (target_scope in ('city','state','country'));

create table if not exists public.platform_settings (
  id text primary key,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;
grant select on public.platform_settings to anon, authenticated;
drop policy if exists "platform pricing readable" on public.platform_settings;
create policy "platform pricing readable" on public.platform_settings
  for select to anon, authenticated using (id = 'pricing');
revoke insert, update, delete on public.platform_settings from anon, authenticated;

insert into public.platform_settings(id, settings)
values ('pricing', '{
  "promotions":{"shop_boost":10,"product_boost":10,"discount":10,"flash":20,"nearby_first":20,"top_shop":30,"announcement":10,"new_stock":10,"coupon":10,"reward_wheel":20,"demand_alert":10},
  "geography":{"city":10,"state":99,"country":999},
  "searchAds":{"city":10,"state":99,"country":999},
  "wholesale":{"shopkeepers":10,"everyone":99,"market_intelligence_monthly":999},
  "broadcast":{"retail":10,"wholesale_shopkeepers":10,"wholesale_everyone":99},
  "membership":{"pro_monthly":99},
  "misc":{"feed_post":10,"ad_free_monthly":99,"additional_shop_fee":4999}
}'::jsonb)
on conflict (id) do nothing;

create or replace function public.admin_update_platform_pricing(p_password text, p_settings jsonb)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_hash text;
begin
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' then
    raise exception 'Invalid pricing settings';
  end if;
  select pass_hash into v_hash from public.app_admin where id = 1;
  if v_hash is null or p_password is null or extensions.crypt(p_password, v_hash) <> v_hash then
    perform pg_sleep(1);
    return false;
  end if;
  insert into public.platform_settings(id, settings, updated_at)
  values ('pricing', p_settings, now())
  on conflict (id) do update set settings = excluded.settings, updated_at = now();
  return true;
end;
$$;
revoke all on function public.admin_update_platform_pricing(text,jsonb) from public;
grant execute on function public.admin_update_platform_pricing(text,jsonb) to anon, authenticated;

create index if not exists sales_log_market_aggregate_idx
  on public.sales_log(category, city, product_name, created_at desc);

-- Only anonymous aggregates are exposed. A product/city/category combination
-- appears only after at least five different shops have contributed sales.
drop view if exists public.wholesale_market_insights;
create view public.wholesale_market_insights
with (security_barrier = true)
as
select
  category,
  product_name,
  city,
  state,
  sum(qty)::numeric(14,2) as units_sold,
  count(distinct shop_id)::integer as contributing_shops,
  max(created_at) as last_sale_at
from public.sales_log
where created_at >= now() - interval '90 days'
group by category, product_name, city, state
having count(distinct shop_id) >= 5;

grant select on public.wholesale_market_insights to authenticated;

-- Aggregated search demand (no user IDs or individual search history exposed).
drop view if exists public.wholesale_search_insights;
create view public.wholesale_search_insights
with (security_barrier = true)
as
select category, query, area,
       count(*)::integer as searches,
       count(distinct user_id)::integer as unique_searchers,
       max(created_at) as last_search_at
from public.search_events
where created_at >= now() - interval '90 days'
group by category, query, area
having count(distinct user_id) >= 5;
grant select on public.wholesale_search_insights to authenticated;

-- Monthly product movement; deliberately no revenue, price, or shop identifiers.
drop view if exists public.wholesale_seasonality_insights;
create view public.wholesale_seasonality_insights
with (security_barrier = true)
as
select category, product_name,
       date_trunc('month', created_at)::date as sales_month,
       sum(qty)::numeric(14,2) as units_sold,
       count(distinct shop_id)::integer as contributing_shops
from public.sales_log
where created_at >= now() - interval '24 months'
group by category, product_name, date_trunc('month', created_at)
having count(distinct shop_id) >= 5;
grant select on public.wholesale_seasonality_insights to authenticated;

-- Customer interest leads for time-limited product deals.
create table if not exists public.deal_interests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.users(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  offer_price numeric(12,2),
  created_at timestamptz not null default now(),
  unique(customer_id, product_id)
);
alter table public.deal_interests enable row level security;
drop policy if exists "customers can register deal interest" on public.deal_interests;
create policy "customers can register deal interest" on public.deal_interests
  for insert to authenticated with check (
    exists (select 1 from public.users u where u.id = customer_id and u.auth_id = auth.uid())
  );
drop policy if exists "shop owners can read deal interest" on public.deal_interests;
create policy "shop owners can read deal interest" on public.deal_interests
  for select to authenticated using (
    exists (
      select 1 from public.shops s
      join public.users u on u.id = s.owner_id
      where s.id = shop_id and u.auth_id = auth.uid()
    )
  );
grant insert, select on public.deal_interests to authenticated;

create or replace function public.prevent_broadcast_duplicate_burst()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from public.broadcasts b
    where b.shop_id = new.shop_id
      and coalesce(b.product_id, '00000000-0000-0000-0000-000000000000'::uuid) =
          coalesce(new.product_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and lower(b.title) = lower(new.title)
      and b.created_at > now() - interval '30 seconds'
  ) then
    raise exception 'Duplicate broadcast: please wait before sending the same message again';
  end if;
  return new;
end;
$$;
drop trigger if exists broadcasts_duplicate_burst_guard on public.broadcasts;
create trigger broadcasts_duplicate_burst_guard
before insert on public.broadcasts
for each row execute function public.prevent_broadcast_duplicate_burst();

-- State-level roll-up, still requiring five contributing shops.
drop view if exists public.wholesale_state_market_insights;
create view public.wholesale_state_market_insights
with (security_barrier = true)
as
select category, product_name, state,
       sum(qty)::numeric(14,2) as units_sold,
       count(distinct shop_id)::integer as contributing_shops
from public.sales_log
where created_at >= now() - interval '90 days'
group by category, product_name, state
having count(distinct shop_id) >= 5;
grant select on public.wholesale_state_market_insights to authenticated;
