-- NearShop ownership-scoped RLS and admin RPC bridge.
-- Apply only after reviewing AUDIT_PATCH_NOTES.md. Safe to re-run.

create or replace function public.current_nearshop_user_id()
returns uuid language sql stable security definer set search_path = public
as $$ select u.id from public.users u where u.auth_id = auth.uid() limit 1 $$;

create or replace function public.nearshop_owns_shop(p_shop_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.shops s where s.id = p_shop_id and s.owner_id = public.current_nearshop_user_id()) $$;

create or replace function public.get_shop_khata_profiles(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if not public.nearshop_owns_shop(p_shop_id) then return null; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id',u.id,'name',u.name,'username',u.username,'phone',u.phone))
    from public.users u
    where exists (select 1 from public.khata_links k where k.shop_id=p_shop_id and k.customer_id=u.id)
       or exists (select 1 from public.khata_entries e where e.shop_id=p_shop_id and e.customer_id=u.id)
  ), '[]'::jsonb);
end $$;

create or replace function public.find_user_by_username(p_username text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare r public.users;
begin
  select * into r from public.users where lower(username)=lower(trim(p_username)) limit 1;
  if not found or coalesce(r.is_blocked,false) then return null; end if;
  return jsonb_build_object('id',r.id,'name',r.name,'username',r.username);
end $$;

create or replace function public.nearshop_can_see_bid(p_bid_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.bids b where b.id = p_bid_id and b.customer_id = public.current_nearshop_user_id())
      or exists (select 1 from public.bid_offers o where o.bid_id = p_bid_id and public.nearshop_owns_shop(o.shop_id));
$$;

-- Remove legacy allow-everyone policies from tables that now receive explicit rules.
do $$
declare t text; p record;
begin
  foreach t in array array['users','shops','products','bills','sales_log','khata_entries','khata_links','broadcasts','bids','bid_offers','need_requests','need_responses','feed_posts','reviews','search_events','price_alerts','promotion_events','medicine_catalogue','deal_interests','blocked_entities','data_licenses','emergency_services'] loop
    if to_regclass('public.'||t) is not null then
      for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
        execute format('drop policy if exists %I on public.%I', p.policyname, t);
      end loop;
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

-- Revoke inherited wide grants first. RLS does not protect TRUNCATE.
revoke all on public.users, public.shops, public.products, public.bills, public.sales_log,
  public.khata_entries, public.khata_links, public.broadcasts, public.bids, public.bid_offers,
  public.need_requests, public.need_responses, public.feed_posts, public.reviews,
  public.search_events, public.price_alerts, public.promotion_events, public.medicine_catalogue,
  public.deal_interests, public.blocked_entities, public.data_licenses, public.app_admin, public.emergency_services
from public, anon, authenticated;

-- Public discovery data. Owners can see/edit their private/hidden rows.
grant select on public.shops, public.products, public.reviews, public.feed_posts, public.broadcasts to anon, authenticated;
grant insert, update, delete on public.shops, public.products, public.feed_posts, public.broadcasts to authenticated;
grant insert on public.reviews to authenticated;

grant select on public.users to authenticated;
revoke insert, update on public.users from authenticated;
grant insert (auth_id,email,name,avatar_url,referral_code) on public.users to authenticated;
grant update (auth_id,phone,name,username,avatar_url) on public.users to authenticated;
create table if not exists public.user_point_awards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  points integer not null check (points > 0),
  source text not null,
  created_at timestamptz not null default now()
);
alter table public.user_point_awards enable row level security;
revoke all on public.user_point_awards from public, anon, authenticated;
create index if not exists user_point_awards_user_day_idx on public.user_point_awards(user_id, created_at desc);

grant select, insert, update, delete on public.bills, public.sales_log, public.khata_entries,
  public.khata_links, public.bids, public.bid_offers, public.need_requests, public.need_responses,
  public.search_events, public.price_alerts, public.promotion_events, public.deal_interests,
  public.medicine_catalogue to authenticated;
grant select on public.medicine_catalogue, public.emergency_services to anon, authenticated;
grant insert on public.emergency_services to authenticated;
grant select on public.platform_settings to anon, authenticated;
revoke all on public.platform_settings from public, anon, authenticated;
grant select on public.platform_settings to anon, authenticated;
revoke all on public.blocked_entities, public.data_licenses, public.app_admin from anon, authenticated;

