-- NearShop Admin Campaign Center
-- Run after the existing admin/security migrations (nearshop_admin_ok must exist).
create table if not exists public.admin_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  campaign_type text not null default 'announcement',
  seller_type text not null default 'platform',
  image_url text,
  video_url text,
  primary_url text,
  button_text text not null default 'Abhi Dekhein',
  audience_type text not null default 'all',
  audience_category text,
  audience_city text,
  audience_state text,
  start_at timestamptz not null default now(),
  end_at timestamptz,
  in_app_enabled boolean not null default true,
  push_enabled boolean not null default true,
  product_name text,
  product_price numeric(12,2),
  compare_at_price numeric(12,2),
  stock_quantity integer,
  discount_type text not null default 'percent',
  discount_value numeric(12,2),
  coupon_code text,
  offer_feature text,
  offer_note text,
  status text not null default 'draft' check (status in ('draft','scheduled','published','paused','expired')),
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  redemptions bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_campaign_price_check check (product_price is null or product_price >= 0),
  constraint admin_campaign_compare_check check (compare_at_price is null or compare_at_price > coalesce(product_price,0)),
  constraint admin_campaign_stock_check check (stock_quantity is null or stock_quantity >= 0),
  constraint admin_campaign_discount_check check (discount_value is null or discount_value >= 0)
);
create index if not exists admin_campaign_live_idx on public.admin_campaigns(status,start_at,end_at);
create index if not exists admin_campaign_created_idx on public.admin_campaigns(created_at desc);

alter table public.admin_campaigns enable row level security;
revoke all on public.admin_campaigns from anon, authenticated;

create or replace function public.admin_list_campaigns(p_password text)
returns setof public.admin_campaigns
language plpgsql security definer set search_path=public as $$
begin
  if not public.nearshop_admin_ok(p_password) then
    raise exception 'Admin verification failed';
  end if;
  return query select * from public.admin_campaigns order by created_at desc;
end $$;

