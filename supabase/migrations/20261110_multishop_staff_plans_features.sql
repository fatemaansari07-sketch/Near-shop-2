-- NearShop multi-shop upgrade: shop profile, admin feature flags, plans, staff roles, owner analytics,
-- idempotent sales. Run AFTER 20261106_nearshop_schema_reconciliation.sql and 20261106_nearshop_security_hardening.sql.
-- Safe to re-run: every statement is idempotent. Nothing here weakens an existing RLS policy:
-- new policies are additive (permissive OR) and existing owner policies are untouched.

-- ---------------------------------------------------------------------------
-- 1. Shop profile columns (all optional)
-- ---------------------------------------------------------------------------
alter table public.shops add column if not exists logo_url text;
alter table public.shops add column if not exists cover_url text;
alter table public.shops add column if not exists whatsapp text;
alter table public.shops add column if not exists opening_hours text;
alter table public.shops add column if not exists about text;

-- ---------------------------------------------------------------------------
-- 2. platform_settings: public-readable 'features' and 'plans' rows (writes only via password RPC)
-- ---------------------------------------------------------------------------
drop policy if exists "platform pricing readable" on public.platform_settings;
create policy "platform pricing readable" on public.platform_settings
  for select to anon, authenticated using (id in ('pricing','features','plans'));

insert into public.platform_settings(id, settings) values
('features', '{
  "shop_boost":true,"product_boost":true,"discount":true,"flash":true,"nearby_first":true,"top_shop":true,
  "announcement":true,"new_stock":true,"coupon":true,"reward_wheel":true,"demand_alert":true,
  "broadcast":true,"competitor_price_insight":true,"wholesale_market_intelligence":true
}'::jsonb)
on conflict (id) do nothing;

insert into public.platform_settings(id, settings) values
('plans', '{
  "free":{"label":"Free","price":0,"max_shops":1},
  "multi_shop":{"label":"Multi-Shop","price":499,"max_shops":10},
  "business_pro":{"label":"Business Pro","price":4999,"max_shops":100}
}'::jsonb)
on conflict (id) do nothing;

-- Admin-only writer (same password check as admin_update_platform_pricing).
create or replace function public.admin_update_platform_setting(p_password text, p_id text, p_settings jsonb)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare v_hash text;
begin
  if p_id not in ('features','plans') then raise exception 'Unsupported setting id'; end if;
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' then raise exception 'Invalid settings'; end if;
  select pass_hash into v_hash from public.app_admin where id = 1;
  if v_hash is null or p_password is null or extensions.crypt(p_password, v_hash) <> v_hash then
    perform pg_sleep(1); return false;
  end if;
  insert into public.platform_settings(id, settings, updated_at) values (p_id, p_settings, now())
  on conflict (id) do update set settings = excluded.settings, updated_at = now();
  return true;
end $$;
revoke all on function public.admin_update_platform_setting(text,text,jsonb) from public;
grant execute on function public.admin_update_platform_setting(text,text,jsonb) to anon, authenticated;

-- A feature is ON unless the admin explicitly set it to false (missing key = ON).
create or replace function public.nearshop_feature_on(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select settings->>p_key from public.platform_settings where id = 'features'), 'true') <> 'false'
$$;
revoke all on function public.nearshop_feature_on(text) from public;
grant execute on function public.nearshop_feature_on(text) to anon, authenticated;

-- Server-side enforcement: broadcasts. (Old rows are never touched; only NEW inserts are blocked.)
create or replace function public.enforce_broadcast_feature()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.nearshop_feature_on('broadcast') then
    raise exception 'FEATURE_OFF: broadcast is currently disabled by admin';
  end if;
  return new;
end $$;
drop trigger if exists broadcasts_feature_flag on public.broadcasts;
create trigger broadcasts_feature_flag before insert on public.broadcasts
for each row execute function public.enforce_broadcast_feature();

-- Server-side enforcement: promotions / boosts / flash deals (stored in shops.promotion / products.promotion).
-- Only a NEW or CHANGED promotion with a disabled type is blocked. Clearing a promotion is always allowed.
create or replace function public.enforce_promotion_feature()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.promotion is distinct from old.promotion
     and new.promotion is not null and jsonb_typeof(new.promotion) = 'object'
     and new.promotion ? 'type'
     and not public.nearshop_feature_on(new.promotion->>'type') then
    raise exception 'FEATURE_OFF: % is currently disabled by admin', new.promotion->>'type';
  end if;
  return new;
