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
-- BUG FIX: this used to delete every storage object in 'need-images' older than 2 hours,
-- regardless of whether its request was actually being removed. A request that moved to
-- 'coming' (customer confirmed pickup) is deliberately kept (not in the open/expired delete
-- below), but its photo would still get wiped by the old time-only rule, leaving a broken
-- image_url on an otherwise-active request. Now only images belonging to the rows we are
-- actually deleting get removed.
create or replace function public.cleanup_expired_need_requests()
returns void
language plpgsql
security definer
as $$
declare
  img record;
begin
  for img in
    select image_url from public.need_requests
    where expires_at <= now() and status in ('open','expired') and image_url is not null
  loop
    delete from storage.objects
    where bucket_id = 'need-images'
      and name = regexp_replace(img.image_url, '^.*/need-images/', '');
  end loop;

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
