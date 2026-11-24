-- NearShop Part 2: Orders (pay at shop / pickup), automatic stock deduction on confirm,
-- server-side coupon / campaign discount validation, campaign conversion + revenue.
-- Run AFTER 20261124_campaign_part1_audience_push_analytics.sql.
-- No online payment: customer pays at the shop. Price, discount and stock are ALWAYS computed here, never trusted from the app.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid not null references public.users(id) on delete cascade,
  customer_name text, customer_phone text, note text, shop_note text,
  status text not null default 'placed' check (status in ('placed','confirmed','ready','completed','cancelled','rejected')),
  subtotal numeric(12,2) not null, discount_amount numeric(12,2) not null default 0, total numeric(12,2) not null,
  coupon_code text, campaign_id uuid references public.admin_campaigns(id) on delete set null,
  stock_deducted boolean not null default false,
  request_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (customer_id, request_id)
);
create index if not exists orders_shop_idx on public.orders(shop_id, status, created_at desc);
create index if not exists orders_cust_idx on public.orders(customer_id, created_at desc);
create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  name text not null, unit_price numeric(12,2) not null, qty numeric(12,3) not null check (qty > 0),
  stock_qty numeric(12,3) not null check (stock_qty > 0), line_total numeric(12,2) not null
);
create index if not exists order_items_order_idx on public.order_items(order_id);
create table if not exists public.campaign_redemptions (
  campaign_id uuid not null references public.admin_campaigns(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  primary key (campaign_id, user_id)
);
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.campaign_redemptions enable row level security;
revoke all on public.orders, public.order_items, public.campaign_redemptions from public, anon, authenticated;

-- ---------- price + discount quote (no writes) ----------
create or replace function public._order_quote(p_uid uuid, p_shop uuid, p_items jsonb, p_coupon text, p_campaign uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_it jsonb; p public.products; v_qty numeric; v_size numeric; v_stock_qty numeric; v_price numeric; v_promo jsonb;
  v_lines jsonb := '[]'; v_sub numeric := 0; v_line numeric; v_cnt int := 0;
  c public.admin_campaigns; v_base numeric; v_disc numeric := 0; v_coupon text := nullif(trim(coalesce(p_coupon,'')),'');
begin
  if p_uid is null then raise exception 'LOGIN_REQUIRED'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Cart khali hai'; end if;
  if jsonb_array_length(p_items) > 20 then raise exception 'Ek order me maximum 20 items'; end if;
  perform 1 from public.shops where id = p_shop and coalesce(is_blocked,false) = false;
  if not found then raise exception 'Dukaan nahi mili'; end if;

  for v_it in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_it->>'qty')::numeric;
    if v_qty is null or v_qty <= 0 or v_qty > 1000 then raise exception 'Quantity galat hai'; end if;
    select * into p from public.products where id = (v_it->>'product_id')::uuid and shop_id = p_shop;
    if not found then raise exception 'Product us dukaan ka nahi hai'; end if;
    v_size := case when p.unit = 'pack' then greatest(1, coalesce(p.pack_size, 10)) else 1 end;
    v_stock_qty := v_qty * v_size;
    if coalesce(p.stock,0) < v_stock_qty - 0.000001 then raise exception 'STOCK_LOW:%', p.name; end if;
    v_price := coalesce(p.price,0);
    v_promo := p.promotion;
    if v_promo is not null and jsonb_typeof(v_promo) = 'object' and v_promo->>'type' in ('discount','flash')
       and (v_promo->>'expiresAt') is not null and (v_promo->>'expiresAt')::timestamptz > now()
       and ((v_promo->>'startsAt') is null or (v_promo->>'startsAt')::timestamptz <= now()) then
      v_price := greatest(0, coalesce(nullif(v_promo->>'newPrice','')::numeric, v_price * (1 - coalesce(nullif(v_promo->>'discount','')::numeric,0) / 100)));
    end if;
    v_price := round(v_price, 2);
    v_line := round(v_price * v_qty, 2);
    v_sub := v_sub + v_line; v_cnt := v_cnt + 1;
    v_lines := v_lines || jsonb_build_object('product_id', p.id, 'name', p.name, 'unit_price', v_price, 'qty', v_qty, 'stock_qty', v_stock_qty, 'line_total', v_line);
  end loop;

  -- coupon / campaign discount
  if v_coupon is not null or p_campaign is not null then
    select * into c from public.admin_campaigns a
     where a.status = 'published' and a.start_at <= now() and (a.end_at is null or a.end_at > now())
       and a.campaign_type <> 'feature_offer' and coalesce(a.discount_value,0) > 0 and a.discount_type in ('percent','fixed')
       and public.campaign_matches_user(a, p_uid)
       and ( (v_coupon is not null and lower(coalesce(a.coupon_code,'')) = lower(v_coupon))
          or (v_coupon is null and p_campaign is not null and a.id = p_campaign and coalesce(a.coupon_code,'') = '') )
     limit 1;
    if not found then raise exception 'COUPON_INVALID: coupon/offer galat ya expire hai'; end if;
    if c.shop_id is not null and c.shop_id <> p_shop then raise exception 'COUPON_INVALID: ye offer is dukaan ke liye nahi hai'; end if;
    if exists (select 1 from public.campaign_redemptions r where r.campaign_id = c.id and r.user_id = p_uid) then raise exception 'COUPON_USED: aap ye offer pehle use kar chuke hain'; end if;
    if c.product_id is not null then
      select coalesce(sum((l->>'line_total')::numeric),0) into v_base from jsonb_array_elements(v_lines) l where (l->>'product_id')::uuid = c.product_id;
      if v_base <= 0 then raise exception 'COUPON_INVALID: ye offer sirf ek khaas product par hai'; end if;
    else v_base := v_sub; end if;
    v_disc := least(v_base, round(case when c.discount_type = 'percent' then v_base * least(c.discount_value,100) / 100 else c.discount_value end, 2));
  end if;
  return jsonb_build_object('lines', v_lines, 'subtotal', v_sub, 'discount', v_disc, 'total', greatest(0, v_sub - v_disc), 'campaign_id', c.id, 'coupon', v_coupon);
end $$;

create or replace function public.quote_order(p_shop uuid, p_items jsonb, p_coupon text default null, p_campaign uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select public._order_quote(public.current_nearshop_user_id(), p_shop, p_items, p_coupon, p_campaign)
$$;

create or replace function public.place_order(p_shop uuid, p_items jsonb, p_name text default null, p_phone text default null, p_note text default null,
                                              p_coupon text default null, p_campaign uuid default null, p_request_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public.current_nearshop_user_id(); q jsonb; v_id uuid; l jsonb; v_phone text := nullif(regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'),'');
begin
  if v_uid is null then raise exception 'LOGIN_REQUIRED'; end if;
  if p_request_id is not null then
    select id into v_id from public.orders where customer_id = v_uid and request_id = p_request_id;
    if v_id is not null then return jsonb_build_object('order_id', v_id, 'duplicate', true); end if;
  end if;
  if v_phone is not null and v_phone !~ '^[0-9]{10,15}$' then raise exception 'Phone number galat hai'; end if;
  q := public._order_quote(v_uid, p_shop, p_items, p_coupon, p_campaign);
  insert into public.orders(shop_id, customer_id, customer_name, customer_phone, note, subtotal, discount_amount, total, coupon_code, campaign_id, request_id)
  values (p_shop, v_uid, left(nullif(trim(coalesce(p_name,'')),''),80), v_phone, left(p_note,300), (q->>'subtotal')::numeric, (q->>'discount')::numeric, (q->>'total')::numeric,
          q->>'coupon', nullif(q->>'campaign_id','')::uuid, p_request_id)
  returning id into v_id;
  for l in select * from jsonb_array_elements(q->'lines') loop
    insert into public.order_items(order_id, product_id, name, unit_price, qty, stock_qty, line_total)
    values (v_id, (l->>'product_id')::uuid, l->>'name', (l->>'unit_price')::numeric, (l->>'qty')::numeric, (l->>'stock_qty')::numeric, (l->>'line_total')::numeric);
  end loop;
  if nullif(q->>'campaign_id','') is not null then
    insert into public.campaign_redemptions(campaign_id, user_id, order_id) values ((q->>'campaign_id')::uuid, v_uid, v_id);
  end if;
  return jsonb_build_object('order_id', v_id, 'total', (q->>'total')::numeric, 'discount', (q->>'discount')::numeric);
exception when unique_violation then raise exception 'COUPON_USED: aap ye offer pehle use kar chuke hain';
end $$;

-- ---------- shop side: confirm (stock goes down here), ready, complete, cancel/reject (stock comes back) ----------
create or replace function public.update_order_status(p_order uuid, p_status text, p_shop_note text default null)
returns text language plpgsql security definer set search_path = public as $$
declare o public.orders; it record; v_rows int; s record; v_ratio numeric;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order nahi mila'; end if;
  if not public.nearshop_can(o.shop_id, 'sell') then raise exception 'NOT_ALLOWED'; end if;
  if p_status not in ('confirmed','ready','completed','cancelled','rejected') then raise exception 'Galat status'; end if;
  if o.status in ('completed','cancelled','rejected') then raise exception 'Ye order band ho chuka hai'; end if;

  if p_status = 'confirmed' then
    if o.status <> 'placed' then raise exception 'Sirf naya order confirm hota hai'; end if;
    for it in select * from public.order_items where order_id = o.id loop
      update public.products set stock = round((stock - it.stock_qty)::numeric, 3), last_updated = now()
       where id = it.product_id and shop_id = o.shop_id and stock >= it.stock_qty - 0.000001;
      get diagnostics v_rows = row_count;
      if v_rows = 0 then raise exception 'STOCK_LOW:%', it.name; end if;
    end loop;
    update public.orders set stock_deducted = true where id = o.id;
  elsif p_status = 'ready' then
    if o.status <> 'confirmed' then raise exception 'Pehle order confirm karein'; end if;
  elsif p_status = 'completed' then
    if o.status not in ('confirmed','ready') then raise exception 'Pehle order confirm karein'; end if;
    select area, city, state, country, category into s from public.shops where id = o.shop_id;
    v_ratio := case when o.subtotal > 0 then o.total / o.subtotal else 1 end;
    for it in select * from public.order_items where order_id = o.id loop
      insert into public.sales_log(shop_id, product_name, qty, revenue, area, city, state, country, category)
      values (o.shop_id, it.name, it.stock_qty, round(it.line_total * v_ratio, 2), s.area, s.city, s.state, s.country, s.category);
    end loop;
    if o.campaign_id is not null then
      insert into public.campaign_events(campaign_id, user_id, event, amount, order_ref) values (o.campaign_id, o.customer_id, 'order', o.total, o.id::text);
      update public.admin_campaigns set redemptions = redemptions + 1 where id = o.campaign_id;
    end if;
  else -- cancelled / rejected
    if o.stock_deducted then
      for it in select * from public.order_items where order_id = o.id loop
        update public.products set stock = round((stock + it.stock_qty)::numeric, 3), last_updated = now() where id = it.product_id;
      end loop;
      update public.orders set stock_deducted = false where id = o.id;
    end if;
    delete from public.campaign_redemptions where order_id = o.id;
  end if;
  update public.orders set status = p_status, shop_note = coalesce(left(p_shop_note,300), shop_note), updated_at = now() where id = o.id;
  return p_status;
end $$;

create or replace function public.cancel_my_order(p_order uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order and customer_id = public.current_nearshop_user_id() for update;
  if not found then raise exception 'Order nahi mila'; end if;
  if o.status <> 'placed' then raise exception 'Ab order shop ne confirm kar diya hai, shop se baat karein'; end if;
  update public.orders set status = 'cancelled', updated_at = now() where id = o.id;
  delete from public.campaign_redemptions where order_id = o.id;
  return true;
end $$;

-- ---------- reads ----------
create or replace function public.my_orders()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by (x->>'created_at') desc), '[]') from (
    select jsonb_build_object('id', o.id, 'shop_id', o.shop_id, 'shop_name', s.name, 'shop_phone', s.phone, 'status', o.status, 'subtotal', o.subtotal,
      'discount_amount', o.discount_amount, 'total', o.total, 'coupon_code', o.coupon_code, 'note', o.note, 'shop_note', o.shop_note, 'created_at', o.created_at,
      'items', (select coalesce(jsonb_agg(jsonb_build_object('name', i.name, 'qty', i.qty, 'unit_price', i.unit_price, 'line_total', i.line_total)), '[]') from public.order_items i where i.order_id = o.id)) x
    from public.orders o join public.shops s on s.id = o.shop_id
    where o.customer_id = public.current_nearshop_user_id() order by o.created_at desc limit 50) t
$$;

create or replace function public.shop_orders(p_shop uuid, p_open_only boolean default true)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.nearshop_can(p_shop, 'sell') then raise exception 'NOT_ALLOWED'; end if;
  return (select coalesce(jsonb_agg(x order by (x->>'created_at') desc), '[]') from (
    select jsonb_build_object('id', o.id, 'status', o.status, 'customer_name', o.customer_name, 'customer_phone', o.customer_phone, 'subtotal', o.subtotal,
      'discount_amount', o.discount_amount, 'total', o.total, 'coupon_code', o.coupon_code, 'note', o.note, 'shop_note', o.shop_note, 'created_at', o.created_at,
      'items', (select coalesce(jsonb_agg(jsonb_build_object('name', i.name, 'qty', i.qty, 'line_total', i.line_total)), '[]') from public.order_items i where i.order_id = o.id)) x
    from public.orders o where o.shop_id = p_shop and (not p_open_only or o.status in ('placed','confirmed','ready'))
    order by o.created_at desc limit 100) t);
end $$;

revoke all on function public._order_quote(uuid,uuid,jsonb,text,uuid) from public, anon, authenticated;
grant execute on function public.quote_order(uuid,jsonb,text,uuid), public.place_order(uuid,jsonb,text,text,text,text,uuid,uuid),
  public.update_order_status(uuid,text,text), public.cancel_my_order(uuid), public.my_orders(), public.shop_orders(uuid,boolean) to authenticated;