create or replace function public.admin_save_campaign(p_password text, p_campaign jsonb)
returns uuid
language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if not public.nearshop_admin_ok(p_password) then raise exception 'Admin verification failed'; end if;
  if p_campaign ? 'id' and nullif(p_campaign->>'id','') is not null then
    v_id := (p_campaign->>'id')::uuid;
    update public.admin_campaigns set
      title=coalesce(p_campaign->>'title',title),
      body=coalesce(p_campaign->>'body',body),
      campaign_type=coalesce(p_campaign->>'campaign_type',campaign_type),
      seller_type=coalesce(p_campaign->>'seller_type',seller_type),
      image_url=case when p_campaign ? 'image_url' then nullif(p_campaign->>'image_url','') else image_url end,
      video_url=case when p_campaign ? 'video_url' then nullif(p_campaign->>'video_url','') else video_url end,
      primary_url=case when p_campaign ? 'primary_url' then nullif(p_campaign->>'primary_url','') else primary_url end,
      button_text=coalesce(p_campaign->>'button_text',button_text),
      audience_type=coalesce(p_campaign->>'audience_type',audience_type),
      audience_category=case when p_campaign ? 'audience_category' then nullif(p_campaign->>'audience_category','') else audience_category end,
      audience_city=case when p_campaign ? 'audience_city' then nullif(p_campaign->>'audience_city','') else audience_city end,
      audience_state=case when p_campaign ? 'audience_state' then nullif(p_campaign->>'audience_state','') else audience_state end,
      start_at=coalesce((p_campaign->>'start_at')::timestamptz,start_at),
      end_at=case when p_campaign ? 'end_at' then nullif(p_campaign->>'end_at','')::timestamptz else end_at end,
      in_app_enabled=coalesce((p_campaign->>'in_app_enabled')::boolean,in_app_enabled),
      push_enabled=coalesce((p_campaign->>'push_enabled')::boolean,push_enabled),
      product_name=case when p_campaign ? 'product_name' then nullif(p_campaign->>'product_name','') else product_name end,
      product_price=case when p_campaign ? 'product_price' then nullif(p_campaign->>'product_price','')::numeric else product_price end,
      compare_at_price=case when p_campaign ? 'compare_at_price' then nullif(p_campaign->>'compare_at_price','')::numeric else compare_at_price end,
      stock_quantity=case when p_campaign ? 'stock_quantity' then nullif(p_campaign->>'stock_quantity','')::integer else stock_quantity end,
      discount_type=coalesce(p_campaign->>'discount_type',discount_type),
      discount_value=case when p_campaign ? 'discount_value' then nullif(p_campaign->>'discount_value','')::numeric else discount_value end,
      coupon_code=case when p_campaign ? 'coupon_code' then nullif(p_campaign->>'coupon_code','') else coupon_code end,
      offer_feature=case when p_campaign ? 'offer_feature' then nullif(p_campaign->>'offer_feature','') else offer_feature end,
      offer_note=case when p_campaign ? 'offer_note' then nullif(p_campaign->>'offer_note','') else offer_note end,
      status=coalesce(p_campaign->>'status',status), updated_at=now()
    where id=v_id;
    if not found then raise exception 'Campaign not found'; end if;
  else
    insert into public.admin_campaigns(
      title,body,campaign_type,seller_type,image_url,video_url,primary_url,button_text,
      audience_type,audience_category,audience_city,audience_state,start_at,end_at,
      in_app_enabled,push_enabled,product_name,product_price,compare_at_price,stock_quantity,
      discount_type,discount_value,coupon_code,offer_feature,offer_note,status
    ) values (
      p_campaign->>'title',p_campaign->>'body',coalesce(p_campaign->>'campaign_type','announcement'),
      coalesce(p_campaign->>'seller_type','platform'),nullif(p_campaign->>'image_url',''),
      nullif(p_campaign->>'video_url',''),nullif(p_campaign->>'primary_url',''),
      coalesce(p_campaign->>'button_text','Abhi Dekhein'),coalesce(p_campaign->>'audience_type','all'),
      nullif(p_campaign->>'audience_category',''),nullif(p_campaign->>'audience_city',''),
      nullif(p_campaign->>'audience_state',''),coalesce((p_campaign->>'start_at')::timestamptz,now()),
      nullif(p_campaign->>'end_at','')::timestamptz,coalesce((p_campaign->>'in_app_enabled')::boolean,true),
      coalesce((p_campaign->>'push_enabled')::boolean,true),nullif(p_campaign->>'product_name',''),
      nullif(p_campaign->>'product_price','')::numeric,nullif(p_campaign->>'compare_at_price','')::numeric,
      nullif(p_campaign->>'stock_quantity','')::integer,coalesce(p_campaign->>'discount_type','percent'),
      nullif(p_campaign->>'discount_value','')::numeric,nullif(p_campaign->>'coupon_code',''),
      nullif(p_campaign->>'offer_feature',''),nullif(p_campaign->>'offer_note',''),
      coalesce(p_campaign->>'status','draft')
    ) returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.admin_delete_campaign(p_password text,p_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not public.nearshop_admin_ok(p_password) then raise exception 'Admin verification failed'; end if;
  delete from public.admin_campaigns where id=p_id;
  return found;
end $$;

-- In-app feed. Audience filtering is deliberately conservative; precise city/category
-- matching can be extended once the app's profile/shop-location model is audited.
create or replace function public.live_admin_campaigns()
returns setof public.admin_campaigns
language sql stable security definer set search_path=public as $$
  select * from public.admin_campaigns
  where status='published' and in_app_enabled=true
    and start_at <= now() and (end_at is null or end_at > now())
  order by created_at desc limit 100
$$;

create or replace function public.track_admin_campaign(p_id uuid,p_event text)
returns void language sql security definer set search_path=public as $$
  update public.admin_campaigns set
    impressions=impressions + case when p_event='view' then 1 else 0 end,
    clicks=clicks + case when p_event='click' then 1 else 0 end
  where id=p_id and status='published' and start_at<=now()
    and (end_at is null or end_at>now()) and p_event in ('view','click')
$$;

revoke all on function public.admin_list_campaigns(text),public.admin_save_campaign(text,jsonb),
  public.admin_delete_campaign(text,uuid),public.live_admin_campaigns(),public.track_admin_campaign(uuid,text) from public;
grant execute on function public.admin_list_campaigns(text),public.admin_save_campaign(text,jsonb),
  public.admin_delete_campaign(text,uuid) to authenticated;
grant execute on function public.live_admin_campaigns(),public.track_admin_campaign(uuid,text) to anon,authenticated;
