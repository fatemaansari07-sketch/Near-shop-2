-- Atomic sale: stock kam hona + sales_log + bill + udhar entry ek hi transaction me (sab ya kuch nahi).
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  payment_type text not null default 'paid' check (payment_type in ('paid','udhar')),
  customer_id uuid references public.users(id) on delete set null,
  customer_label text,
  subtotal numeric(12,2) not null default 0,
  discount_pct numeric(5,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  items jsonb not null default '[]',
  created_at timestamptz not null default now(),
  voided_at timestamptz
);
create index if not exists bills_shop_idx on public.bills (shop_id, created_at desc);
alter table public.sales_log add column if not exists bill_id uuid references public.bills(id) on delete set null;
alter table public.khata_entries add column if not exists bill_id uuid references public.bills(id) on delete cascade;

create or replace function public.complete_sale(
  p_shop_id uuid, p_items jsonb, p_payment text default 'paid',
  p_customer_id uuid default null, p_customer_label text default null, p_customer_phone text default null,
  p_subtotal numeric default 0, p_discount_pct numeric default 0, p_discount_amount numeric default 0,
  p_total numeric default 0, p_note text default null
) returns uuid language plpgsql as $$
declare
  v_bill uuid := gen_random_uuid();
  v_shop record; v_item jsonb; v_rows int; v_qty numeric;
begin
  select area, city, state, country, category into v_shop from public.shops where id = p_shop_id;
  if not found then raise exception 'Dukaan nahi mili'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'Cart khali hai'; end if;

  insert into public.bills (id, shop_id, payment_type, customer_id, customer_label, subtotal, discount_pct, discount_amount, total, items)
  values (v_bill, p_shop_id, p_payment, p_customer_id, p_customer_label, p_subtotal, p_discount_pct, p_discount_amount, p_total, p_items);

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'sold_qty')::numeric;
    -- stock database me hi check + kam hota hai (purana/stale stock overwrite nahi hota)
    update public.products
       set stock = round((stock - v_qty)::numeric, 3), last_updated = now()
     where id = (v_item->>'product_id')::uuid and shop_id = p_shop_id and stock >= v_qty - 0.000001;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then raise exception 'STOCK_LOW:%', v_item->>'name'; end if;
    insert into public.sales_log (shop_id, product_name, qty, revenue, area, city, state, country, category, bill_id)
    values (p_shop_id, v_item->>'name', (v_item->>'log_qty')::numeric, (v_item->>'line_total')::numeric,
            v_shop.area, v_shop.city, v_shop.state, v_shop.country, v_shop.category, v_bill);
  end loop;

  if p_customer_id is not null or p_customer_label is not null then
    insert into public.khata_entries (shop_id, customer_id, customer_label, customer_phone, kind, party, amount, note, created_by, status, bill_id)
    values (p_shop_id, p_customer_id, case when p_customer_id is null then p_customer_label end, p_customer_phone,
            case when p_payment = 'udhar' then 'udhar' else 'sale' end, 'customer', p_total, left(p_note, 200), 'shop',
            case when p_payment = 'udhar' and p_customer_id is not null then 'pending' else 'confirmed' end, v_bill);
  end if;
  return v_bill;
end $$;

-- Undo: sirf 15 minute ke andar. Stock wapas, sales_log aur khata entry hat jaati hai, bill "voided" ho jata hai.
create or replace function public.void_sale(p_bill_id uuid) returns void language plpgsql as $$
declare b record; it jsonb;
begin
  select * into b from public.bills where id = p_bill_id for update;
  if not found then raise exception 'Bill nahi mila'; end if;
  if b.voided_at is not null then raise exception 'Ye bill pehle hi undo ho chuka hai'; end if;
  if b.created_at < now() - interval '15 minutes' then raise exception 'UNDO_EXPIRED'; end if;
  for it in select * from jsonb_array_elements(b.items) loop
    update public.products set stock = round((stock + (it->>'sold_qty')::numeric)::numeric, 3), last_updated = now()
     where id = (it->>'product_id')::uuid;
  end loop;
  delete from public.sales_log where bill_id = p_bill_id;
  delete from public.khata_entries where bill_id = p_bill_id;
  update public.bills set voided_at = now() where id = p_bill_id;
end $$;
