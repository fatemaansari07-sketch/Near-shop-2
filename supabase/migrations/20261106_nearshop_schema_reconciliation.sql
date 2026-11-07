-- NearShop live-schema reconciliation (2026-11-06)
-- Safe to re-run. This migration supports both the uploaded live schema and
-- the older migrations that used user_id/type/payload.

alter table public.search_events add column if not exists area text;
alter table public.search_events add column if not exists customer_id text;
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='search_events' and column_name='user_id') then
    execute 'update public.search_events set customer_id = user_id::text where customer_id is null and user_id is not null';
  end if;
end $$;
create index if not exists search_events_customer_created_idx
  on public.search_events(customer_id, created_at desc);

-- Older migration used price_alerts.user_id uuid; live database reports customer_id text.
alter table public.price_alerts add column if not exists customer_id text;
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='price_alerts' and column_name='user_id') then
    execute 'update public.price_alerts set customer_id = user_id::text where customer_id is null and user_id is not null';
  end if;
end $$;
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='price_alerts' and column_name='user_id') then
    alter table public.price_alerts alter column user_id drop not null;
  end if;
end $$;
create index if not exists price_alerts_customer_active_idx
  on public.price_alerts(customer_id, active, created_at desc);

-- Older promotion_events used type/payload; current live schema uses promotion_type,
-- duration_hours, starts_at and ends_at. Preserve the old values while adding the
-- current fields consumed by the app.
alter table public.promotion_events add column if not exists promotion_type text;
alter table public.promotion_events add column if not exists type text;
alter table public.promotion_events add column if not exists duration_hours integer;
alter table public.promotion_events add column if not exists starts_at timestamptz;
alter table public.promotion_events add column if not exists ends_at timestamptz;
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='promotion_events' and column_name='type') then
    execute 'update public.promotion_events set promotion_type = coalesce(promotion_type, type), type = coalesce(type, promotion_type)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='promotion_events' and column_name='created_at') then
    execute 'update public.promotion_events set starts_at = coalesce(starts_at, created_at, now()), ends_at = coalesce(ends_at, created_at + interval ''24 hours'', now() + interval ''24 hours'')';
  else
    update public.promotion_events set starts_at=coalesce(starts_at,now()), ends_at=coalesce(ends_at,now()+interval '24 hours');
  end if;
  update public.promotion_events set duration_hours=coalesce(duration_hours,24), promotion_type=coalesce(promotion_type,'legacy'), type=coalesce(type,promotion_type,'legacy');
end $$;

-- Rebuild aggregate view using customer_id. Individual search history and IDs
-- are never exposed by this view; at least five distinct customers are required.
drop view if exists public.wholesale_search_insights;
create view public.wholesale_search_insights
with (security_barrier = true)
as
select category, query, area,
       count(*)::integer as searches,
       count(distinct customer_id)::integer as unique_searchers,
       max(created_at) as last_search_at
from public.search_events
where created_at >= now() - interval '90 days'
  and customer_id is not null and customer_id <> ''
group by category, query, area
having count(distinct customer_id) >= 5;

revoke all on public.wholesale_search_insights from public, anon;
grant select on public.wholesale_search_insights to authenticated;

-- Keep all wholesale aggregate views inaccessible to anon/PUBLIC.
revoke all on public.wholesale_market_insights, public.wholesale_seasonality_insights,
  public.wholesale_state_market_insights from public, anon;
grant select on public.wholesale_market_insights, public.wholesale_seasonality_insights,
  public.wholesale_state_market_insights to authenticated;

-- Platform pricing is public-read only; direct writes must use the password-verified RPC.
revoke all on public.platform_settings from public, anon, authenticated;
grant select on public.platform_settings to anon, authenticated;
update public.platform_settings
set settings = jsonb_set(settings, '{misc,competitor_price_insight}', '10'::jsonb, true), updated_at=now()
where id='pricing' and not (coalesce(settings->'misc','{}'::jsonb) ? 'competitor_price_insight');

-- Admin credential hash inaccessible through direct table access.
alter table public.app_admin enable row level security;
revoke all on public.app_admin from public, anon, authenticated;
