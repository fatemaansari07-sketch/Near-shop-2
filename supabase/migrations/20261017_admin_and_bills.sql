-- 1) Admin password ab database me (hash), code me nahi.
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.app_admin (
  id int primary key default 1 check (id = 1),
  pass_hash text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_admin enable row level security;      -- koi policy nahi => app seedha padh nahi sakti
revoke all on public.app_admin from anon, authenticated;

create or replace function public.admin_login(p_password text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare h text; ok boolean := false;
begin
  select pass_hash into h from public.app_admin where id = 1;
  if h is not null and p_password is not null then ok := (extensions.crypt(p_password, h) = h); end if;
  if not ok then perform pg_sleep(1.5); end if;   -- galat try par dheema (brute force rokne ke liye)
  return ok;
end $$;
grant execute on function public.admin_login(text) to anon, authenticated;

-- 2) Bill delete: bill hatane se udhar entry ya report nahi mitti (sirf bill ka record hat-ta hai).
alter table public.khata_entries drop constraint if exists khata_entries_bill_id_fkey;
alter table public.khata_entries add constraint khata_entries_bill_id_fkey foreign key (bill_id) references public.bills(id) on delete set null;
-- (sales_log.bill_id pehle se "on delete set null" hai)

-- ==== ADMIN PASSWORD SET KARNE KE LIYE (apna naya password daal ke, SQL Editor me alag se ek baar Run) ====
-- insert into public.app_admin (id, pass_hash) values (1, extensions.crypt('APNA-NAYA-PASSWORD', extensions.gen_salt('bf')))
--   on conflict (id) do update set pass_hash = excluded.pass_hash, updated_at = now();
