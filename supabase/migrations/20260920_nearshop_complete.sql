-- ============================================================
-- NEARSHOP COMPLETE FEATURE SET - 20 Sep 2026
-- Idempotent additions for Need It, Growth, Deals, Emergency,
-- category product data, PC/CSV import and shop delivery.
-- ============================================================

-- ----------------------------
-- Need It
-- ----------------------------
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

create index if not exists need_requests_status_expiry_idx on public.need_requests(status, expires_at);
create index if not exists need_requests_category_idx on public.need_requests(category);
create index if not exists need_responses_request_idx on public.need_responses(request_id);
create unique index if not exists need_responses_request_shop_unique on public.need_responses(request_id, shop_id);

-- Need It remains FREE. No lead-payment column or fee is required.

insert into storage.buckets (id,name,public)
values ('need-images','need-images',true)
on conflict (id) do nothing;

drop policy if exists "need images public read" on storage.objects;
drop policy if exists "need images public upload" on storage.objects;
create policy "need images public read" on storage.objects for select using (bucket_id='need-images');
create policy "need images public upload" on storage.objects for insert with check (bucket_id='need-images');

create or replace function public.cleanup_expired_need_requests()
returns void
language plpgsql
security definer
as $$
begin
  delete from storage.objects
  where bucket_id='need-images'
    and created_at < now() - interval '2 hours';

  delete from public.need_requests
  where expires_at <= now()
    and status in ('open','expired');
end;
$$;

-- ----------------------------
-- Product data / medical pack logic
-- ----------------------------
alter table public.products add column if not exists pack_size integer;
alter table public.products add column if not exists category_data jsonb not null default '{}'::jsonb;
alter table public.products add column if not exists import_source text;
alter table public.products add column if not exists baseline_price numeric;
alter table public.products add column if not exists imported_at timestamptz;
alter table public.products add column if not exists promotion jsonb not null default '{}'::jsonb;

insert into storage.buckets (id,name,public)
values ('product-images','product-images',true)
on conflict (id) do nothing;

drop policy if exists "product images public read" on storage.objects;
drop policy if exists "product images public upload" on storage.objects;
create policy "product images public read" on storage.objects for select using (bucket_id='product-images');
create policy "product images public upload" on storage.objects for insert with check (bucket_id='product-images');

-- ----------------------------
-- Shop growth / promotion / intelligence
-- ----------------------------
alter table public.shops add column if not exists promotion jsonb not null default '{}'::jsonb;
alter table public.shops add column if not exists home_delivery_available boolean not null default false;
alter table public.shops add column if not exists delivery_radius_km numeric;
alter table public.shops add column if not exists delivery_areas text;
alter table public.shops add column if not exists membership jsonb not null default '{}'::jsonb;

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

-- ----------------------------
-- Emergency directory
-- ----------------------------
create table if not exists public.emergency_services (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('Hospital','Clinic','24x7 Pharmacy','Ambulance','Petrol Pump','Garage','Tyre / Puncture','Battery / Jump Start','Mechanic','Blood Bank','Diagnostic / Lab')),
  name text not null,
  address text not null,
  area text,
  city text default 'Surat',
  phone text,
  lat double precision,
  lng double precision,
  open24 boolean not null default false,
  open_now boolean not null default false,
  source text not null default 'authorized',
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  verified boolean not null default false,
  verified_by text,
  verified_at timestamptz,
  suggested_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists emergency_services_live_idx on public.emergency_services(status, verified, type, city);
create index if not exists emergency_services_geo_idx on public.emergency_services(lat,lng);
create index if not exists emergency_services_pending_idx on public.emergency_services(status, created_at desc);

-- Optional pg_cron cleanup. If pg_cron is not enabled, the app still hides expired requests.
do $$
begin
  if exists (select 1 from pg_extension where extname='pg_cron') then
    begin
      perform cron.unschedule(jobid) from cron.job where jobname='nearshop-cleanup-expired-need-it';
      perform cron.schedule('nearshop-cleanup-expired-need-it','*/5 * * * *','select public.cleanup_expired_need_requests();');
    exception when others then
      null;
    end;
  end if;
end $$;

-- ============================================================
-- IMPORTANT: Run this whole file once in Supabase SQL Editor.
-- Real payment/Play Billing is intentionally NOT wired here yet.
-- Need It stays FREE.
-- ============================================================
