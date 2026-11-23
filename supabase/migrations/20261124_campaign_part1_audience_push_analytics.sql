-- NearShop Campaign Part 1: real audience targeting, product link, analytics, push device tokens, WhatsApp prep.
-- Run AFTER 20261119, 20261121_campaign_fix and 20261123_campaign_delivery_security.
-- Orders / stock deduction / coupon checkout are NOT in this migration (no order module exists yet).

-- ---------- 1. Product link (real NearShop product, no duplicate record) ----------
alter table public.admin_campaigns
  add column if not exists shop_id uuid references public.shops(id) on delete set null,
  add column if not exists product_id uuid references public.products(id) on delete set null,
  add column if not exists push_sent_at timestamptz;

-- ---------- 2. Audience data ----------
create table if not exists public.user_audience_profile (
  user_id uuid primary key references public.users(id) on delete cascade,
  city text, state text, updated_at timestamptz not null default now()
);
alter table public.user_audience_profile enable row level security;
revoke all on public.user_audience_profile from public, anon, authenticated;

create table if not exists public.admin_campaign_targets (
  campaign_id uuid not null references public.admin_campaigns(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  primary key (campaign_id, user_id)
);
alter table public.admin_campaign_targets enable row level security;
revoke all on public.admin_campaign_targets from public, anon, authenticated;

create or replace function public.set_my_audience(p_city text, p_state text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public.current_nearshop_user_id();
begin
  if v_uid is null then return; end if;
  insert into public.user_audience_profile(user_id, city, state, updated_at)
  values (v_uid, nullif(left(trim(coalesce(p_city,'')),80),''), nullif(left(trim(coalesce(p_state,'')),80),''), now())
  on conflict (user_id) do update set city = excluded.city, state = excluded.state, updated_at = now();
end $$;

-- One place that decides "does this user belong to this campaign's audience".
create or replace function public.campaign_matches_user(c public.admin_campaigns, p_uid uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_owner boolean; v_ok boolean := false;
begin
  if c.audience_type = 'all' then return true; end if;
  if p_uid is null then return false; end if;
  v_owner := exists (select 1 from public.shops s where s.owner_id = p_uid)
          or exists (select 1 from public.shop_staff st where st.user_id = p_uid and st.revoked_at is null);
  if c.audience_type = 'customers' then return not v_owner; end if;
  if c.audience_type = 'shopkeepers' then return v_owner; end if;
  if c.audience_type = 'selected' then
    return exists (select 1 from public.admin_campaign_targets t where t.campaign_id = c.id and t.user_id = p_uid);
  end if;
  if c.audience_type = 'category' then
    return exists (select 1 from public.shops s where s.owner_id = p_uid and lower(coalesce(s.category,'')) = lower(coalesce(c.audience_category,'')))
        or exists (select 1 from public.shop_staff st join public.shops s on s.id = st.shop_id
                   where st.user_id = p_uid and st.revoked_at is null and lower(coalesce(s.category,'')) = lower(coalesce(c.audience_category,'')))
        or exists (select 1 from public.feed_follows f join public.shops s on s.id = f.shop_id
                   where f.user_id = p_uid and lower(coalesce(s.category,'')) = lower(coalesce(c.audience_category,'')));
  end if;
  if c.audience_type = 'city' then
    return exists (select 1 from public.user_audience_profile a where a.user_id = p_uid and lower(coalesce(a.city,'')) = lower(coalesce(c.audience_city,'')))
        or exists (select 1 from public.shops s where s.owner_id = p_uid and lower(coalesce(s.city,'')) = lower(coalesce(c.audience_city,'')));
  end if;
  if c.audience_type = 'state' then
    return exists (select 1 from public.user_audience_profile a where a.user_id = p_uid and lower(coalesce(a.state,'')) = lower(coalesce(c.audience_state,'')))
        or exists (select 1 from public.shops s where s.owner_id = p_uid and lower(coalesce(s.state,'')) = lower(coalesce(c.audience_state,'')));
  end if;
  return false;
end $$;

-- ---------- 3. Delivery + analytics ----------
create table if not exists public.campaign_events (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.admin_campaigns(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  event text not null check (event in ('view','click','product_open','order','conversion')),
  amount numeric(12,2),
  order_ref text,
  created_at timestamptz not null default now()
);
create index if not exists campaign_events_c_idx on public.campaign_events(campaign_id, event);
alter table public.campaign_events enable row level security;
revoke all on public.campaign_events from public, anon, authenticated;

create or replace function public.live_admin_campaigns()
returns setof public.admin_campaigns language sql stable security definer set search_path = public as $$
  select c.* from public.admin_campaigns c
  where c.status = 'published' and c.in_app_enabled = true and c.start_at <= now()
    and (c.end_at is null or c.end_at > now())
    and public.campaign_matches_user(c, public.current_nearshop_user_id())
  order by c.created_at desc limit 100
$$;

create or replace function public.track_admin_campaign(p_id uuid, p_event text)
returns void language plpgsql security definer set search_path = public as $$
declare c public.admin_campaigns; v_uid uuid := public.current_nearshop_user_id();
begin
  if p_event not in ('view','click','product_open') then return; end if;
  select * into c from public.admin_campaigns where id = p_id;
  if not found or c.status <> 'published' or not c.in_app_enabled or c.start_at > now()
     or (c.end_at is not null and c.end_at <= now()) or not public.campaign_matches_user(c, v_uid) then return; end if;
  -- one view per user per day; anonymous views are always counted
  if p_event = 'view' and v_uid is not null and exists (
    select 1 from public.campaign_events e where e.campaign_id = p_id and e.user_id = v_uid and e.event = 'view' and e.created_at > now() - interval '1 day'
  ) then return; end if;
  insert into public.campaign_events(campaign_id, user_id, event) values (p_id, v_uid, p_event);
  update public.admin_campaigns set
    impressions = impressions + case when p_event = 'view' then 1 else 0 end,
    clicks = clicks + case when p_event in ('click','product_open') then 1 else 0 end
  where id = p_id;
end $$;

-- For the future Orders module: server (service_role) records a purchase that came from a campaign.
create or replace function public.record_campaign_conversion(p_campaign uuid, p_user uuid, p_amount numeric, p_order_ref text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.campaign_events(campaign_id, user_id, event, amount, order_ref) values (p_campaign, p_user, 'order', p_amount, p_order_ref);
  update public.admin_campaigns set redemptions = redemptions + 1 where id = p_campaign;
end $$;

create or replace function public.admin_campaign_analytics(p_password text)
returns table(campaign_id uuid, views bigint, unique_viewers bigint, clicks bigint, product_opens bigint, orders bigint, revenue numeric, ctr numeric, conversion_rate numeric)
language plpgsql security definer set search_path = public as $$
begin
  if not public.nearshop_admin_ok(p_password) then raise exception 'Admin verification failed'; end if;
  return query
  select c.id,
    count(*) filter (where e.event='view'),
    count(distinct e.user_id) filter (where e.event='view'),
    count(*) filter (where e.event='click'),
    count(*) filter (where e.event='product_open'),
    count(*) filter (where e.event in ('order','conversion')),
    coalesce(sum(e.amount) filter (where e.event in ('order','conversion')),0),
    round(100.0 * count(*) filter (where e.event in ('click','product_open')) / nullif(count(*) filter (where e.event='view'),0), 1),
    round(100.0 * count(*) filter (where e.event in ('order','conversion')) / nullif(count(*) filter (where e.event in ('click','product_open')),0), 1)
  from public.admin_campaigns c left join public.campaign_events e on e.campaign_id = c.id
  group by c.id;
end $$;

-- ---------- 4. Admin: product link + selected users ----------
create or replace function public.admin_set_campaign_product(p_password text, p_campaign uuid, p_shop uuid, p_product uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare p public.products;
begin
  if not public.nearshop_admin_ok(p_password) then raise exception 'Admin verification failed'; end if;
  if p_product is null then
    update public.admin_campaigns set shop_id = null, product_id = null, updated_at = now() where id = p_campaign;
    return true;
  end if;
  select * into p from public.products where id = p_product and shop_id = p_shop;
  if not found then raise exception 'Product us shop ka nahi hai ya mila nahi'; end if;
  update public.admin_campaigns set shop_id = p_shop, product_id = p_product, updated_at = now() where id = p_campaign;
  return true;
end $$;

-- identifiers: phone number or @username. Returns how many matched and which were not found.
create or replace function public.admin_set_campaign_targets(p_password text, p_campaign uuid, p_identifiers text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare i text; v_id uuid; v_ok int := 0; v_missing text[] := '{}';
begin
  if not public.nearshop_admin_ok(p_password) then raise exception 'Admin verification failed'; end if;
  delete from public.admin_campaign_targets where campaign_id = p_campaign;
  foreach i in array coalesce(p_identifiers,'{}') loop
    i := trim(i); continue when i = '';
    select u.id into v_id from public.users u
      where u.phone = regexp_replace(i,'[^0-9]','','g') or lower(u.username) = lower(ltrim(i,'@')) limit 1;
    if v_id is null then v_missing := v_missing || i;
    else insert into public.admin_campaign_targets values (p_campaign, v_id) on conflict do nothing; v_ok := v_ok + 1; end if;
  end loop;
  return jsonb_build_object('matched', v_ok, 'missing', v_missing);
end $$;

create or replace function public.admin_get_campaign_targets(p_password text, p_campaign uuid)
returns text[] language plpgsql security definer set search_path = public as $$
begin
  if not public.nearshop_admin_ok(p_password) then raise exception 'Admin verification failed'; end if;
  return coalesce((select array_agg(coalesce('@'||u.username, u.phone)) from public.admin_campaign_targets t join public.users u on u.id = t.user_id where t.campaign_id = p_campaign), '{}');
end $$;

-- ---------- 5. Push notification device tokens ----------
create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token text not null unique,
  platform text not null default 'web',
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists user_devices_user_idx on public.user_devices(user_id) where revoked_at is null;
alter table public.user_devices enable row level security;
revoke all on public.user_devices from public, anon, authenticated;

create or replace function public.register_device_token(p_token text, p_platform text default 'web')
returns boolean language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public.current_nearshop_user_id();
begin
  if v_uid is null or p_token is null or char_length(p_token) < 20 or char_length(p_token) > 4096 then return false; end if;
  insert into public.user_devices(user_id, token, platform) values (v_uid, p_token, left(coalesce(p_platform,'web'),20))
  on conflict (token) do update set user_id = v_uid, last_seen = now(), revoked_at = null;
  return true;
end $$;

create or replace function public.unregister_device_token(p_token text)
returns void language sql security definer set search_path = public as $$
  update public.user_devices set revoked_at = now() where token = p_token and user_id = public.current_nearshop_user_id()
$$;

-- Used ONLY by the send-campaign-push Edge Function (service_role).
create or replace function public.campaign_push_targets(p_campaign uuid)
returns table(token text) language sql security definer set search_path = public as $$
  select distinct d.token from public.user_devices d
  join public.admin_campaigns c on c.id = p_campaign
  where d.revoked_at is null and c.push_enabled and public.campaign_matches_user(c, d.user_id)
$$;
create or replace function public.campaign_push_done(p_campaign uuid, p_dead text[])
returns void language sql security definer set search_path = public as $$
  update public.user_devices set revoked_at = now() where token = any(coalesce(p_dead,'{}'));
  update public.admin_campaigns set push_sent_at = now() where id = p_campaign;
$$;

-- ---------- 6. WhatsApp Business API preparation (no sending yet) ----------
create table if not exists public.whatsapp_optins (
  user_id uuid primary key references public.users(id) on delete cascade,
  phone text not null check (phone ~ '^[0-9]{10,15}$'),
  opted_in boolean not null default true,
  opted_at timestamptz not null default now(),
  source text not null default 'app'
);
create table if not exists public.whatsapp_outbox (
  id bigint generated always as identity primary key,
  campaign_id uuid references public.admin_campaigns(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  phone text not null,
  template_name text not null,
  status text not null default 'queued' check (status in ('queued','sent','delivered','read','failed')),
  provider_message_id text, error text,
  created_at timestamptz not null default now()
);
alter table public.whatsapp_optins enable row level security;
alter table public.whatsapp_outbox enable row level security;
revoke all on public.whatsapp_optins, public.whatsapp_outbox from public, anon, authenticated;

create or replace function public.set_whatsapp_optin(p_phone text, p_opt boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public.current_nearshop_user_id(); v_p text := regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
begin
  if v_uid is null then return false; end if;
  if char_length(v_p) = 10 then v_p := '91' || v_p; end if;
  if v_p !~ '^[0-9]{10,15}$' then return false; end if;
  insert into public.whatsapp_optins(user_id, phone, opted_in, opted_at) values (v_uid, v_p, coalesce(p_opt,true), now())
  on conflict (user_id) do update set phone = excluded.phone, opted_in = excluded.opted_in, opted_at = now();
  return true;
end $$;

-- ---------- 7. Grants ----------
revoke all on function public.campaign_matches_user(public.admin_campaigns, uuid), public.record_campaign_conversion(uuid,uuid,numeric,text),
  public.campaign_push_targets(uuid), public.campaign_push_done(uuid,text[]) from public, anon, authenticated;
grant execute on function public.set_my_audience(text,text), public.register_device_token(text,text),
  public.unregister_device_token(text), public.set_whatsapp_optin(text,boolean) to authenticated;
grant execute on function public.live_admin_campaigns(), public.track_admin_campaign(uuid,text) to anon, authenticated;
grant execute on function public.admin_campaign_analytics(text), public.admin_set_campaign_product(text,uuid,uuid,uuid),
  public.admin_set_campaign_targets(text,uuid,text[]), public.admin_get_campaign_targets(text,uuid) to anon, authenticated;
grant execute on function public.campaign_matches_user(public.admin_campaigns, uuid), public.record_campaign_conversion(uuid,uuid,numeric,text),
  public.campaign_push_targets(uuid), public.campaign_push_done(uuid,text[]) to service_role;
