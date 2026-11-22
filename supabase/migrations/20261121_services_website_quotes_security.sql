-- NearShop Services v2: website-style profiles, quote workflow, follows, private contacts.
-- Run AFTER 20261120_service_providers.sql.

alter table public.service_profiles
  add column if not exists slug text,
  add column if not exists tagline text,
  add column if not exists cover_photo text,
  add column if not exists skills text[] not null default '{}',
  add column if not exists service_areas text[] not null default '{}',
  add column if not exists languages text[] not null default '{}',
  add column if not exists team_size integer,
  add column if not exists pricing_type text not null default 'contact' check (pricing_type in ('fixed','starting','hourly','daily','per_sqft','contact')),
  add column if not exists home_visit boolean not null default true,
  add column if not exists availability text not null default 'available' check (availability in ('available','busy','weekends','contact')),
  add column if not exists profile_views bigint not null default 0,
  add column if not exists rejection_reason text;

update public.service_profiles
set slug = trim(both '-' from regexp_replace(lower(coalesce(name,'professional') || '-' || coalesce(city,'local') || '-' || left(id::text,6)), '[^a-z0-9]+', '-', 'g'))
where slug is null or slug = '';
create unique index if not exists service_profiles_slug_uidx on public.service_profiles(slug);
create index if not exists service_profiles_search_idx on public.service_profiles(status, city, category);

-- Preserve existing profiles, but make future slugs stable and unique.
create or replace function public.service_make_slug(p_name text, p_city text, p_id uuid)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(coalesce(p_name,'professional') || '-' || coalesce(p_city,'local') || '-' || left(p_id::text,6)), '[^a-z0-9]+', '-', 'g'))
$$;


-- Public profile photos use a dedicated bucket; only the owning NearShop account may upload/change/delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('service-gallery','service-gallery',true,2097152,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true, file_size_limit=2097152, allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists service_gallery_public_read on storage.objects;
drop policy if exists service_gallery_owner_insert on storage.objects;
drop policy if exists service_gallery_owner_update on storage.objects;
drop policy if exists service_gallery_owner_delete on storage.objects;
create policy service_gallery_public_read on storage.objects for select to public using(bucket_id='service-gallery');
create policy service_gallery_owner_insert on storage.objects for insert to authenticated with check(bucket_id='service-gallery' and (storage.foldername(name))[1]=public.current_nearshop_user_id()::text);
create policy service_gallery_owner_update on storage.objects for update to authenticated using(bucket_id='service-gallery' and (storage.foldername(name))[1]=public.current_nearshop_user_id()::text) with check(bucket_id='service-gallery' and (storage.foldername(name))[1]=public.current_nearshop_user_id()::text);
create policy service_gallery_owner_delete on storage.objects for delete to authenticated using(bucket_id='service-gallery' and (storage.foldername(name))[1]=public.current_nearshop_user_id()::text);

-- Separate follow relation; never exposes follower identities publicly.
create table if not exists public.service_follows (
  user_id uuid not null references public.users(id) on delete cascade,
  profile_id uuid not null references public.service_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, profile_id)
);
create index if not exists service_follows_profile_idx on public.service_follows(profile_id);
alter table public.service_follows enable row level security;
revoke all on public.service_follows from public, anon, authenticated;
grant select, insert, delete on public.service_follows to authenticated;
drop policy if exists service_follows_self_read on public.service_follows;
drop policy if exists service_follows_self_insert on public.service_follows;
drop policy if exists service_follows_self_delete on public.service_follows;
create policy service_follows_self_read on public.service_follows for select to authenticated using(user_id = public.current_nearshop_user_id());
create policy service_follows_self_insert on public.service_follows for insert to authenticated with check(
  user_id = public.current_nearshop_user_id() and exists(select 1 from public.service_profiles p where p.id=profile_id and p.status='approved' and p.owner_id <> public.current_nearshop_user_id())
);
create policy service_follows_self_delete on public.service_follows for delete to authenticated using(user_id = public.current_nearshop_user_id());

create or replace function public.service_follower_counts()
returns table(profile_id uuid, followers bigint)
language sql stable security definer set search_path=public as $$
  select f.profile_id, count(*) from public.service_follows f
  join public.service_profiles p on p.id=f.profile_id and p.status='approved'
  group by f.profile_id