end $$;
drop trigger if exists shops_promotion_feature_flag on public.shops;
create trigger shops_promotion_feature_flag before update of promotion on public.shops
for each row execute function public.enforce_promotion_feature();
drop trigger if exists products_promotion_feature_flag on public.products;
create trigger products_promotion_feature_flag before update of promotion on public.products
for each row execute function public.enforce_promotion_feature();

-- ---------------------------------------------------------------------------
-- 3. Subscriptions (admin-activated; there is NO payment gateway here, so nothing is auto-paid)
-- ---------------------------------------------------------------------------
create table if not exists public.owner_subscriptions (
  owner_id uuid primary key references public.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','multi_shop','business_pro')),
  status text not null default 'active' check (status in ('active','expired','cancelled')),
  valid_until timestamptz,
  activated_by text not null default 'admin',
  note text,
  updated_at timestamptz not null default now()
);
alter table public.owner_subscriptions enable row level security;
revoke all on public.owner_subscriptions from public, anon, authenticated;
grant select on public.owner_subscriptions to authenticated;
drop policy if exists owner_subscriptions_self_read on public.owner_subscriptions;
create policy owner_subscriptions_self_read on public.owner_subscriptions for select to authenticated
using (owner_id = public.current_nearshop_user_id());

create or replace function public.nearshop_owner_plan(p_owner uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select plan from public.owner_subscriptions
                   where owner_id = p_owner and status = 'active' and (valid_until is null or valid_until > now())), 'free')
$$;
create or replace function public.nearshop_plan_rank(p_plan text)
returns integer language sql immutable as $$
  select case p_plan when 'business_pro' then 2 when 'multi_shop' then 1 else 0 end
$$;
revoke all on function public.nearshop_owner_plan(uuid), public.nearshop_plan_rank(text) from public, anon;
grant execute on function public.nearshop_owner_plan(uuid), public.nearshop_plan_rank(text) to authenticated;

create or replace function public.admin_set_subscription(p_password text, p_owner_id uuid, p_plan text, p_valid_until timestamptz default null, p_note text default null)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare v_hash text;
begin
  if p_plan not in ('free','multi_shop','business_pro') then raise exception 'Invalid plan'; end if;
  select pass_hash into v_hash from public.app_admin where id = 1;
  if v_hash is null or p_password is null or extensions.crypt(p_password, v_hash) <> v_hash then
    perform pg_sleep(1); return false;
  end if;
  insert into public.owner_subscriptions(owner_id, plan, status, valid_until, note, updated_at)
  values (p_owner_id, p_plan, 'active', p_valid_until, p_note, now())
  on conflict (owner_id) do update set plan = excluded.plan, status = 'active',
    valid_until = excluded.valid_until, note = excluded.note, updated_at = now();
  return true;
end $$;
create or replace function public.admin_list_subscriptions(p_password text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_hash text;
begin
  select pass_hash into v_hash from public.app_admin where id = 1;
  if v_hash is null or p_password is null or extensions.crypt(p_password, v_hash) <> v_hash then
    perform pg_sleep(1); return null;
  end if;
  return coalesce((select jsonb_agg(to_jsonb(s)) from public.owner_subscriptions s), '[]'::jsonb);
end $$;
revoke all on function public.admin_set_subscription(text,uuid,text,timestamptz,text), public.admin_list_subscriptions(text) from public;
grant execute on function public.admin_set_subscription(text,uuid,text,timestamptz,text), public.admin_list_subscriptions(text) to anon, authenticated;

-- Shop-count limit per plan, enforced on the database. Existing shops are grandfathered (only new shops / new ownership count).
create or replace function public.enforce_plan_shop_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_plan text; v_max integer; v_count integer;
begin
  if new.owner_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.owner_id is not distinct from old.owner_id then return new; end if;
  v_plan := public.nearshop_owner_plan(new.owner_id);
  select coalesce((select (settings->v_plan->>'max_shops')::integer from public.platform_settings where id = 'plans'),
                  case v_plan when 'business_pro' then 100 when 'multi_shop' then 10 else 1 end) into v_max;
  select count(*) into v_count from public.shops where owner_id = new.owner_id and id is distinct from new.id;
  if v_count >= v_max then
    raise exception 'PLAN_SHOP_LIMIT: % plan allows % shop(s). Upgrade your plan to add more.', v_plan, v_max;
  end if;
  return new;
end $$;
drop trigger if exists shops_plan_limit on public.shops;
create trigger shops_plan_limit before insert or update of owner_id on public.shops
for each row execute function public.enforce_plan_shop_limit();

-- ---------------------------------------------------------------------------
-- 4. Staff: manager / employee with per-shop permissions (sell, inventory, reports)
-- ---------------------------------------------------------------------------
create table if not exists public.shop_staff (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('manager','employee')),
  permissions text[] not null default '{}'
    check (permissions <@ array['sell','inventory','reports']::text[]),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (shop_id, user_id)
);
create index if not exists shop_staff_user_idx on public.shop_staff(user_id) where revoked_at is null;
alter table public.shop_staff enable row level security;
revoke all on public.shop_staff from public, anon, authenticated;
grant select on public.shop_staff to authenticated;   -- writes only through the RPCs below
drop policy if exists shop_staff_read on public.shop_staff;
create policy shop_staff_read on public.shop_staff for select to authenticated
using (user_id = public.current_nearshop_user_id() or public.nearshop_owns_shop(shop_id));

