-- Admin-managed ads: app promotions + affiliate (Amazon etc.) with start/end time, placements, views/clicks.
-- Run once in Supabase SQL editor. Writes only through admin RPCs (admin password), reads are public for LIVE ads only.
create table if not exists public.app_ads (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'affiliate' check (kind in ('app_promo','affiliate')),
  title text not null check (char_length(title) between 1 and 120),
  body text check (body is null or char_length(body) <= 300),
  image_url text,
  link_url text not null check (link_url ~* '^https://'),
  button_text text not null default 'Dekhein',
  placements text[] not null default '{home}',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  active boolean not null default true,
  impressions integer not null default 0,
  clicks integer not null default 0,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (placements <@ array['home','feed','deals','popup'])
);
alter table public.app_ads enable row level security;
revoke all on public.app_ads from public, anon, authenticated;
grant select on public.app_ads to anon, authenticated;
drop policy if exists app_ads_live_read on public.app_ads;
create policy app_ads_live_read on public.app_ads for select to anon, authenticated
using (active and starts_at <= now() and ends_at > now());

create or replace function public.nearshop_admin_ok(p_password text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare v_hash text;
begin
  select pass_hash into v_hash from public.app_admin where id = 1;
  if v_hash is null or p_password is null or extensions.crypt(p_password, v_hash) <> v_hash then perform pg_sleep(1); return false; end if;
  return true;
end $$;
revoke all on function public.nearshop_admin_ok(text) from public, anon, authenticated;

create or replace function public.admin_list_ads(p_password text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.nearshop_admin_ok(p_password) then return null; end if;
  return coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from public.app_ads a), '[]'::jsonb);
end $$;

create or replace function public.admin_save_ad(p_password text, p_ad jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p_ad->>'id', '')::uuid;
begin
  if not public.nearshop_admin_ok(p_password) then return null; end if;
  if v_id is null then
    insert into public.app_ads(kind, title, body, image_url, link_url, button_text, placements, starts_at, ends_at, active)
    values (coalesce(p_ad->>'kind','affiliate'), p_ad->>'title', nullif(p_ad->>'body',''), nullif(p_ad->>'image_url',''), p_ad->>'link_url',
            coalesce(nullif(p_ad->>'button_text',''),'Dekhein'),
            coalesce(array(select jsonb_array_elements_text(p_ad->'placements')), '{home}'),
            coalesce((p_ad->>'starts_at')::timestamptz, now()), (p_ad->>'ends_at')::timestamptz, coalesce((p_ad->>'active')::boolean, true))
    returning id into v_id;
  else
    update public.app_ads set
      kind = coalesce(p_ad->>'kind', kind), title = coalesce(p_ad->>'title', title),
      body = case when p_ad ? 'body' then nullif(p_ad->>'body','') else body end,
      image_url = case when p_ad ? 'image_url' then nullif(p_ad->>'image_url','') else image_url end,
      link_url = coalesce(p_ad->>'link_url', link_url), button_text = coalesce(nullif(p_ad->>'button_text',''), button_text),
      placements = case when p_ad ? 'placements' then array(select jsonb_array_elements_text(p_ad->'placements')) else placements end,
      starts_at = coalesce((p_ad->>'starts_at')::timestamptz, starts_at), ends_at = coalesce((p_ad->>'ends_at')::timestamptz, ends_at),
      active = coalesce((p_ad->>'active')::boolean, active)
    where id = v_id;
  end if;
  return v_id;
end $$;

create or replace function public.admin_delete_ad(p_password text, p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.nearshop_admin_ok(p_password) then return false; end if;
  delete from public.app_ads where id = p_id; return true;
end $$;

-- view / click counters (anyone, only for currently live ads)
create or replace function public.ad_track(p_id uuid, p_event text)
returns void language sql security definer set search_path = public as $$
  update public.app_ads set
    impressions = impressions + case when p_event = 'view' then 1 else 0 end,
    clicks = clicks + case when p_event = 'click' then 1 else 0 end
  where id = p_id and active and starts_at <= now() and ends_at > now() and p_event in ('view','click')
$$;
revoke all on function public.admin_list_ads(text), public.admin_save_ad(text, jsonb), public.admin_delete_ad(text, uuid), public.ad_track(uuid, text) from public;
grant execute on function public.admin_list_ads(text), public.admin_save_ad(text, jsonb), public.admin_delete_ad(text, uuid), public.ad_track(uuid, text) to anon, authenticated;
