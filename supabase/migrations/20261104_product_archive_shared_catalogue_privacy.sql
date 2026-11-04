-- NearShop product archive, shared medicine manufacturer catalogue and privacy preferences.
alter table public.products add column if not exists archived_at timestamptz;
alter table public.products add column if not exists visibility_mode text not null default 'public';
alter table public.products drop constraint if exists products_visibility_mode_check;
alter table public.products add constraint products_visibility_mode_check
  check (visibility_mode in ('public','search_only','hidden'));
create index if not exists products_shop_archived_idx on public.products(shop_id, archived_at);

alter table public.shops add column if not exists product_visibility_mode text not null default 'public';
alter table public.shops drop constraint if exists shops_product_visibility_mode_check;
alter table public.shops add constraint shops_product_visibility_mode_check
  check (product_visibility_mode in ('public','search_only','disabled'));
alter table public.shops add column if not exists hide_product_prices boolean not null default false;

-- One shared record per medicine identity + manufacturer. Shop-specific price, batch,
-- expiry and stock are deliberately NOT stored here.
create table if not exists public.medicine_catalogue (
  id uuid primary key default gen_random_uuid(),
  medicine_name text not null,
  manufacturer text not null,
  brand text,
  strength text,
  dosage_form text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitted_by_shop_id uuid references public.shops(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists medicine_catalogue_identity_unique on public.medicine_catalogue
  (lower(medicine_name), lower(manufacturer), coalesce(lower(brand),''), coalesce(lower(strength),''), coalesce(lower(dosage_form),''));
create index if not exists medicine_catalogue_lookup_idx
  on public.medicine_catalogue (lower(medicine_name), status, lower(manufacturer));

-- Existing NearShop schema currently uses the anon-key app pattern with RLS disabled
-- on its operational tables. Keep this table consistent with that established pattern.

-- Seed the shared options from pharmacy products already entered by shopkeepers.
-- This copies medicine identity/manufacturer only; no shop pricing, stock, batch or expiry.
insert into public.medicine_catalogue (medicine_name, manufacturer, brand, strength, dosage_form, status, submitted_by_shop_id)
select distinct
  nullif(trim(p.category_data->>'composition'), ''),
  nullif(trim(p.category_data->>'manufacturer'), ''),
  nullif(trim(p.category_data->>'brand'), ''),
  nullif(trim(p.category_data->>'strength'), ''),
  nullif(trim(p.category_data->>'dosageForm'), ''),
  'approved',
  p.shop_id
from public.products p
where lower(coalesce((select category from public.shops s where s.id = p.shop_id), '')) = 'pharmacy'
  and nullif(trim(p.category_data->>'composition'), '') is not null
  and nullif(trim(p.category_data->>'manufacturer'), '') is not null
on conflict do nothing;
