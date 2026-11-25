-- NearShop External Advertiser Platform V1
-- Run AFTER 20261127_campaign_order_security.sql.
-- This adds independent brand advertising; it does not replace shopkeeper promotions or admin campaigns.

create table if not exists public.advertiser_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references public.users(id) on delete cascade,
  brand_name text not null,
  contact_name text,
  contact_email text,
  phone text,
  website text,
  business_type text,
  city text not null default 'Surat',
  state text not null default 'Gujarat',
  about text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists advertiser_accounts_status_idx on public.advertiser_accounts(status, created_at desc);

create table if not exists public.advertiser_wallets (
  advertiser_id uuid primary key references public.advertiser_accounts(id) on delete cascade,
  balance numeric(12,2) not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.advertiser_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references public.advertiser_accounts(id) on delete cascade,
  amount numeric(12,2) not null,
  transaction_type text not null check (transaction_type in ('topup','campaign_charge','refund','adjustment')),
  reference_id uuid,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists advertiser_wallet_tx_idx on public.advertiser_wallet_transactions(advertiser_id, created_at desc);

create table if not exists public.advertiser_topup_requests (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references public.advertiser_accounts(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 100),
  payment_method text not null default 'upi' check (payment_method in ('upi','bank_transfer','cash')),
  payment_reference text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists advertiser_topups_status_idx on public.advertiser_topup_requests(status, created_at desc);

create table if not exists public.advertiser_campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references public.advertiser_accounts(id) on delete cascade,
  title text not null,
  body text not null default '',
  image_url text,
  video_url text,
  destination_url text,
  whatsapp_number text,
  button_text text not null default 'Abhi Dekhein',
  placements text[] not null default array['feed']::text[],
  target_type text not null default 'city' check (target_type in ('all','city','state','category')),
  target_city text not null default 'Surat',
  target_state text not null default 'Gujarat',
  target_category text,
  budget numeric(12,2) not null default 0 check (budget >= 0),
  budget_remaining numeric(12,2) not null default 0 check (budget_remaining >= 0),
  spent numeric(12,2) not null default 0 check (spent >= 0),
  billing_model text not null default 'cpm' check (billing_model in ('cpm','cpc')),
  rate numeric(12,2) not null default 100 check (rate > 0),
  start_at timestamptz not null default now(),
  end_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','pending_review','approved','paused','rejected','expired')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid','refunded')),
  admin_note text,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint advertiser_campaign_placements_check check (
    placements <@ array['feed','home','deals','popup','banner']::text[] and cardinality(placements) > 0
  ),
  constraint advertiser_campaign_dates_check check (end_at > start_at)
);
create index if not exists advertiser_campaign_live_idx
  on public.advertiser_campaigns(status, start_at, end_at);
create index if not exists advertiser_campaign_owner_idx
  on public.advertiser_campaigns(advertiser_id, created_at desc);

alter table public.advertiser_campaigns
  add column if not exists budget_remaining numeric(12,2) not null default 0,
  add column if not exists spent numeric(12,2) not null default 0,
  add column if not exists billing_model text not null default 'cpm',
  add column if not exists rate numeric(12,2) not null default 100;