-- Single authorization primitive: owner always; staff only with an active row, the permission,
-- and only while the owner's plan is Business Pro.
create or replace function public.nearshop_can(p_shop_id uuid, p_perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.nearshop_owns_shop(p_shop_id) or exists (
    select 1 from public.shop_staff st join public.shops s on s.id = st.shop_id
    where st.shop_id = p_shop_id and st.user_id = public.current_nearshop_user_id()
      and st.revoked_at is null and p_perm = any(st.permissions)
      and public.nearshop_plan_rank(public.nearshop_owner_plan(s.owner_id)) >= 2)
$$;
revoke all on function public.nearshop_can(uuid,text) from public, anon;
grant execute on function public.nearshop_can(uuid,text) to authenticated;

create or replace function public.owner_set_staff(p_shop_id uuid, p_username text, p_role text, p_permissions text[])
returns uuid language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_user uuid; v_id uuid; v_perms text[];
begin
  select owner_id into v_owner from public.shops where id = p_shop_id;
  if v_owner is null or v_owner <> public.current_nearshop_user_id() then raise exception 'NOT_OWNER'; end if;
  if public.nearshop_plan_rank(public.nearshop_owner_plan(v_owner)) < 2 then
    raise exception 'PLAN_REQUIRED: staff access needs Business Pro';
  end if;
  if p_role not in ('manager','employee') then raise exception 'Invalid role'; end if;
  select id into v_user from public.users where username = lower(trim(p_username));
  if v_user is null then raise exception 'USER_NOT_FOUND'; end if;
  if v_user = v_owner then raise exception 'Owner ko staff nahi bana sakte'; end if;
  v_perms := case when p_role = 'manager' and coalesce(array_length(p_permissions,1),0) = 0
                  then array['sell','inventory','reports'] else coalesce(p_permissions, '{}') end;
  insert into public.shop_staff(shop_id, user_id, role, permissions, created_by)
  values (p_shop_id, v_user, p_role, v_perms, v_owner)
  on conflict (shop_id, user_id) do update set role = excluded.role, permissions = excluded.permissions, revoked_at = null
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.owner_revoke_staff(p_staff_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.shop_staff st set revoked_at = now()
  where st.id = p_staff_id and public.nearshop_owns_shop(st.shop_id);
  if not found then raise exception 'NOT_OWNER_OR_NOT_FOUND'; end if;
end $$;

create or replace function public.owner_list_staff(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.nearshop_owns_shop(p_shop_id) then raise exception 'NOT_OWNER'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', st.id, 'user_id', st.user_id, 'name', u.name, 'username', u.username,
            'role', st.role, 'permissions', st.permissions, 'revoked_at', st.revoked_at) order by st.created_at)
          from public.shop_staff st join public.users u on u.id = st.user_id where st.shop_id = p_shop_id), '[]'::jsonb);
end $$;
revoke all on function public.owner_set_staff(uuid,text,text,text[]), public.owner_revoke_staff(uuid), public.owner_list_staff(uuid) from public, anon;
grant execute on function public.owner_set_staff(uuid,text,text,text[]), public.owner_revoke_staff(uuid), public.owner_list_staff(uuid) to authenticated;

-- Additive staff policies (owner policies stay exactly as they are).
drop policy if exists products_staff_read on public.products;
create policy products_staff_read on public.products for select to authenticated
using (public.nearshop_can(shop_id,'inventory') or public.nearshop_can(shop_id,'sell'));
drop policy if exists products_staff_insert on public.products;
create policy products_staff_insert on public.products for insert to authenticated
with check (public.nearshop_can(shop_id,'inventory'));
drop policy if exists products_staff_update on public.products;
create policy products_staff_update on public.products for update to authenticated
using (public.nearshop_can(shop_id,'inventory')) with check (public.nearshop_can(shop_id,'inventory'));
drop policy if exists bills_staff_read on public.bills;
create policy bills_staff_read on public.bills for select to authenticated
using (public.nearshop_can(shop_id,'sell') or public.nearshop_can(shop_id,'reports'));
drop policy if exists sales_log_staff_read on public.sales_log;
create policy sales_log_staff_read on public.sales_log for select to authenticated
using (shop_id is not null and public.nearshop_can(shop_id,'reports'));