-- Users: own row only; legacy Google-email linking can see only the matching unlinked email row.
drop policy if exists users_select_self on public.users;
create policy users_select_self on public.users for select to authenticated
using (auth_id = auth.uid() or (auth_id is null and lower(email) = lower(auth.jwt()->>'email')));
create policy users_insert_self on public.users for insert to authenticated
with check (auth_id = auth.uid());
create policy users_update_self on public.users for update to authenticated
using (auth_id = auth.uid() or (auth_id is null and lower(email) = lower(auth.jwt()->>'email')))
with check (auth_id = auth.uid());

-- Shops and products: public sees active public listings; owners manage their own inventory.
create policy shops_public_read on public.shops for select to anon, authenticated using (coalesce(is_blocked,false)=false);
create policy shops_owner_all on public.shops for all to authenticated
using (owner_id = public.current_nearshop_user_id())
with check (owner_id = public.current_nearshop_user_id());
create policy products_public_read on public.products for select to anon, authenticated using (
  archived_at is null and coalesce(visibility_mode,'public') <> 'hidden'
  and exists (select 1 from public.shops s where s.id=products.shop_id and coalesce(s.is_blocked,false)=false and coalesce(s.product_visibility_mode,'public') <> 'disabled')
);
create policy products_owner_all on public.products for all to authenticated
using (public.nearshop_owns_shop(shop_id)) with check (public.nearshop_owns_shop(shop_id));

-- Customer and shop-owner records.
create policy bills_shop_owner_read on public.bills for select to authenticated using (public.nearshop_owns_shop(shop_id));
create policy bills_shop_owner_insert on public.bills for insert to authenticated with check (public.nearshop_owns_shop(shop_id));
create policy bills_shop_owner_update on public.bills for update to authenticated using (public.nearshop_owns_shop(shop_id)) with check (public.nearshop_owns_shop(shop_id));
create policy bills_shop_owner_delete on public.bills for delete to authenticated using (public.nearshop_owns_shop(shop_id));
create policy sales_log_shop_owner_read on public.sales_log for select to authenticated using (public.nearshop_owns_shop(shop_id));
create policy sales_log_shop_owner_insert on public.sales_log for insert to authenticated with check (shop_id is not null and public.nearshop_owns_shop(shop_id));
create policy sales_log_shop_owner_delete on public.sales_log for delete to authenticated using (shop_id is not null and public.nearshop_owns_shop(shop_id));
create policy khata_entries_party_read on public.khata_entries for select to authenticated
using (public.nearshop_owns_shop(shop_id) or customer_id = public.current_nearshop_user_id());
create policy khata_entries_party_insert on public.khata_entries for insert to authenticated
with check (public.nearshop_owns_shop(shop_id) or (customer_id = public.current_nearshop_user_id() and party = 'shop'));
create policy khata_entries_party_update on public.khata_entries for update to authenticated
using (public.nearshop_owns_shop(shop_id) or customer_id = public.current_nearshop_user_id())
with check (public.nearshop_owns_shop(shop_id) or customer_id = public.current_nearshop_user_id());
create policy khata_entries_shop_delete on public.khata_entries for delete to authenticated using (public.nearshop_owns_shop(shop_id));
create policy khata_links_party_read on public.khata_links for select to authenticated
using (customer_id = public.current_nearshop_user_id() or public.nearshop_owns_shop(shop_id));
create policy khata_links_party_insert on public.khata_links for insert to authenticated
with check (customer_id = public.current_nearshop_user_id() or public.nearshop_owns_shop(shop_id));
create policy khata_links_shop_update on public.khata_links for update to authenticated
using (customer_id = public.current_nearshop_user_id() or public.nearshop_owns_shop(shop_id))
with check (customer_id = public.current_nearshop_user_id() or public.nearshop_owns_shop(shop_id));
create policy khata_links_shop_delete on public.khata_links for delete to authenticated
using (public.nearshop_owns_shop(shop_id));

-- Broadcasts are public only while live; only the owning shop can publish/change them.
create policy broadcasts_public_live_read on public.broadcasts for select to anon, authenticated
using (expires_at > now() and status in ('active','mock_paid','paid'));
create policy broadcasts_owner_insert on public.broadcasts for insert to authenticated
with check (public.nearshop_owns_shop(shop_id));
create policy broadcasts_owner_update on public.broadcasts for update to authenticated
using (public.nearshop_owns_shop(shop_id)) with check (public.nearshop_owns_shop(shop_id));
create policy broadcasts_owner_delete on public.broadcasts for delete to authenticated
using (public.nearshop_owns_shop(shop_id));

