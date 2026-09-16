-- Need It / Item Request + persistent medical pack metadata.
create table if not exists public.need_requests (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.users(id) on delete cascade,
 category text not null check (category in ('Pharmacy','Footwear','Clothing','Electronics','Paint')),
 title text not null,
 details text,
 image_url text,
 area text,
 city text,
 lat double precision,
 lng double precision,
 status text not null default 'open' check (status in ('open','claimed','coming','closed','expired')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now() + interval '2 hours'),
 closed_at timestamptz
);
create table if not exists public.need_responses (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.need_requests(id) on delete cascade,
 shop_id uuid not null references public.shops(id) on delete cascade,
 message text,
 status text not null default 'available' check (status in ('available','coming','completed','cancelled')),
 created_at timestamptz not null default now()
);
create index if not exists need_requests_status_expiry_idx on public.need_requests(status,expires_at);
create index if not exists need_requests_category_idx on public.need_requests(category);
create index if not exists need_responses_request_idx on public.need_responses(request_id);
create unique index if not exists need_responses_request_shop_unique on public.need_responses(request_id,shop_id);

-- Product pack size is persistent; stock for pack products created by the new app is stored in base units (tablets/pieces).
alter table public.products add column if not exists pack_size integer;

insert into storage.buckets (id,name,public) values ('need-images','need-images',true) on conflict (id) do nothing;

-- The current app uses its own users table/demo login rather than Supabase Auth, so the client
-- needs anonymous upload/read access. Images are hard-deleted by the cleanup job after expiry.
-- When Supabase Auth is enabled, replace these with owner/shop-scoped policies and signed URLs.
drop policy if exists "need images public read" on storage.objects;
drop policy if exists "need images public upload" on storage.objects;
create policy "need images public read" on storage.objects for select using (bucket_id = 'need-images');
create policy "need images public upload" on storage.objects for insert with check (bucket_id = 'need-images');

-- Expiry cleanup: if pg_cron is enabled in the Supabase project, this schedules hard deletion
-- of request rows and their uploaded images every 5 minutes. The app also hides expired rows immediately.
create or replace function public.cleanup_expired_need_requests()
returns void
language plpgsql
security definer
as $$
begin
  delete from storage.objects
  where bucket_id = 'need-images'
    and created_at < now() - interval '2 hours';
  delete from public.need_requests
  where expires_at <= now()
    and status in ('open','expired');
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'shopnear-cleanup-expired-need-it';
    perform cron.schedule('shopnear-cleanup-expired-need-it','*/5 * * * *','select public.cleanup_expired_need_requests();');
  end if;
exception when others then
  null;
end $$;

-- NearShop growth loop + low-ticket promotion infrastructure.
alter table public.shops add column if not exists promotion jsonb not null default '{}'::jsonb;
alter table public.products add column if not exists promotion jsonb not null default '{}'::jsonb;

create table if not exists public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_name text not null,
  target_price numeric not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists price_alerts_user_idx on public.price_alerts(user_id, active, created_at desc);

create table if not exists public.search_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  query text not null,
  category text,
  area text,
  created_at timestamptz not null default now()
);
create index if not exists search_events_created_idx on public.search_events(created_at desc);
create index if not exists search_events_query_idx on public.search_events(query);
u
create table if not exists public.promotion_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  shop_id uuid references public.shops(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  type text not null,
  amount numeric not null default 0,
  status text not null default 'mock_paid',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists promotion_events_shop_idx on public.promotion_events(shop_id, created_at desc);
