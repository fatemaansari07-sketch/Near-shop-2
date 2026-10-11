-- Udhar Khata: shopkeeper <-> customer ledger with usernames + confirmations.
alter table public.users add column if not exists username text;
create unique index if not exists users_username_key on public.users (username) where username is not null;
alter table public.users drop constraint if exists users_username_format;
alter table public.users add constraint users_username_format check (username is null or username ~ '^[a-z0-9_]{3,20}$');

create table if not exists public.khata_entries (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid references public.users(id) on delete set null,
  customer_label text,                       -- naam, jab customer app me nahi hai
  kind text not null check (kind in ('udhar','payment')),
  party text not null check (party in ('customer','shop')),   -- udhar: kisko dena hai | payment: kisne diya
  amount numeric(12,2) not null check (amount > 0),
  note text,
  created_by text not null check (created_by in ('customer','shop')),
  status text not null default 'pending' check (status in ('pending','confirmed','disputed')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  check (customer_id is not null or customer_label is not null)
);
create index if not exists khata_entries_shop_idx on public.khata_entries (shop_id, created_at desc);
create index if not exists khata_entries_customer_idx on public.khata_entries (customer_id, created_at desc);

-- Invite link se aaye customers (shopkeeper ki customer list)
create table if not exists public.khata_links (
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shop_id, customer_id)
);
-- Note: baaki app tables ki tarah RLS yahan bhi off hai (app phone-login + anon key use karta hai).