-- Bids are visible to their customer and shops that have submitted an offer.
create policy bids_related_read on public.bids for select to authenticated using (public.nearshop_can_see_bid(id));
create policy bids_customer_insert on public.bids for insert to authenticated
with check (customer_id = public.current_nearshop_user_id());
create policy bids_customer_update on public.bids for update to authenticated
using (customer_id = public.current_nearshop_user_id()) with check (customer_id = public.current_nearshop_user_id());
create policy bid_offers_related_read on public.bid_offers for select to authenticated
using (public.nearshop_owns_shop(shop_id) or public.nearshop_can_see_bid(bid_id));
create policy bid_offers_shop_insert on public.bid_offers for insert to authenticated
with check (public.nearshop_owns_shop(shop_id));
create policy bid_offers_shop_update on public.bid_offers for update to authenticated
using (public.nearshop_owns_shop(shop_id)) with check (public.nearshop_owns_shop(shop_id));

-- Need It: customer owns request; signed-in shopkeepers can discover open requests.
create policy need_requests_read on public.need_requests for select to authenticated
using (customer_id = public.current_nearshop_user_id() or status in ('open','claimed','coming'));
create policy need_requests_insert on public.need_requests for insert to authenticated
with check (customer_id = public.current_nearshop_user_id());
create policy need_requests_customer_update on public.need_requests for update to authenticated
using (customer_id = public.current_nearshop_user_id()) with check (customer_id = public.current_nearshop_user_id());
create policy need_responses_read on public.need_responses for select to authenticated
using (public.nearshop_owns_shop(shop_id) or exists (select 1 from public.need_requests r where r.id=request_id and r.customer_id=public.current_nearshop_user_id()));
create policy need_responses_shop_insert on public.need_responses for insert to authenticated
with check (public.nearshop_owns_shop(shop_id));
create policy need_responses_shop_update on public.need_responses for update to authenticated
using (public.nearshop_owns_shop(shop_id) or exists (select 1 from public.need_requests r where r.id=request_id and r.customer_id=public.current_nearshop_user_id()))
with check (public.nearshop_owns_shop(shop_id) or exists (select 1 from public.need_requests r where r.id=request_id and r.customer_id=public.current_nearshop_user_id()));

-- Public feed and reviews; only authenticated users may submit.
create policy feed_posts_public_read on public.feed_posts for select to anon, authenticated using (true);
create policy feed_posts_owner_insert on public.feed_posts for insert to authenticated
with check (shop_id is null or public.nearshop_owns_shop(shop_id));
create policy reviews_public_read on public.reviews for select to anon, authenticated using (true);
create policy reviews_auth_insert on public.reviews for insert to authenticated with check (true);
create policy emergency_services_verified_read on public.emergency_services for select to anon, authenticated using (status='verified' and verified=true);
create policy emergency_services_customer_suggest on public.emergency_services for insert to authenticated
with check (suggested_by=public.current_nearshop_user_id() and status='pending' and verified=false and source='public_suggestion');

-- Search events are insert-only per authenticated user. Aggregates are exposed via a thresholded view.
create policy search_events_self_insert on public.search_events for insert to authenticated
with check (customer_id = public.current_nearshop_user_id()::text);
create policy price_alerts_self_all on public.price_alerts for all to authenticated
using (customer_id = public.current_nearshop_user_id()::text)
with check (customer_id = public.current_nearshop_user_id()::text);
create policy promotion_events_shop_read on public.promotion_events for select to authenticated
using (shop_id is not null and public.nearshop_owns_shop(shop_id::uuid));
create policy promotion_events_shop_insert on public.promotion_events for insert to authenticated
with check (shop_id is not null and public.nearshop_owns_shop(shop_id::uuid));
create policy medicine_catalogue_approved_read on public.medicine_catalogue for select to anon, authenticated
using (status='approved' or (submitted_by_shop_id is not null and public.nearshop_owns_shop(submitted_by_shop_id)));
create policy medicine_catalogue_shop_insert on public.medicine_catalogue for insert to authenticated
with check (submitted_by_shop_id is not null and public.nearshop_owns_shop(submitted_by_shop_id));
create policy deal_interests_customer_insert on public.deal_interests for insert to authenticated
with check (customer_id = public.current_nearshop_user_id());
create policy deal_interests_customer_read on public.deal_interests for select to authenticated
using (customer_id = public.current_nearshop_user_id() or public.nearshop_owns_shop(shop_id));

