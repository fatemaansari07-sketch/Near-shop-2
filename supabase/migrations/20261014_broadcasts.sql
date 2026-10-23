-- Product Broadcast: ek message = ek product (Rs 19, abhi mock payment).
create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  kind text not null default 'new_arrival' check (kind in ('new_arrival','special','discount')),
  title text not null,
  price numeric(12,2),
  old_price numeric(12,2),
  message text,
  images jsonb not null default '[]',
  amount numeric(8,2) not null default 19,
  status text not null default 'mock_paid',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '48 hours')
);
create index if not exists broadcasts_created_idx on public.broadcasts (created_at desc);
create index if not exists broadcasts_shop_idx on public.broadcasts (shop_id, created_at desc);