create table if not exists public.advertiser_campaign_events (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.advertiser_campaigns(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  event text not null check (event in ('view','click')),
  created_at timestamptz not null default now()
);
create index if not exists advertiser_campaign_events_idx
  on public.advertiser_campaign_events(campaign_id, event, created_at desc);

alter table public.advertiser_accounts enable row level security;
alter table public.advertiser_wallets enable row level security;
alter table public.advertiser_wallet_transactions enable row level security;
alter table public.advertiser_topup_requests enable row level security;
alter table public.advertiser_campaigns enable row level security;
alter table public.advertiser_campaign_events enable row level security;

drop policy if exists advertiser_account_read_own on public.advertiser_accounts;
create policy advertiser_account_read_own on public.advertiser_accounts
  for select to authenticated using (owner_user_id = public.current_nearshop_user_id());
drop policy if exists advertiser_campaign_read_own on public.advertiser_campaigns;
create policy advertiser_campaign_read_own on public.advertiser_campaigns
  for select to authenticated using (
    exists (select 1 from public.advertiser_accounts a
      where a.id = advertiser_campaigns.advertiser_id and a.owner_user_id = public.current_nearshop_user_id())
  );
drop policy if exists advertiser_wallet_read_own on public.advertiser_wallets;
create policy advertiser_wallet_read_own on public.advertiser_wallets
  for select to authenticated using (
    exists (select 1 from public.advertiser_accounts a
      where a.id = advertiser_wallets.advertiser_id and a.owner_user_id = public.current_nearshop_user_id())
  );
drop policy if exists advertiser_wallet_tx_read_own on public.advertiser_wallet_transactions;
create policy advertiser_wallet_tx_read_own on public.advertiser_wallet_transactions
  for select to authenticated using (
    exists (select 1 from public.advertiser_accounts a
      where a.id = advertiser_wallet_transactions.advertiser_id and a.owner_user_id = public.current_nearshop_user_id())
  );
drop policy if exists advertiser_topup_read_own on public.advertiser_topup_requests;
create policy advertiser_topup_read_own on public.advertiser_topup_requests
  for select to authenticated using (
    exists (select 1 from public.advertiser_accounts a
      where a.id = advertiser_topup_requests.advertiser_id and a.owner_user_id = public.current_nearshop_user_id())
  );

revoke all on public.advertiser_accounts, public.advertiser_wallets,
  public.advertiser_wallet_transactions, public.advertiser_topup_requests,
  public.advertiser_campaigns, public.advertiser_campaign_events
from anon, authenticated;
grant select on public.advertiser_accounts, public.advertiser_wallets,
  public.advertiser_wallet_transactions, public.advertiser_topup_requests,
  public.advertiser_campaigns to authenticated;

-- Private writes are RPC-only; users cannot set their own approval/payment/live status.
create or replace function public.my_advertiser_account()
returns setof public.advertiser_accounts
language sql stable security definer set search_path=public as $$
  select a.* from public.advertiser_accounts a
  where a.owner_user_id = public.current_nearshop_user_id()
  limit 1
$$;

create or replace function public.save_advertiser_profile(p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_uid uuid := public.current_nearshop_user_id(); v_id uuid; v_name text;
begin
  if v_uid is null then raise exception 'Login required'; end if;
  v_name := left(trim(coalesce(p_payload->>'brand_name','')),100);
  if v_name = '' then raise exception 'Brand/business name required'; end if;
  select id into v_id from public.advertiser_accounts where owner_user_id=v_uid;
  if v_id is null then
    insert into public.advertiser_accounts(owner_user_id,brand_name,contact_name,contact_email,phone,website,business_type,city,state,about)
    values (v_uid,v_name,nullif(left(trim(coalesce(p_payload->>'contact_name','')),100),''),
      nullif(left(trim(coalesce(p_payload->>'contact_email','')),160),''),
      nullif(left(trim(coalesce(p_payload->>'phone','')),30),''),
      nullif(left(trim(coalesce(p_payload->>'website','')),300),''),
      nullif(left(trim(coalesce(p_payload->>'business_type','')),80),''),
      coalesce(nullif(left(trim(coalesce(p_payload->>'city','')),80),''),'Surat'),
      coalesce(nullif(left(trim(coalesce(p_payload->>'state','')),80),''),'Gujarat'),
      nullif(left(trim(coalesce(p_payload->>'about','')),1000),'')) returning id into v_id;
    insert into public.advertiser_wallets(advertiser_id,balance) values(v_id,0);
  else
    update public.advertiser_accounts set
      brand_name=v_name, contact_name=nullif(left(trim(coalesce(p_payload->>'contact_name','')),100),''),
      contact_email=nullif(left(trim(coalesce(p_payload->>'contact_email','')),160),''),
      phone=nullif(left(trim(coalesce(p_payload->>'phone','')),30),''),
      website=nullif(left(trim(coalesce(p_payload->>'website','')),300),''),
      business_type=nullif(left(trim(coalesce(p_payload->>'business_type','')),80),''),
      city=coalesce(nullif(left(trim(coalesce(p_payload->>'city','')),80),''),'Surat'),
      state=coalesce(nullif(left(trim(coalesce(p_payload->>'state','')),80),''),'Gujarat'),
      about=nullif(left(trim(coalesce(p_payload->>'about','')),1000),''),
      updated_at=now()
    where id=v_id;
  end if;
  return v_id;
end $$;

create or replace function public.admin_create_advertiser(p_password text,p_user_id uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_name text;
begin
  if not public.nearshop_admin_ok(p_password) then raise exception 'Admin verification failed'; end if;
  if not exists(select 1 from public.users where id=p_user_id) then raise exception 'NearShop user not found'; end if;
  v_name:=left(trim(coalesce(p_payload->>'brand_name','')),100);
  if v_name='' then raise exception 'Brand/business name required'; end if;
  insert into public.advertiser_accounts(owner_user_id,brand_name,contact_name,contact_email,phone,website,business_type,city,state,about)
  values(p_user_id,v_name,nullif(left(coalesce(p_payload->>'contact_name',''),100),''),
    nullif(left(coalesce(p_payload->>'contact_email',''),160),''),
    nullif(left(coalesce(p_payload->>'phone',''),30),''),
    nullif(left(coalesce(p_payload->>'website',''),300),''),
    nullif(left(coalesce(p_payload->>'business_type',''),80),''),
    coalesce(nullif(left(coalesce(p_payload->>'city',''),80),''),'Surat'),
    coalesce(nullif(left(coalesce(p_payload->>'state',''),80),''),'Gujarat'),
    nullif(left(coalesce(p_payload->>'about',''),1000),''))
  on conflict(owner_user_id) do update set brand_name=excluded.brand_name,contact_name=excluded.contact_name,
    contact_email=excluded.contact_email,phone=excluded.phone,website=excluded.website,
    business_type=excluded.business_type,city=excluded.city,state=excluded.state,about=excluded.about,updated_at=now()
  returning id into v_id;
  insert into public.advertiser_wallets(advertiser_id,balance) values(v_id,0) on conflict(advertiser_id) do nothing;
  return v_id;
end $$;

create or replace function public.save_advertiser_campaign(p_id uuid, p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_uid uuid := public.current_nearshop_user_id(); v_advertiser uuid; v_id uuid;
  v_title text; v_body text; v_placements text[]; v_target text; v_budget numeric;
  v_start timestamptz; v_end timestamptz; v_image text; v_video text; v_url text; v_whatsapp text;
  v_model text; v_rate numeric;
begin
  if v_uid is null then raise exception 'Login required'; end if;
  select id into v_advertiser from public.advertiser_accounts where owner_user_id=v_uid;
  if v_advertiser is null then raise exception 'Advertiser profile pehle banayein'; end if;
  v_title := left(trim(coalesce(p_payload->>'title','')),100);
  if v_title='' then raise exception 'Ad title required'; end if;
  v_body := left(trim(coalesce(p_payload->>'body','')),1000);
  v_placements := array(select jsonb_array_elements_text(coalesce(p_payload->'placements','["feed"]'::jsonb)));
  if cardinality(v_placements)=0 or not (v_placements <@ array['feed','home','deals','popup','banner']::text[]) then
    raise exception 'Invalid ad placement';
  end if;
  v_target := coalesce(p_payload->>'target_type','city');
  if v_target not in ('all','city','state','category') then raise exception 'Invalid audience'; end if;
  v_budget := greatest(0,coalesce(nullif(p_payload->>'budget','')::numeric,0));
  v_model := coalesce(p_payload->>'billing_model','cpm');
  select nullif(settings->'externalAds'->>v_model,'')::numeric into v_rate
    from public.platform_settings where id='pricing';
  v_rate := coalesce(v_rate,case when v_model='cpc' then 3 else 100 end);
  if v_model not in ('cpm','cpc') or v_rate < 0.1 or v_rate > 10000 then raise exception 'Invalid platform ad rate'; end if;
  v_start := coalesce(nullif(p_payload->>'start_at','')::timestamptz,now());
  v_end := nullif(p_payload->>'end_at','')::timestamptz;
  if v_end is null or v_end <= v_start then raise exception 'End date must be after start date'; end if;
  v_image := nullif(p_payload->>'image_url','');
  v_video := nullif(p_payload->>'video_url','');
  v_url := nullif(p_payload->>'destination_url','');
  v_whatsapp := regexp_replace(coalesce(p_payload->>'whatsapp_number',''),'[^0-9]','','g');
  if v_image is null and v_video is null then raise exception 'Image ya video creative upload karein'; end if;
  if v_url is not null and v_url !~* '^https://' then raise exception 'Destination URL must use HTTPS'; end if;
  if v_url is null and v_whatsapp='' then raise exception 'Destination HTTPS URL or WhatsApp number required'; end if;
  if v_whatsapp<>'' and length(v_whatsapp) not between 10 and 15 then raise exception 'WhatsApp number must include country code'; end if;
  if v_id is null then v_id := p_id; end if;
  if p_id is not null then
    update public.advertiser_campaigns set
      title=v_title,body=v_body,image_url=v_image,video_url=v_video,destination_url=v_url,
      whatsapp_number=nullif(v_whatsapp,''),button_text=left(coalesce(p_payload->>'button_text','Abhi Dekhein'),40),
      placements=v_placements,target_type=v_target,target_city=coalesce(nullif(p_payload->>'target_city',''),'Surat'),
      target_state=coalesce(nullif(p_payload->>'target_state',''),'Gujarat'),
      target_category=nullif(p_payload->>'target_category',''),budget=v_budget,billing_model=v_model,rate=v_rate,
      start_at=v_start,end_at=v_end,updated_at=now()
    where id=p_id and advertiser_id=v_advertiser and status in ('draft','rejected') and payment_status in ('unpaid','refunded');
    if not found then raise exception 'Campaign edit nahi ho sakta. Sirf draft/rejected campaign edit karein.'; end if;
    v_id := p_id;
  else
    insert into public.advertiser_campaigns(advertiser_id,title,body,image_url,video_url,destination_url,whatsapp_number,
      button_text,placements,target_type,target_city,target_state,target_category,budget,billing_model,rate,start_at,end_at)
    values(v_advertiser,v_title,v_body,v_image,v_video,v_url,nullif(v_whatsapp,''),
      left(coalesce(p_payload->>'button_text','Abhi Dekhein'),40),v_placements,v_target,
      coalesce(nullif(p_payload->>'target_city',''),'Surat'),coalesce(nullif(p_payload->>'target_state',''),'Gujarat'),
      nullif(p_payload->>'target_category',''),v_budget,v_model,v_rate,v_start,v_end) returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.advertiser_wallet_summary()
returns table(balance numeric, transactions jsonb, topups jsonb)
language plpgsql stable security definer set search_path=public as $$
declare v_adv uuid := (select id from public.advertiser_accounts where owner_user_id=public.current_nearshop_user_id());
begin
  if v_adv is null then raise exception 'Advertiser profile missing'; end if;
  return query select coalesce(w.balance,0),
    coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc) from (
      select amount,transaction_type,note,created_at from public.advertiser_wallet_transactions
      where advertiser_id=v_adv order by created_at desc limit 20) t),'[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from (
      select id,amount,payment_method,payment_reference,status,admin_note,created_at
      from public.advertiser_topup_requests where advertiser_id=v_adv order by created_at desc limit 20) r),'[]'::jsonb)
  from public.advertiser_wallets w where w.advertiser_id=v_adv;