create or replace function public.award_nearshop_points(p_points integer, p_source text default 'reward')
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid; v_day_start timestamptz; v_today integer; v_points integer;
begin
  v_user := public.current_nearshop_user_id();
  if v_user is null then raise exception 'LOGIN_REQUIRED'; end if;
  if p_points is null or p_points < 1 or p_points > 50 then raise exception 'INVALID_REWARD'; end if;
  if p_source <> 'reward' then raise exception 'INVALID_REWARD_SOURCE'; end if;
  v_day_start := date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
  select coalesce(sum(points),0)::integer into v_today from public.user_point_awards where user_id=v_user and created_at>=v_day_start;
  if v_today + p_points > 100 then raise exception 'DAILY_REWARD_LIMIT'; end if;
  insert into public.user_point_awards(user_id,points,source) values(v_user,p_points,p_source);
  update public.users set points=points+p_points where id=v_user returning points into v_points;
  return jsonb_build_object('points',v_points);
end $$;

create or replace function public.claim_nearshop_daily_checkin()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid; v_row public.users; v_today date; v_last date; v_day_start timestamptz; v_earned integer; v_total integer;
begin
  v_user := public.current_nearshop_user_id();
  if v_user is null then raise exception 'LOGIN_REQUIRED'; end if;
  select * into v_row from public.users where id=v_user for update;
  v_today := (now() at time zone 'Asia/Kolkata')::date;
  v_last := case when v_row.last_check_in is null then null else (v_row.last_check_in at time zone 'Asia/Kolkata')::date end;
  if v_last=v_today then return jsonb_build_object('already_claimed',true,'points',v_row.points,'streak',v_row.streak,'last_check_in',v_row.last_check_in); end if;
  v_day_start := date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
  select coalesce(sum(points),0)::integer into v_total from public.user_point_awards where user_id=v_user and created_at>=v_day_start;
  v_earned := case when v_total + 10 <= 100 then 10 else 0 end;
  update public.users set points=points+v_earned, streak=case when v_last=v_today-1 then streak+1 else 1 end, last_check_in=now()
    where id=v_user returning * into v_row;
  if v_earned>0 then insert into public.user_point_awards(user_id,points,source) values(v_user,v_earned,'daily_checkin'); end if;
  return jsonb_build_object('already_claimed',false,'points',v_row.points,'streak',v_row.streak,'last_check_in',v_row.last_check_in,'earned',v_earned);
end $$;

revoke all on function public.current_nearshop_user_id(), public.nearshop_owns_shop(uuid),
 public.nearshop_can_see_bid(uuid), public.award_nearshop_points(integer,text), public.claim_nearshop_daily_checkin() from public, anon;
grant execute on function public.current_nearshop_user_id(), public.nearshop_owns_shop(uuid),
 public.nearshop_can_see_bid(uuid), public.award_nearshop_points(integer,text), public.claim_nearshop_daily_checkin() to authenticated;

-- No direct client access to admin-only tables. Password-verified RPCs below are the only path.

-- Admin dashboard snapshot, returned only after password verification.
create or replace function public.admin_get_dashboard(p_password text)
returns jsonb language plpgsql security definer set search_path=public, extensions as $$
declare v_hash text;
begin
  select pass_hash into v_hash from public.app_admin where id=1;
  if v_hash is null or p_password is null or extensions.crypt(p_password,v_hash) <> v_hash then
    perform pg_sleep(1); return null;
  end if;
  return jsonb_build_object(
    'shops', coalesce((select jsonb_agg(to_jsonb(s)) from public.shops s), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(to_jsonb(p)) from public.products p), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(to_jsonb(r)) from public.reviews r), '[]'::jsonb),
    'users', coalesce((select jsonb_agg(to_jsonb(u)) from public.users u), '[]'::jsonb),
    'sales_log', coalesce((select jsonb_agg(to_jsonb(s)) from public.sales_log s), '[]'::jsonb),
    'bids', coalesce((select jsonb_agg(to_jsonb(b)) from public.bids b), '[]'::jsonb),
    'bid_offers', coalesce((select jsonb_agg(to_jsonb(o)) from public.bid_offers o), '[]'::jsonb),
    'data_licenses', coalesce((select jsonb_agg(to_jsonb(d)) from public.data_licenses d), '[]'::jsonb),
    'blocked_entities', coalesce((select jsonb_agg(to_jsonb(x)) from public.blocked_entities x), '[]'::jsonb),
    'emergency_services', coalesce((select jsonb_agg(to_jsonb(e)) from public.emergency_services e), '[]'::jsonb)
  );