-- ---------------------------------------------------------------------------
-- 5. Idempotent, permission-checked sale RPCs
--    complete_sale gains p_request_id (double-tap / retry safe) and becomes SECURITY DEFINER with an explicit
--    nearshop_can(shop,'sell') check, so staff never need broad table write policies.
-- ---------------------------------------------------------------------------
alter table public.bills add column if not exists request_id uuid;
create unique index if not exists bills_shop_request_key on public.bills (shop_id, request_id) where request_id is not null;

drop function if exists public.complete_sale(uuid,jsonb,text,uuid,text,text,numeric,numeric,numeric,numeric,text);
create or replace function public.complete_sale(
  p_shop_id uuid, p_items jsonb, p_payment text default 'paid',
  p_customer_id uuid default null, p_customer_label text default null, p_customer_phone text default null,
  p_subtotal numeric default 0, p_discount_pct numeric default 0, p_discount_amount numeric default 0,
  p_total numeric default 0, p_note text default null, p_request_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_bill uuid := gen_random_uuid();
  v_shop record; v_item jsonb; v_rows int; v_qty numeric; v_existing uuid;
begin
  if not public.nearshop_can(p_shop_id, 'sell') then raise exception 'NOT_ALLOWED: sell permission required'; end if;
  if p_request_id is not null then
    select id into v_existing from public.bills where shop_id = p_shop_id and request_id = p_request_id;
    if v_existing is not null then return v_existing; end if;   -- duplicate submission: return the original bill
  end if;
  if p_payment not in ('paid','udhar') then raise exception 'Invalid payment type'; end if;
  if p_payment = 'udhar' and p_customer_id is null and coalesce(trim(p_customer_label),'') = '' then
    raise exception 'Udhar ke liye customer chahiye';
  end if;
  select area, city, state, country, category into v_shop from public.shops where id = p_shop_id;
  if not found then raise exception 'Dukaan nahi mili'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'Cart khali hai'; end if;

  insert into public.bills (id, shop_id, payment_type, customer_id, customer_label, subtotal, discount_pct, discount_amount, total, items, request_id)
  values (v_bill, p_shop_id, p_payment, p_customer_id, p_customer_label, p_subtotal, p_discount_pct, p_discount_amount, p_total, p_items, p_request_id);

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'sold_qty')::numeric;
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
revoke all on function public.complete_sale(uuid,jsonb,text,uuid,text,text,numeric,numeric,numeric,numeric,text,uuid) from public, anon;
grant execute on function public.complete_sale(uuid,jsonb,text,uuid,text,text,numeric,numeric,numeric,numeric,text,uuid) to authenticated;