$$;
revoke all on function public.service_follower_counts() from public;
grant execute on function public.service_follower_counts() to anon, authenticated;

-- Quote requests: one customer request is sent to one selected professional.
create table if not exists public.service_quote_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.service_profiles(id) on delete cascade,
  customer_id uuid not null references public.users(id) on delete cascade,
  customer_name text not null check(char_length(customer_name) between 2 and 100),
  customer_phone text check(customer_phone is null or char_length(customer_phone) between 8 and 20),
  title text not null check(char_length(title) between 3 and 120),
  description text not null check(char_length(description) between 5 and 1500),
  service_location text,
  preferred_date date,
  photo_urls text[] not null default '{}',
  status text not null default 'pending' check(status in ('pending','viewed','quoted','accepted','rejected','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists service_quote_requests_profile_idx on public.service_quote_requests(profile_id,status,created_at desc);
create index if not exists service_quote_requests_customer_idx on public.service_quote_requests(customer_id,created_at desc);

create table if not exists public.service_quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_quote_requests(id) on delete cascade,
  provider_id uuid not null references public.users(id) on delete cascade,
  amount numeric(12,2) not null check(amount >= 0),
  estimated_duration text,
  material_note text,
  message text,
  status text not null default 'sent' check(status in ('sent','accepted','rejected','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(request_id)
);
create index if not exists service_quotes_provider_idx on public.service_quotes(provider_id,created_at desc);

create or replace function public.service_quote_requests_guard()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_me uuid := public.current_nearshop_user_id(); v_owner uuid;
begin
  if tg_op='INSERT' then
    if v_me is null then raise exception 'LOGIN_REQUIRED'; end if;
    select owner_id into v_owner from public.service_profiles where id=new.profile_id and status='approved';
    if v_owner is null then raise exception 'PROFILE_NOT_AVAILABLE'; end if;
    if v_owner=v_me then raise exception 'SELF_REQUEST_NOT_ALLOWED'; end if;
    new.customer_id := v_me;
    new.status := 'pending';
    if cardinality(new.photo_urls) > 3 then raise exception 'Maximum 3 request photos'; end if;
    if exists(select 1 from unnest(new.photo_urls) as t(url) where url !~* '^(https://|data:image/(jpeg|png|webp);base64,)' or char_length(url)>150000) then raise exception 'Request photo invalid'; end if;
  else
    new.customer_id := old.customer_id;
    new.profile_id := old.profile_id;
    if current_setting('nearshop.service_quote_update', true) = '1' then
      null;
    elsif old.customer_id = v_me then
      if new.status <> old.status and not (new.status='cancelled' and old.status in ('pending','viewed','quoted')) then raise exception 'CUSTOMER_CANNOT_CHANGE_REQUEST_STATUS'; end if;
    elsif exists(select 1 from public.service_profiles p where p.id=old.profile_id and p.owner_id=v_me) then
      if not ((new.status='viewed' and old.status='pending') or (new.status='completed' and old.status='accepted')) then raise exception 'INVALID_PROVIDER_STATUS'; end if;
      new.customer_name:=old.customer_name; new.customer_phone:=old.customer_phone; new.title:=old.title; new.description:=old.description; new.service_location:=old.service_location; new.preferred_date:=old.preferred_date; new.photo_urls:=old.photo_urls;
    else raise exception 'NOT_REQUEST_PARTICIPANT'; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists service_quote_requests_guard on public.service_quote_requests;
create trigger service_quote_requests_guard before insert or update on public.service_quote_requests for each row execute function public.service_quote_requests_guard();

create or replace function public.service_quotes_guard()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_me uuid := public.current_nearshop_user_id(); v_owner uuid; v_customer uuid; v_request_status text;
begin
  select p.owner_id, r.customer_id, r.status into v_owner, v_customer, v_request_status
  from public.service_quote_requests r join public.service_profiles p on p.id=r.profile_id where r.id=new.request_id;
  if tg_op='INSERT' then
    if v_owner is null or v_owner <> v_me then raise exception 'NOT_SERVICE_OWNER'; end if;
    if v_request_status not in ('pending','viewed') then raise exception 'REQUEST_NOT_OPEN'; end if;
    new.provider_id := v_me;
    new.status := 'sent';
    perform set_config('nearshop.service_quote_update','1',true);
    update public.service_quote_requests set status='quoted', updated_at=now() where id=new.request_id;
    perform set_config('nearshop.service_quote_update','',true);
  else
    if v_customer is distinct from v_me then raise exception 'NOT_CUSTOMER'; end if;
    if v_request_status <> 'quoted' then raise exception 'REQUEST_NOT_AWAITING_QUOTE'; end if;
    new.provider_id := old.provider_id;
    new.request_id := old.request_id;
    new.amount := old.amount; new.estimated_duration := old.estimated_duration; new.material_note := old.material_note; new.message := old.message;
    if old.status <> 'sent' or new.status not in ('accepted','rejected') then raise exception 'INVALID_QUOTE_STATUS'; end if;
    perform set_config('nearshop.service_quote_update','1',true);
    update public.service_quote_requests set status=case when new.status='accepted' then 'accepted' else 'rejected' end, updated_at=now() where id=new.request_id;
    perform set_config('nearshop.service_quote_update','',true);
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists service_quotes_guard on public.service_quotes;
create trigger service_quotes_guard before insert or update on public.service_quotes for each row execute function public.service_quotes_guard();

alter table public.service_quote_requests enable row level security;
alter table public.service_quotes enable row level security;
revoke all on public.service_quote_requests, public.service_quotes from public, anon, authenticated;
grant select, insert, update on public.service_quote_requests to authenticated;
grant select, insert, update on public.service_quotes to authenticated;
drop policy if exists service_quote_requests_read on public.service_quote_requests;
drop policy if exists service_quote_requests_insert on public.service_quote_requests;
drop policy if exists service_quote_requests_update on public.service_quote_requests;
create policy service_quote_requests_read on public.service_quote_requests for select to authenticated using(
  customer_id=public.current_nearshop_user_id() or exists(select 1 from public.service_profiles p where p.id=profile_id and p.owner_id=public.current_nearshop_user_id())
);
create policy service_quote_requests_insert on public.service_quote_requests for insert to authenticated with check(customer_id=public.current_nearshop_user_id());
create policy service_quote_requests_update on public.service_quote_requests for update to authenticated using(customer_id=public.current_nearshop_user_id() or exists(select 1 from public.service_profiles p where p.id=profile_id and p.owner_id=public.current_nearshop_user_id())) with check(customer_id=public.current_nearshop_user_id() or exists(select 1 from public.service_profiles p where p.id=profile_id and p.owner_id=public.current_nearshop_user_id()));
drop policy if exists service_quotes_read on public.service_quotes;
drop policy if exists service_quotes_insert on public.service_quotes;
drop policy if exists service_quotes_update on public.service_quotes;
create policy service_quotes_read on public.service_quotes for select to authenticated using(
  provider_id=public.current_nearshop_user_id() or exists(select 1 from public.service_quote_requests r where r.id=request_id and r.customer_id=public.current_nearshop_user_id())
);
create policy service_quotes_insert on public.service_quotes for insert to authenticated with check(
  provider_id=public.current_nearshop_user_id() and exists(select 1 from public.service_quote_requests r join public.service_profiles p on p.id=r.profile_id where r.id=request_id and p.owner_id=public.current_nearshop_user_id())
);
create policy service_quotes_update on public.service_quotes for update to authenticated using(
  exists(select 1 from public.service_quote_requests r where r.id=request_id and r.customer_id=public.current_nearshop_user_id())
) with check(
  exists(select 1 from public.service_quote_requests r where r.id=request_id and r.customer_id=public.current_nearshop_user_id())
);

-- In-app service notifications. Push delivery can be connected later without changing quote tables.
create table if not exists public.service_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  profile_id uuid references public.service_profiles(id) on delete cascade,
  request_id uuid references public.service_quote_requests(id) on delete cascade,
  kind text not null check(kind in ('new_request','new_quote','quote_accepted','quote_rejected')),
  title text not null,
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists service_notifications_user_idx on public.service_notifications(user_id,is_read,created_at desc);
alter table public.service_notifications enable row level security;
revoke all on public.service_notifications from public, anon, authenticated;
grant select on public.service_notifications to authenticated;
grant update (is_read) on public.service_notifications to authenticated;
drop policy if exists service_notifications_read on public.service_notifications;
drop policy if exists service_notifications_update on public.service_notifications;
create policy service_notifications_read on public.service_notifications for select to authenticated using(user_id=public.current_nearshop_user_id());
create policy service_notifications_update on public.service_notifications for update to authenticated using(user_id=public.current_nearshop_user_id()) with check(user_id=public.current_nearshop_user_id());

create or replace function public.service_notify_new_request()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_owner uuid; v_name text;
begin
  select p.owner_id,p.name into v_owner,v_name from public.service_profiles p where p.id=new.profile_id;
  insert into public.service_notifications(user_id,profile_id,request_id,kind,title,body)
  values(v_owner,new.profile_id,new.id,'new_request','Nayi quote request',new.title || ' · ' || coalesce(new.service_location,'Location nahi di'));
  return new;
end $$;
drop trigger if exists service_notify_new_request on public.service_quote_requests;
create trigger service_notify_new_request after insert on public.service_quote_requests for each row execute function public.service_notify_new_request();

create or replace function public.service_notify_new_quote()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_customer uuid;
begin
  select customer_id into v_customer from public.service_quote_requests where id=new.request_id;
  insert into public.service_notifications(user_id,profile_id,request_id,kind,title,body)
  select v_customer,r.profile_id,new.request_id,'new_quote','Quotation mil gaya', 'Professional ne ₹' || new.amount::text || ' ka quotation bheja hai.'
  from public.service_quote_requests r where r.id=new.request_id;
  return new;
end $$;
drop trigger if exists service_notify_new_quote on public.service_quotes;
create trigger service_notify_new_quote after insert on public.service_quotes for each row execute function public.service_notify_new_quote();

-- Verified review eligibility: customer must have a completed quote request for this profile.
create or replace function public.service_reviews_guard()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_me uuid := public.current_nearshop_user_id();
begin
  new.user_id := v_me;
  if exists(select 1 from public.service_profiles where id=new.profile_id and owner_id=v_me) then raise exception 'Apni profile ko review nahi de sakte'; end if;
  if not exists(select 1 from public.service_quote_requests where profile_id=new.profile_id and customer_id=v_me and status='completed') then
    raise exception 'Review dene ke liye completed service request zaroori hai';
  end if;
  new.author_name := coalesce((select name from public.users where id=v_me),'User');
  return new;
end $$;

-- Approved profile reviews are public, but review creation remains authenticated and completion-gated.
grant select on public.service_reviews to anon;
drop policy if exists service_reviews_public_read on public.service_reviews;
create policy service_reviews_public_read on public.service_reviews for select to anon using(exists(select 1 from public.service_profiles p where p.id=profile_id and p.status='approved'));

-- Optional property-dealer credential details; property listings/transactions are intentionally not part of this release.
create table if not exists public.service_property_details (
  profile_id uuid primary key references public.service_profiles(id) on delete cascade,
  rera_number text,
  office_address text,
  specialties text[] not null default '{}',
  verification_status text not null default 'not_submitted' check(verification_status in ('not_submitted','pending','verified','rejected')),
  updated_at timestamptz not null default now()
);
alter table public.service_property_details enable row level security;
revoke all on public.service_property_details from public, anon, authenticated;
grant select on public.service_property_details to anon, authenticated;
grant insert, update on public.service_property_details to authenticated;
drop policy if exists service_property_public_read on public.service_property_details;
drop policy if exists service_property_owner_write on public.service_property_details;
create policy service_property_public_read on public.service_property_details for select to anon, authenticated using(exists(select 1 from public.service_profiles p where p.id=profile_id and p.status='approved'));
drop policy if exists service_property_owner_read on public.service_property_details;
create policy service_property_owner_read on public.service_property_details for select to authenticated using(exists(select 1 from public.service_profiles p where p.id=profile_id and p.owner_id=public.current_nearshop_user_id()));
create policy service_property_owner_write on public.service_property_details for all to authenticated using(exists(select 1 from public.service_profiles p where p.id=profile_id and p.owner_id=public.current_nearshop_user_id())) with check(exists(select 1 from public.service_profiles p where p.id=profile_id and p.owner_id=public.current_nearshop_user_id()));
create or replace function public.service_property_details_guard() returns trigger language plpgsql set search_path=public as $$ begin if tg_op='INSERT' then new.verification_status:=case when nullif(trim(coalesce(new.rera_number,'')),'') is null then 'not_submitted' else 'pending' end; elsif new.rera_number is distinct from old.rera_number then new.verification_status:=case when nullif(trim(coalesce(new.rera_number,'')),'') is null then 'not_submitted' else 'pending' end; else new.verification_status:=old.verification_status; end if; new.updated_at:=now(); return new; end $$;
drop trigger if exists service_property_details_guard on public.service_property_details;
create trigger service_property_details_guard before insert or update on public.service_property_details for each row execute function public.service_property_details_guard();

-- Private phone access. The profile listing no longer grants SELECT on phone/whatsapp.
create or replace function public.service_get_contact(p_profile_id uuid)
returns table(phone text, whatsapp text)
language plpgsql stable security definer set search_path=public as $$
declare v_me uuid := public.current_nearshop_user_id();
begin
  if v_me is null then return; end if;
  return query select p.phone,p.whatsapp from public.service_profiles p
  where p.id=p_profile_id and (p.status='approved' or p.owner_id=v_me);
end $$;
revoke all on function public.service_get_contact(uuid) from public, anon;
grant execute on function public.service_get_contact(uuid) to authenticated;

-- Public profile views are aggregated; no visitor identity is exposed.
create or replace function public.service_track_profile_view(p_profile_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_found boolean;
begin
  perform set_config('nearshop.service_view_increment','1',true);
  update public.service_profiles set profile_views=profile_views+1 where id=p_profile_id and status='approved';
  v_found := found;
  perform set_config('nearshop.service_view_increment','',true);
  return v_found;
end $$;
revoke all on function public.service_track_profile_view(uuid) from public;
grant execute on function public.service_track_profile_view(uuid) to anon, authenticated;
grant execute on function public.service_ratings() to anon;

-- Column-level grants: phone/whatsapp cannot be selected through PostgREST profile queries.
revoke all on public.service_profiles from public, anon, authenticated;
grant select (id,owner_id,category,name,about,experience_years,city,area,rate_note,photo_url,work_photos,status,featured_until,created_at,updated_at,slug,tagline,cover_photo,skills,service_areas,languages,team_size,pricing_type,home_visit,availability,profile_views,rejection_reason) on public.service_profiles to anon, authenticated;
grant insert (owner_id,category,name,about,experience_years,city,area,phone,whatsapp,rate_note,photo_url,work_photos,slug,tagline,cover_photo,skills,service_areas,languages,team_size,pricing_type,home_visit,availability) on public.service_profiles to authenticated;
grant update (category,name,about,experience_years,city,area,phone,whatsapp,rate_note,photo_url,work_photos,slug,tagline,cover_photo,skills,service_areas,languages,team_size,pricing_type,home_visit,availability) on public.service_profiles to authenticated;
grant delete on public.service_profiles to authenticated;
drop policy if exists sp_read on public.service_profiles;
create policy sp_read on public.service_profiles for select to anon, authenticated using(status='approved' or owner_id=public.current_nearshop_user_id());


create or replace function public.service_profiles_guard()
returns trigger language plpgsql set search_path = public as $$
declare p text; v_feat timestamptz;
begin
  new.phone := regexp_replace(coalesce(new.phone,''), '[^0-9+]', '', 'g');
  if new.phone !~ '^\+?[0-9]{8,15}$' then raise exception 'Phone number sahi daaliye (8-15 digit)'; end if;
  if new.whatsapp is not null and new.whatsapp <> '' then
    new.whatsapp := regexp_replace(new.whatsapp, '[^0-9+]', '', 'g');
    if new.whatsapp !~ '^\+?[0-9]{8,15}$' then raise exception 'WhatsApp number sahi daaliye'; end if;
  else new.whatsapp := null; end if;
  if new.photo_url is not null and (new.photo_url !~* '^(https://|data:image/(jpeg|png|webp);base64,)' or char_length(new.photo_url) > 80000) then raise exception 'Profile photo sahi nahi'; end if;
  if new.cover_photo is not null and (new.cover_photo !~* '^(https://|data:image/(jpeg|png|webp);base64,)' or char_length(new.cover_photo) > 250000) then raise exception 'Cover photo sahi nahi'; end if;
  if cardinality(new.work_photos) > 12 then raise exception 'Maximum 12 work photos'; end if;
  foreach p in array new.work_photos loop
    if p !~* '^(https://|data:image/(jpeg|png|webp);base64,)' or char_length(p) > 250000 then raise exception 'Kaam ki photo sahi nahi'; end if;
  end loop;
  if tg_op = 'INSERT' then
    if (select count(*) from public.service_profiles where owner_id = new.owner_id) >= 3 then raise exception 'Maximum 3 service profiles'; end if;
    new.status := 'pending'; new.featured_until := null;
  else
    v_feat := new.featured_until;
    new.owner_id := old.owner_id;
    if current_setting('nearshop.service_view_increment', true) = '1' then
      new.status := old.status; new.featured_until := old.featured_until; new.updated_at := old.updated_at;
    elsif current_setting('nearshop.admin_edit', true) = '1' then
      new.status := coalesce(nullif(current_setting('nearshop.new_status', true), ''), old.status);
      new.featured_until := v_feat;
    else
      new.status := case when old.status='blocked' then 'blocked' else 'pending' end;
      new.featured_until := old.featured_until;
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;


-- Admin review queue includes the full professional summary and supports rejection feedback.
create or replace function public.admin_list_service_profiles(p_password text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.nearshop_admin_ok(p_password) then return null; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by (x.status='pending') desc, x.created_at desc) from (
    select p.id,p.owner_id,p.category,p.name,p.about,p.tagline,p.experience_years,p.city,p.area,p.phone,p.whatsapp,p.rate_note,p.photo_url,p.cover_photo,p.work_photos,p.slug,p.skills,p.service_areas,p.languages,p.team_size,p.pricing_type,p.home_visit,p.availability,p.status,p.featured_until,p.rejection_reason,p.profile_views,p.created_at,
      (select count(*) from public.service_reports r where r.profile_id=p.id) as reports,
      (select jsonb_build_object('rera_number',d.rera_number,'office_address',d.office_address,'verification_status',d.verification_status) from public.service_property_details d where d.profile_id=p.id) as property_details
    from public.service_profiles p
  ) x),'[]'::jsonb);
end $$;

drop function if exists public.admin_set_service_status(text,uuid,text,timestamptz);
create or replace function public.admin_set_service_status(p_password text,p_id uuid,p_status text,p_featured_until timestamptz,p_rejection_reason text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not public.nearshop_admin_ok(p_password) then return false; end if;
  if p_status not in ('pending','approved','rejected','blocked') then return false; end if;
  perform set_config('nearshop.admin_edit','1',true);
  perform set_config('nearshop.new_status',p_status,true);
  update public.service_profiles set status=p_status,
    featured_until=case when p_featured_until is null then featured_until when p_featured_until<=now() then null else p_featured_until end,
    rejection_reason=case when p_status='rejected' then nullif(left(trim(coalesce(p_rejection_reason,'')),300),'') else null end
  where id=p_id;
  if not found then perform set_config('nearshop.admin_edit','',true); return false; end if;
  perform set_config('nearshop.admin_edit','',true);
  return true;
end $$;
revoke all on function public.admin_list_service_profiles(text),public.admin_set_service_status(text,uuid,text,timestamptz,text) from public;
grant execute on function public.admin_list_service_profiles(text),public.admin_set_service_status(text,uuid,text,timestamptz,text) to anon,authenticated;

-- Ensure only own profile can be changed and status remains admin-controlled by the guard trigger.
-- service_profiles_guard from the first migration continues to force new profiles pending.

revoke all on function public.service_quote_requests_guard(), public.service_quotes_guard(), public.service_notify_new_request(), public.service_notify_new_quote(), public.service_property_details_guard() from public, anon, authenticated;
revoke all on function public.service_make_slug(text,text,uuid) from public, anon, authenticated;
revoke all on function public.service_track_profile_view(uuid) from public;