end $$;

create or replace function public.admin_set_shop_block(p_password text,p_shop_id uuid,p_blocked boolean)
returns boolean language plpgsql security definer set search_path=public, extensions as $$
declare h text; r record;
begin
 select pass_hash into h from public.app_admin where id=1;
 if h is null or p_password is null or extensions.crypt(p_password,h)<>h then perform pg_sleep(1); return false; end if;
 select phone,address into r from public.shops where id=p_shop_id;
 update public.shops set is_blocked=p_blocked where id=p_shop_id;
 if p_blocked then
   insert into public.blocked_entities(type,value) select 'phone',r.phone where coalesce(r.phone,'')<>'';
   insert into public.blocked_entities(type,value) select 'address',r.address where coalesce(r.address,'')<>'';
 else
   delete from public.blocked_entities where value in (r.phone,r.address);
 end if;
 return true;
end $$;

create or replace function public.admin_set_user_block(p_password text,p_user_id uuid,p_blocked boolean)
returns boolean language plpgsql security definer set search_path=public, extensions as $$
declare h text; ph text;
begin
 select pass_hash into h from public.app_admin where id=1;
 if h is null or p_password is null or extensions.crypt(p_password,h)<>h then perform pg_sleep(1); return false; end if;
 select phone into ph from public.users where id=p_user_id;
 update public.users set is_blocked=p_blocked where id=p_user_id;
 if p_blocked and coalesce(ph,'')<>'' then insert into public.blocked_entities(type,value) values('phone',ph); end if;
 if not p_blocked then delete from public.blocked_entities where value=ph; end if;
 return true;
end $$;

create or replace function public.admin_create_license(p_password text,p_code text,p_level text,p_value text,p_category text default null)
returns jsonb language plpgsql security definer set search_path=public, extensions as $$
declare h text; r public.data_licenses;
begin
 select pass_hash into h from public.app_admin where id=1;
 if h is null or p_password is null or extensions.crypt(p_password,h)<>h then perform pg_sleep(1); return null; end if;
 insert into public.data_licenses(code,level,value,category,revoked) values(p_code,p_level,p_value,p_category,false) returning * into r;
 return to_jsonb(r);
end $$;

create or replace function public.redeem_data_license(p_code text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.data_licenses;
begin
  if coalesce(trim(p_code),'')='' then return null; end if;
  select * into r from public.data_licenses where lower(code)=lower(trim(p_code)) and revoked=false limit 1;
  if not found then perform pg_sleep(0.35); return null; end if;
  return jsonb_build_object(
    'license', jsonb_build_object('id',r.id,'code',r.code,'level',r.level,'value',r.value,'category',r.category,'revoked',r.revoked,'created_at',r.created_at),
    'sales_log', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',s.id,'shopId',s.shop_id,'productName',s.product_name,'qty',s.qty,'revenue',s.revenue,
        'area',s.area,'city',s.city,'state',s.state,'country',s.country,'category',s.category,
        'timestamp',extract(epoch from s.created_at)*1000
      )) from public.sales_log s
      where (r.category is null or r.category='All' or s.category=r.category)
        and ((r.level='shop' and s.shop_id::text=r.value)
          or (r.level='area' and s.area=r.value)
          or (r.level='city' and s.city=r.value)
          or (r.level='state' and s.state=r.value)
          or (r.level='country' and s.country=r.value))
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.admin_toggle_license(p_password text,p_license_id uuid,p_revoked boolean)
returns boolean language plpgsql security definer set search_path=public, extensions as $$
declare h text;
begin
 select pass_hash into h from public.app_admin where id=1;
 if h is null or p_password is null or extensions.crypt(p_password,h)<>h then perform pg_sleep(1); return false; end if;
 update public.data_licenses set revoked=p_revoked where id=p_license_id;
 return found;