end $$;

create or replace function public.request_advertiser_topup(p_amount numeric,p_method text,p_reference text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_adv uuid := (select id from public.advertiser_accounts where owner_user_id=public.current_nearshop_user_id() and status='approved'); v_id uuid;
begin
  if v_adv is null then raise exception 'Advertiser profile missing'; end if;
  if p_amount < 100 or p_amount > 1000000 then raise exception 'Top-up amount ₹100 se ₹10,00,000 ke beech hona chahiye'; end if;
  if length(trim(coalesce(p_reference,''))) < 4 then raise exception 'Payment reference required'; end if;
  insert into public.advertiser_topup_requests(advertiser_id,amount,payment_method,payment_reference)
  values(v_adv,p_amount,coalesce(p_method,'upi'),left(trim(p_reference),120)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.submit_advertiser_campaign(p_campaign uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_uid uuid := public.current_nearshop_user_id(); v_adv uuid; v_budget numeric; v_status text; v_payment text; v_balance numeric;
begin
  select id into v_adv from public.advertiser_accounts where owner_user_id=v_uid and status='approved';
  if v_adv is null then raise exception 'Advertiser account admin approval ke baad campaign submit kar sakte hain'; end if;
  select budget,status,payment_status into v_budget,v_status,v_payment from public.advertiser_campaigns
    where id=p_campaign and advertiser_id=v_adv for update;
  if not found then raise exception 'Campaign not found'; end if;
  if v_status not in ('draft','rejected') or v_payment='paid' then raise exception 'Campaign already submitted or budget already reserved'; end if;
  if v_budget < 100 then raise exception 'Minimum campaign budget ₹100 rakhein'; end if;
  select balance into v_balance from public.advertiser_wallets where advertiser_id=v_adv for update;
  if coalesce(v_balance,0) < v_budget then raise exception 'Wallet balance kam hai. Pehle wallet top-up karein.'; end if;
  update public.advertiser_wallets set balance=balance-v_budget,updated_at=now() where advertiser_id=v_adv;
  insert into public.advertiser_wallet_transactions(advertiser_id,amount,transaction_type,reference_id,note)
    values(v_adv,-v_budget,'campaign_charge',p_campaign,'Campaign budget reserve');
  update public.advertiser_campaigns set status='pending_review',payment_status='paid',
    budget_remaining=budget,spent=0,admin_note=null,updated_at=now()
    where id=p_campaign;
  return true;
end $$;

create or replace function public.advertiser_campaign_stats()
returns table(campaign_id uuid,views bigint,clicks bigint,ctr numeric)
language sql stable security definer set search_path=public as $$
  select c.id, count(e.id) filter(where e.event='view'), count(e.id) filter(where e.event='click'),
    round(100.0*count(e.id) filter(where e.event='click')/nullif(count(e.id) filter(where e.event='view'),0),2)
  from public.advertiser_campaigns c
  join public.advertiser_accounts a on a.id=c.advertiser_id
  left join public.advertiser_campaign_events e on e.campaign_id=c.id
  where a.owner_user_id=public.current_nearshop_user_id()
  group by c.id
$$;

create or replace function public.admin_advertiser_accounts(p_password text)
returns table(id uuid,brand_name text,contact_name text,contact_email text,phone text,website text,
  city text,state text,status text,admin_note text,created_at timestamptz,owner_user_id uuid)
language plpgsql security definer set search_path=public as $$
begin
  if not public.nearshop_admin_ok(p_password) then raise exception 'Admin verification failed'; end if;
  return query select a.id,a.brand_name,a.contact_name,a.contact_email,a.phone,a.website,a.city,a.state,
    a.status,a.admin_note,a.created_at,a.owner_user_id from public.advertiser_accounts a order by a.created_at desc;
end $$;

create or replace function public.admin_advertiser_campaigns(p_password text)
returns table(id uuid,advertiser_id uuid,brand_name text,title text,body text,image_url text,video_url text,
  destination_url text,placements text[],target_type text,target_city text,target_state text,target_category text,
  budget numeric,budget_remaining numeric,spent numeric,billing_model text,rate numeric,
  start_at timestamptz,end_at timestamptz,status text,payment_status text,impressions bigint,
  clicks bigint,created_at timestamptz,admin_note text)
language plpgsql security definer set search_path=public as $$
begin
  if not public.nearshop_admin_ok(p_password) then raise exception 'Admin verification failed'; end if;
  return query select c.id,c.advertiser_id,a.brand_name,c.title,c.body,c.image_url,c.video_url,c.destination_url,
    c.placements,c.target_type,c.target_city,c.target_state,c.target_category,c.budget,c.budget_remaining,
    c.spent,c.billing_model,c.rate,c.start_at,c.end_at,c.status,c.payment_status,c.impressions,c.clicks,c.created_at,c.admin_note
  from public.advertiser_campaigns c join public.advertiser_accounts a on a.id=c.advertiser_id
  order by c.created_at desc;
end $$;

create or replace function public.admin_review_advertiser(p_password text,p_advertiser uuid,p_status text,p_note text default null)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not public.nearshop_admin_ok(p_password) then raise exception 'Admin verification failed'; end if;
  if p_status not in ('approved','rejected','suspended') then raise exception 'Invalid advertiser status'; end if;
  update public.advertiser_accounts set status=p_status,admin_note=nullif(left(coalesce(p_note,''),500),''),updated_at=now()
    where id=p_advertiser;
  return found;
end $$;

create or replace function public.admin_review_advertiser_campaign(p_password text,p_campaign uuid,p_status text,p_note text default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_adv uuid; v_refund numeric;
begin
  if not public.nearshop_admin_ok(p_password) then raise exception 'Admin verification failed'; end if;
  if p_status not in ('approved','rejected','paused') then raise exception 'Invalid campaign status'; end if;
  if p_status='approved' and not exists (
    select 1 from public.advertiser_campaigns c join public.advertiser_accounts a on a.id=c.advertiser_id
    where c.id=p_campaign and c.payment_status='paid' and a.status='approved'
      and c.end_at>now()
  ) then raise exception 'Advertiser approval, paid budget aur valid end date required'; end if;
  update public.advertiser_campaigns set status=p_status,admin_note=nullif(left(coalesce(p_note,''),500),''),updated_at=now()
    where id=p_campaign;
  if not found then return false; end if;
  if p_status in ('rejected','paused') then
    select advertiser_id,budget_remaining into v_adv,v_refund
      from public.advertiser_campaigns where id=p_campaign for update;
    if coalesce(v_refund,0)>0 then
      update public.advertiser_campaigns set budget_remaining=0,payment_status='refunded' where id=p_campaign;
      update public.advertiser_wallets set balance=balance+v_refund,updated_at=now() where advertiser_id=v_adv;
      insert into public.advertiser_wallet_transactions(advertiser_id,amount,transaction_type,reference_id,note)
        values(v_adv,v_refund,'refund',p_campaign,'Unused campaign budget returned after admin '||p_status);
    else
      update public.advertiser_campaigns set payment_status='refunded' where id=p_campaign;
    end if;
  end if;
  return true;
end $$;

create or replace function public.admin_review_advertiser_topup(p_password text,p_request uuid,p_approve boolean,p_note text default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare r public.advertiser_topup_requests;
begin
  if not public.nearshop_admin_ok(p_password) then raise exception 'Admin verification failed'; end if;
  select * into r from public.advertiser_topup_requests where id=p_request for update;
  if not found or r.status<>'pending' then return false; end if;
  update public.advertiser_topup_requests set status=case when p_approve then 'approved' else 'rejected' end,
    admin_note=nullif(left(coalesce(p_note,''),500),''),reviewed_at=now() where id=p_request;
  if p_approve then
    insert into public.advertiser_wallets(advertiser_id,balance) values(r.advertiser_id,r.amount)
    on conflict(advertiser_id) do update set balance=public.advertiser_wallets.balance+excluded.balance,updated_at=now();
    insert into public.advertiser_wallet_transactions(advertiser_id,amount,transaction_type,reference_id,note)
      values(r.advertiser_id,r.amount,'topup',r.id,'Admin verified top-up: '||r.payment_reference);
  end if;
  return true;
end $$;

create or replace function public.advertiser_campaign_matches_user(p_campaign public.advertiser_campaigns,p_uid uuid)
returns boolean language plpgsql stable security definer set search_path=public as $$
begin
  if p_campaign.target_type='all' then return true; end if;
  if p_uid is null then return p_campaign.target_type='city' and lower(p_campaign.target_city)='surat'; end if;
  if p_campaign.target_type='city' then
    return exists(select 1 from public.user_audience_profile u where u.user_id=p_uid and lower(coalesce(u.city,''))=lower(p_campaign.target_city))
      or exists(select 1 from public.shops s where s.owner_id=p_uid and lower(coalesce(s.city,''))=lower(p_campaign.target_city));
  elsif p_campaign.target_type='state' then
    return exists(select 1 from public.user_audience_profile u where u.user_id=p_uid and lower(coalesce(u.state,''))=lower(p_campaign.target_state))
      or exists(select 1 from public.shops s where s.owner_id=p_uid and lower(coalesce(s.state,''))=lower(p_campaign.target_state));
  elsif p_campaign.target_type='category' then
    return exists(select 1 from public.shops s where s.owner_id=p_uid and lower(coalesce(s.category,''))=lower(coalesce(p_campaign.target_category,'')))
      or exists(select 1 from public.feed_follows f join public.shops s on s.id=f.shop_id
        where f.user_id=p_uid and lower(coalesce(s.category,''))=lower(coalesce(p_campaign.target_category,'')));
  end if;
  return false;
end $$;
revoke all on function public.advertiser_campaign_matches_user(public.advertiser_campaigns,uuid) from public,anon,authenticated;

create or replace function public.live_advertiser_campaigns(p_placement text default 'feed')
returns table(id uuid,brand_name text,title text,body text,image_url text,video_url text,
  destination_url text,whatsapp_number text,button_text text,placements text[],target_type text,
  target_city text,target_state text,target_category text)
language sql stable security definer set search_path=public as $$
  select c.id,a.brand_name,c.title,c.body,c.image_url,c.video_url,c.destination_url,c.whatsapp_number,
    c.button_text,c.placements,c.target_type,c.target_city,c.target_state,c.target_category
  from public.advertiser_campaigns c join public.advertiser_accounts a on a.id=c.advertiser_id
  where c.status='approved' and a.status='approved' and c.payment_status='paid'
    and c.start_at<=now() and c.end_at>now() and p_placement=any(c.placements)
    and a.owner_user_id is distinct from public.current_nearshop_user_id()
    and public.advertiser_campaign_matches_user(c,public.current_nearshop_user_id())
  order by c.created_at desc limit 30
$$;

create or replace function public.track_advertiser_campaign(p_id uuid,p_event text,p_placement text default 'feed')
returns void language plpgsql security definer set search_path=public as $$
declare c public.advertiser_campaigns; v_cost numeric := 0; v_uid uuid:=public.current_nearshop_user_id();
begin
  if p_event not in ('view','click') or p_placement not in ('feed','deals','banner','popup') then return; end if;
  select * into c from public.advertiser_campaigns where id=p_id for update;
  if not found or c.status<>'approved' or c.payment_status<>'paid' or c.start_at>now() or c.end_at<=now()
     or not (p_placement=any(c.placements))
     or not exists(select 1 from public.advertiser_accounts a where a.id=c.advertiser_id
       and a.status='approved' and a.owner_user_id is distinct from v_uid)
     or not public.advertiser_campaign_matches_user(c,v_uid) then return; end if;
  if v_uid is not null and exists(
    select 1 from public.advertiser_campaign_events e where e.campaign_id=p_id and e.user_id=v_uid
      and e.event=p_event and e.created_at>now()-interval '1 day'
  ) then return; end if;
  if c.billing_model='cpm' and p_event='view' then v_cost := c.rate/1000.0; end if;
  if c.billing_model='cpc' and p_event='click' then v_cost := c.rate; end if;
  if v_cost > c.budget_remaining then
    update public.advertiser_campaigns set status='expired',updated_at=now() where id=p_id;
    return;
  end if;
  insert into public.advertiser_campaign_events(campaign_id,user_id,event)
    values(p_id,v_uid,p_event);
  update public.advertiser_campaigns set
    impressions=impressions+case when p_event='view' then 1 else 0 end,
    clicks=clicks+case when p_event='click' then 1 else 0 end,
    spent=spent+v_cost,budget_remaining=greatest(0,budget_remaining-v_cost),
    status=case when budget_remaining-v_cost<=0 then 'expired' else status end,
    updated_at=now()
  where id=p_id;
end $$;

create or replace function public.claim_advertiser_campaign_refund(p_campaign uuid)
returns numeric language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=public.current_nearshop_user_id(); v_campaign public.advertiser_campaigns; v_refund numeric;
begin
  select ac.* into v_campaign from public.advertiser_campaigns ac join public.advertiser_accounts a on a.id=ac.advertiser_id
    where ac.id=p_campaign and a.owner_user_id=v_uid for update of ac;
  if not found then raise exception 'Campaign not found'; end if;
  if v_campaign.status not in ('expired','paused','rejected') and v_campaign.end_at>now() then
    raise exception 'Campaign complete/pause hone ke baad unused budget refund claim karein';
  end if;
  v_refund:=coalesce(v_campaign.budget_remaining,0);
  if v_refund<=0 then return 0; end if;
  update public.advertiser_campaigns set budget_remaining=0,payment_status='refunded',updated_at=now() where id=p_campaign;
  update public.advertiser_wallets set balance=balance+v_refund,updated_at=now() where advertiser_id=v_campaign.advertiser_id;
  insert into public.advertiser_wallet_transactions(advertiser_id,amount,transaction_type,reference_id,note)
    values(v_campaign.advertiser_id,v_refund,'refund',p_campaign,'Unused campaign budget returned');
  return v_refund;
end $$;

-- Storage: public creatives are served to app users; uploads are restricted to the signed-in auth UID folder.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('advertiser-creatives','advertiser-creatives',true,10485760,
  array['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
on conflict(id) do update set public=true,file_size_limit=10485760,
  allowed_mime_types=array['image/jpeg','image/png','image/webp','video/mp4','video/webm'];

drop policy if exists advertiser_creative_upload_own on storage.objects;
create policy advertiser_creative_upload_own on storage.objects for insert to authenticated
  with check (bucket_id='advertiser-creatives' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists advertiser_creative_update_own on storage.objects;
create policy advertiser_creative_update_own on storage.objects for update to authenticated
  using (bucket_id='advertiser-creatives' and (storage.foldername(name))[1]=auth.uid()::text)
  with check (bucket_id='advertiser-creatives' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists advertiser_creative_delete_own on storage.objects;
create policy advertiser_creative_delete_own on storage.objects for delete to authenticated
  using (bucket_id='advertiser-creatives' and (storage.foldername(name))[1]=auth.uid()::text);

revoke all on function public.my_advertiser_account(),public.save_advertiser_profile(jsonb),
  public.save_advertiser_campaign(uuid,jsonb),public.advertiser_wallet_summary(),
  public.request_advertiser_topup(numeric,text,text),public.submit_advertiser_campaign(uuid),
  public.advertiser_campaign_stats(),public.claim_advertiser_campaign_refund(uuid),public.admin_create_advertiser(text,uuid,jsonb),public.admin_advertiser_accounts(text),
  public.admin_advertiser_campaigns(text),public.admin_review_advertiser(text,uuid,text,text),
  public.admin_review_advertiser_campaign(text,uuid,text,text),
  public.admin_review_advertiser_topup(text,uuid,boolean,text),
  public.live_advertiser_campaigns(text),public.track_advertiser_campaign(uuid,text,text)
from public,anon,authenticated;

grant execute on function public.my_advertiser_account(),public.save_advertiser_profile(jsonb),
  public.save_advertiser_campaign(uuid,jsonb),public.advertiser_wallet_summary(),
  public.request_advertiser_topup(numeric,text,text),public.submit_advertiser_campaign(uuid),
  public.advertiser_campaign_stats(),public.claim_advertiser_campaign_refund(uuid),public.live_advertiser_campaigns(text),
  public.track_advertiser_campaign(uuid,text,text)
to authenticated;
grant execute on function public.live_advertiser_campaigns(text) to anon;
grant execute on function public.admin_create_advertiser(text,uuid,jsonb),public.admin_advertiser_accounts(text),
  public.admin_advertiser_campaigns(text),public.admin_review_advertiser(text,uuid,text,text),
  public.admin_review_advertiser_campaign(text,uuid,text,text),
  public.admin_review_advertiser_topup(text,uuid,boolean,text)
to anon, authenticated;

comment on table public.advertiser_campaigns is
  'External brand campaigns. Separate from shopkeeper promotions and admin_campaigns. Admin approval required before delivery.';
comment on table public.advertiser_wallet_transactions is
  'Ledger for advertiser advance wallet and reserved campaign budgets. Top-ups are credited only after admin verifies payment reference.';

create or replace function public.admin_advertiser_topups(p_password text)
returns table(id uuid,advertiser_id uuid,brand_name text,amount numeric,payment_method text,
  payment_reference text,status text,admin_note text,created_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin
  if not public.nearshop_admin_ok(p_password) then raise exception 'Admin verification failed'; end if;
  return query select r.id,r.advertiser_id,a.brand_name,r.amount,r.payment_method,r.payment_reference,
    r.status,r.admin_note,r.created_at
  from public.advertiser_topup_requests r join public.advertiser_accounts a on a.id=r.advertiser_id
  order by r.created_at desc;
end $$;
revoke all on function public.admin_advertiser_topups(text) from public,anon,authenticated;
grant execute on function public.admin_advertiser_topups(text) to anon, authenticated;