create or replace function public.void_sale(p_bill_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare b record; it jsonb;
begin
  select * into b from public.bills where id = p_bill_id for update;
  if not found then raise exception 'Bill nahi mila'; end if;
  if not public.nearshop_can(b.shop_id, 'sell') then raise exception 'NOT_ALLOWED: sell permission required'; end if;
  if b.voided_at is not null then raise exception 'Ye bill pehle hi undo ho chuka hai'; end if;
  if b.created_at < now() - interval '15 minutes' then raise exception 'UNDO_EXPIRED'; end if;
  for it in select * from jsonb_array_elements(b.items) loop
    update public.products set stock = round((stock + (it->>'sold_qty')::numeric)::numeric, 3), last_updated = now()
     where id = (it->>'product_id')::uuid and shop_id = b.shop_id;
  end loop;
  delete from public.sales_log where bill_id = p_bill_id;
  delete from public.khata_entries where bill_id = p_bill_id;
  update public.bills set voided_at = now() where id = p_bill_id;
end $$;
revoke all on function public.void_sale(uuid) from public, anon;
grant execute on function public.void_sale(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Owner combined dashboard (owner-only, plan-gated, aggregate-only: no customer identity leaves the DB)
--    free        -> PLAN_REQUIRED
--    multi_shop  -> totals, shop-wise performance, pending udhar, stock-alert counts, top 5 sellers
--    business_pro-> + full best/slow-moving, daily series, search-demand insights (k>=5 distinct searchers)
-- ---------------------------------------------------------------------------
create or replace function public.owner_business_overview(p_from timestamptz default null, p_to timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := public.current_nearshop_user_id();
  v_rank integer; v_plan text;
  v_from timestamptz := coalesce(p_from, now() - interval '30 days');
  v_to timestamptz := coalesce(p_to, now());
  v_out jsonb;
begin
  if v_uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  v_plan := public.nearshop_owner_plan(v_uid);
  v_rank := public.nearshop_plan_rank(v_plan);
  if v_rank < 1 then raise exception 'PLAN_REQUIRED: combined dashboard needs Multi-Shop or Business Pro'; end if;

  v_out := jsonb_build_object('plan', v_plan, 'from', v_from, 'to', v_to);

  v_out := v_out || jsonb_build_object('shops', coalesce((
    select jsonb_agg(jsonb_build_object(
      'shop_id', s.id, 'name', s.name, 'area', s.area, 'category', s.category,
      'products', (select count(*) from public.products p where p.shop_id = s.id and p.archived_at is null),
      'low_stock', (select count(*) from public.products p where p.shop_id = s.id and p.archived_at is null and p.stock <= 3),
      'revenue', coalesce((select sum(l.revenue) from public.sales_log l where l.shop_id = s.id and l.created_at >= v_from and l.created_at <= v_to), 0),
      'bills', (select count(*) from public.bills b where b.shop_id = s.id and b.voided_at is null and b.created_at >= v_from and b.created_at <= v_to),
      'pending_udhar', coalesce((select sum(case k.kind when 'udhar' then k.amount when 'payment' then -k.amount else 0 end)
                                 from public.khata_entries k where k.shop_id = s.id and k.status <> 'disputed'), 0)
    ) order by s.name) from public.shops s where s.owner_id = v_uid), '[]'::jsonb));

  v_out := v_out || jsonb_build_object('best_sellers', coalesce((
    select jsonb_agg(x) from (
      select l.product_name as name, sum(l.qty) as qty, sum(l.revenue) as revenue, count(distinct l.shop_id) as shops
      from public.sales_log l join public.shops s on s.id = l.shop_id
      where s.owner_id = v_uid and l.created_at >= v_from and l.created_at <= v_to
      group by l.product_name order by sum(l.revenue) desc limit case when v_rank >= 2 then 15 else 5 end) x), '[]'::jsonb));

  if v_rank >= 2 then
    v_out := v_out || jsonb_build_object(
      'slow_moving', coalesce((select jsonb_agg(x) from (
        select p.name, s.name as shop, p.stock
        from public.products p join public.shops s on s.id = p.shop_id
        where s.owner_id = v_uid and p.archived_at is null and p.stock > 0
          and not exists (select 1 from public.sales_log l where l.shop_id = p.shop_id and l.product_name = p.name
                          and l.created_at >= v_from and l.created_at <= v_to)
        order by p.stock desc limit 20) x), '[]'::jsonb),
      'stock_alerts', coalesce((select jsonb_agg(x) from (
        select p.name, s.name as shop, p.stock
        from public.products p join public.shops s on s.id = p.shop_id
        where s.owner_id = v_uid and p.archived_at is null and p.stock <= 3
        order by p.stock asc limit 30) x), '[]'::jsonb),
      'daily', coalesce((select jsonb_agg(x) from (
        select (l.created_at at time zone 'Asia/Kolkata')::date as day, l.shop_id, sum(l.revenue) as revenue
        from public.sales_log l join public.shops s on s.id = l.shop_id
        where s.owner_id = v_uid and l.created_at >= v_from and l.created_at <= v_to
        group by 1, 2 order by 1) x), '[]'::jsonb),
      -- Search demand: only areas/categories of the owner's own shops, grouped, with >=5 distinct searchers. No customer ids returned.
      'search_demand', coalesce((select jsonb_agg(x) from (
        select lower(trim(e.query)) as query, e.category, e.area, count(*)::integer as searches,
               count(distinct e.customer_id)::integer as searchers
        from public.search_events e
        where e.created_at >= v_from and e.created_at <= v_to and coalesce(trim(e.query),'') <> ''
          and e.customer_id is not null and e.customer_id <> ''
          and (e.area in (select s.area from public.shops s where s.owner_id = v_uid)
               or e.category in (select s.category from public.shops s where s.owner_id = v_uid))
        group by 1, 2, 3 having count(distinct e.customer_id) >= 5
        order by count(*) desc limit 20) x), '[]'::jsonb));
  end if;
  return v_out;
end $$;
revoke all on function public.owner_business_overview(timestamptz,timestamptz) from public, anon;
grant execute on function public.owner_business_overview(timestamptz,timestamptz) to authenticated;