end $$;

create or replace function public.admin_add_emergency(p_password text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public, extensions as $$
declare h text; r public.emergency_services;
begin
 select pass_hash into h from public.app_admin where id=1;
 if h is null or p_password is null or extensions.crypt(p_password,h)<>h then perform pg_sleep(1); return null; end if;
 insert into public.emergency_services(type,name,address,area,city,phone,lat,lng,open24,source,status,verified,verified_by,verified_at,updated_at)
 values (p_payload->>'type',p_payload->>'name',p_payload->>'address',p_payload->>'area',coalesce(p_payload->>'city','Surat'),p_payload->>'phone',nullif(p_payload->>'lat','')::double precision,nullif(p_payload->>'lng','')::double precision,coalesce((p_payload->>'open24')::boolean,false),coalesce(p_payload->>'source','authorized'),'verified',true,'admin',now(),now()) returning * into r;
 return to_jsonb(r);
end $$;

create or replace function public.admin_set_emergency_status(p_password text,p_service_id uuid,p_status text)
returns jsonb language plpgsql security definer set search_path=public, extensions as $$
declare h text; r public.emergency_services;
begin
 select pass_hash into h from public.app_admin where id=1;
 if h is null or p_password is null or extensions.crypt(p_password,h)<>h then perform pg_sleep(1); return null; end if;
 if p_status not in ('verified','rejected') then raise exception 'Invalid status'; end if;
 update public.emergency_services set status=p_status,verified=(p_status='verified'),verified_by='admin',verified_at=case when p_status='verified' then now() else verified_at end,updated_at=now() where id=p_service_id returning * into r;
 if not found then return null; end if;
 return to_jsonb(r);
end $$;

revoke all on function public.admin_get_dashboard(text), public.admin_set_shop_block(text,uuid,boolean),
 public.admin_set_user_block(text,uuid,boolean), public.admin_create_license(text,text,text,text,text),
 public.admin_toggle_license(text,uuid,boolean), public.redeem_data_license(text), public.find_user_by_username(text),
 public.admin_add_emergency(text,jsonb), public.admin_set_emergency_status(text,uuid,text), public.get_shop_khata_profiles(uuid) from public;
grant execute on function public.admin_get_dashboard(text), public.admin_set_shop_block(text,uuid,boolean),
 public.admin_set_user_block(text,uuid,boolean), public.admin_create_license(text,text,text,text,text),
 public.admin_toggle_license(text,uuid,boolean), public.redeem_data_license(text),
 public.admin_add_emergency(text,jsonb), public.admin_set_emergency_status(text,uuid,text) to anon, authenticated;
grant execute on function public.get_shop_khata_profiles(uuid) to authenticated;
grant execute on function public.find_user_by_username(text) to authenticated;


-- Enforce the retail broadcast cap on the database, not only in the UI.
-- Wholesale/both shops intentionally have no daily broadcast cap.
create or replace function public.enforce_retail_broadcast_daily_limit()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_shop_type text; v_count integer;
begin
  select shop_type into v_shop_type from public.shops where id=new.shop_id;
  if coalesce(v_shop_type,'retail') not in ('wholesale','both') then
    select count(*) into v_count from public.broadcasts b
      where b.shop_id=new.shop_id and b.created_at >= now()-interval '24 hours';
    if v_count >= 5 then raise exception 'RETAIL_BROADCAST_DAILY_LIMIT: 5 broadcasts per 24 hours'; end if;
  end if;
  return new;
end $$;
drop trigger if exists broadcasts_retail_daily_limit on public.broadcasts;
create trigger broadcasts_retail_daily_limit before insert on public.broadcasts
for each row execute function public.enforce_retail_broadcast_daily_limit();

-- RPCs may perform only the operations represented above. Sales remain RLS-scoped.
revoke all on function public.complete_sale(uuid,jsonb,text,uuid,text,text,numeric,numeric,numeric,numeric,text) from public, anon;
grant execute on function public.complete_sale(uuid,jsonb,text,uuid,text,text,numeric,numeric,numeric,numeric,text) to authenticated;
revoke all on function public.void_sale(uuid) from public, anon;
grant execute on function public.void_sale(uuid) to authenticated;
