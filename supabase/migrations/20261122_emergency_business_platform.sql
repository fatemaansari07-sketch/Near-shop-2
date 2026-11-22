-- NearShop Emergency Business Platform v1
-- Run after schema reconciliation, security hardening, and 20261116_admin_ads.sql (nearshop_admin_ok helper).

alter table public.emergency_services
  add column if not exists owner_id uuid references public.users(id) on delete set null,
  add column if not exists username text,
  add column if not exists description text,
  add column if not exists email text,
  add column if not exists website text,
  add column if not exists whatsapp text,
  add column if not exists services text[] not null default '{}',
  add column if not exists facilities text[] not null default '{}',
  add column if not exists hours jsonb not null default '{}'::jsonb,
  add column if not exists gallery_urls text[] not null default '{}',
  add column if not exists availability text not null default 'unknown' check (availability in ('available','unavailable','scheduled','unknown')),
  add column if not exists availability_note text,
  add column if not exists availability_updated_at timestamptz;

alter table public.emergency_services drop constraint if exists emergency_services_type_check;
alter table public.emergency_services add constraint emergency_services_type_check check (type in ('Hospital','Clinic','24x7 Pharmacy','Ambulance','Petrol Pump','Garage','Tyre / Puncture','Battery / Jump Start','Mechanic','Blood Bank','Diagnostic / Lab','Veterinary / Pet Hospital'));
create unique index if not exists emergency_services_username_uidx on public.emergency_services(lower(username)) where username is not null;
create index if not exists emergency_services_owner_idx on public.emergency_services(owner_id);

-- Memberships are scoped to one emergency business. A user's membership in one business
-- never grants access to another business.
create table if not exists public.emergency_business_users (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.emergency_services(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'worker' check (role in ('owner','manager','content_manager','receptionist','doctor','worker')),
  permissions jsonb not null default '{"profile":false,"staff":false,"posts":false,"availability":false}'::jsonb,
  invited_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(service_id,user_id)
);
create index if not exists emergency_business_users_user_idx on public.emergency_business_users(user_id) where revoked_at is null;

create table if not exists public.emergency_staff (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.emergency_services(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  name text not null check (char_length(name) between 2 and 100),
  role_title text not null default 'Staff',
  age integer check (age is null or age between 18 and 100),
  photo_url text,
  qualification text,
  specialization text,
  department text,
  experience_years numeric(4,1) check (experience_years is null or experience_years between 0 and 70),
  schedule text,
  availability text not null default 'unknown' check (availability in ('available','unavailable','scheduled','unknown')),
  availability_updated_at timestamptz,
  public_visible boolean not null default true,
  consent_confirmed boolean not null default false,
  credential_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists emergency_staff_service_idx on public.emergency_staff(service_id,public_visible);

create table if not exists public.emergency_posts (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.emergency_services(id) on delete cascade,
  author_id uuid not null references public.users(id) on delete cascade,
  post_type text not null default 'update' check (post_type in ('update','facility','health_camp','hours','announcement')),
  body text not null check (char_length(body) between 1 and 2000),
  media_urls text[] not null default '{}',
  is_emergency_alert boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists emergency_posts_service_idx on public.emergency_posts(service_id,created_at desc);

create table if not exists public.emergency_followers (
  service_id uuid not null references public.emergency_services(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(service_id,user_id)
);
create index if not exists emergency_followers_user_idx on public.emergency_followers(user_id);

create table if not exists public.emergency_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  service_id uuid references public.emergency_services(id) on delete cascade,
  post_id uuid references public.emergency_posts(id) on delete cascade,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists emergency_notifications_user_idx on public.emergency_notifications(user_id,created_at desc);

create table if not exists public.emergency_analytics (
  id bigint generated always as identity primary key,
  service_id uuid not null references public.emergency_services(id) on delete cascade,
  event_type text not null check (event_type in ('profile_view','contact_click','direction_click','post_view','qr_scan')),
  actor_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists emergency_analytics_service_idx on public.emergency_analytics(service_id,event_type,created_at desc);

create table if not exists public.emergency_roadside_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  service_type text not null,
  vehicle_type text not null check (vehicle_type in ('two_wheeler','four_wheeler','other')),
  lat double precision,
  lng double precision,
  area text,
  note text,
  status text not null default 'open' check (status in ('open','accepted','cancelled','expired','completed')),
  accepted_service_id uuid references public.emergency_services(id) on delete set null,
  expires_at timestamptz not null default now()+interval '30 minutes',
  created_at timestamptz not null default now()
);

create or replace function public.emergency_is_member(p_service_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.emergency_business_users m where m.service_id=p_service_id and m.user_id=public.current_nearshop_user_id() and m.revoked_at is null)
$$;
create or replace function public.emergency_can_manage(p_service_id uuid, p_permission text default 'profile')
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.emergency_business_users m where m.service_id=p_service_id and m.user_id=public.current_nearshop_user_id() and m.revoked_at is null and (m.role in ('owner','manager') or coalesce((m.permissions->>p_permission)::boolean,false)))
$$;

-- Only admin verification RPCs may change status/verified/owner identity.
create or replace function public.emergency_business_guard()
returns trigger language plpgsql set search_path=public as $$
begin
  if tg_op='INSERT' then
    if current_setting('nearshop.emergency_admin',true)='1' then
      new.owner_id := null;
    else
      new.owner_id := public.current_nearshop_user_id();
      new.status := 'pending'; new.verified := false; new.verified_by := null; new.verified_at := null;
      if new.owner_id is null then raise exception 'Login required'; end if;
    end if;
    new.availability_updated_at := now();
  else
    new.owner_id := old.owner_id;
    if current_setting('nearshop.emergency_admin',true) is distinct from '1' then
      new.status := old.status; new.verified := old.verified; new.verified_by := old.verified_by; new.verified_at := old.verified_at;
      new.suggested_by := old.suggested_by; new.source := old.source;
    end if;
    if new.availability is distinct from old.availability then new.availability_updated_at:=now(); end if;
    new.updated_at := now();
  end if;
  if new.username is not null then new.username := regexp_replace(lower(trim(new.username)),'[^a-z0-9_]','','g'); if char_length(new.username)<3 then raise exception 'Username kam se kam 3 characters'; end if; end if;
  if cardinality(new.gallery_urls)>12 then raise exception 'Maximum 12 gallery photos'; end if;
  return new;
end $$;
drop trigger if exists emergency_business_guard on public.emergency_services;
create trigger emergency_business_guard before insert or update on public.emergency_services for each row execute function public.emergency_business_guard();

create or replace function public.emergency_add_owner_membership()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.owner_id is not null and coalesce(new.source,'')<>'public_suggestion' then
    insert into public.emergency_business_users(service_id,user_id,role,permissions)
    values(new.id,new.owner_id,'owner','{"profile":true,"staff":true,"posts":true,"availability":true}'::jsonb)
    on conflict(service_id,user_id) do update set revoked_at=null,role='owner',permissions=excluded.permissions;
  end if;
  return new;
end $$;
drop trigger if exists emergency_owner_membership on public.emergency_services;
create trigger emergency_owner_membership after insert on public.emergency_services for each row execute function public.emergency_add_owner_membership();

-- Replace legacy policies with verified-public + owner/member scoped access.
drop policy if exists emergency_services_verified_read on public.emergency_services;
drop policy if exists emergency_services_customer_suggest on public.emergency_services;
drop policy if exists emergency_services_owner_read on public.emergency_services;
drop policy if exists emergency_services_owner_insert on public.emergency_services;
drop policy if exists emergency_services_owner_update on public.emergency_services;
create policy emergency_services_verified_read on public.emergency_services for select to anon,authenticated using (status='verified' and verified=true);
create policy emergency_services_owner_read on public.emergency_services for select to authenticated using (owner_id=public.current_nearshop_user_id() or public.emergency_is_member(id));
create policy emergency_services_owner_insert on public.emergency_services for insert to authenticated with check (owner_id=public.current_nearshop_user_id() and status='pending' and verified=false);
create policy emergency_services_owner_update on public.emergency_services for update to authenticated using (owner_id=public.current_nearshop_user_id() or public.emergency_can_manage(id,'profile') or public.emergency_can_manage(id,'availability')) with check (owner_id=public.current_nearshop_user_id() or public.emergency_can_manage(id,'profile') or public.emergency_can_manage(id,'availability'));

alter table public.emergency_business_users enable row level security;
alter table public.emergency_staff enable row level security;
alter table public.emergency_posts enable row level security;
alter table public.emergency_followers enable row level security;
alter table public.emergency_notifications enable row level security;
alter table public.emergency_analytics enable row level security;
alter table public.emergency_roadside_requests enable row level security;

grant select,insert,update,delete on public.emergency_business_users,public.emergency_staff,public.emergency_posts,public.emergency_followers,public.emergency_notifications,public.emergency_roadside_requests to authenticated;
grant select,insert on public.emergency_analytics to anon,authenticated;
grant usage,select on sequence public.emergency_analytics_id_seq to anon,authenticated;

-- Business users can only see/manage memberships belonging to their own business.
drop policy if exists ebu_scoped on public.emergency_business_users;
create policy ebu_scoped on public.emergency_business_users for all to authenticated
using (public.emergency_can_manage(service_id,'staff') or exists(select 1 from public.emergency_services s where s.id=service_id and s.owner_id=public.current_nearshop_user_id()) or user_id=public.current_nearshop_user_id())
with check (public.emergency_can_manage(service_id,'staff') or exists(select 1 from public.emergency_services s where s.id=service_id and s.owner_id=public.current_nearshop_user_id()));

drop policy if exists emergency_staff_scoped on public.emergency_staff;
drop policy if exists emergency_staff_public_read on public.emergency_staff;
create policy emergency_staff_public_read on public.emergency_staff for select to anon,authenticated using (public_visible=true and exists(select 1 from public.emergency_services s where s.id=service_id and s.status='verified' and s.verified=true));
create policy emergency_staff_scoped on public.emergency_staff for all to authenticated
using ((public.emergency_can_manage(service_id,'staff') or exists(select 1 from public.emergency_services s where s.id=service_id and s.owner_id=public.current_nearshop_user_id())) or (public_visible=true and exists(select 1 from public.emergency_services s where s.id=service_id and s.status='verified' and s.verified=true)))
with check (public.emergency_can_manage(service_id,'staff') or exists(select 1 from public.emergency_services s where s.id=service_id and s.owner_id=public.current_nearshop_user_id()));

drop policy if exists emergency_posts_scoped on public.emergency_posts;
drop policy if exists emergency_posts_write on public.emergency_posts;
drop policy if exists emergency_posts_delete on public.emergency_posts;
create policy emergency_posts_scoped on public.emergency_posts for select to anon,authenticated using (exists(select 1 from public.emergency_services s where s.id=service_id and s.status='verified' and s.verified=true) or public.emergency_is_member(service_id) or exists(select 1 from public.emergency_services s where s.id=service_id and s.owner_id=public.current_nearshop_user_id()));
create policy emergency_posts_write on public.emergency_posts for insert to authenticated with check (author_id=public.current_nearshop_user_id() and (public.emergency_can_manage(service_id,'posts') or exists(select 1 from public.emergency_services s where s.id=service_id and s.owner_id=public.current_nearshop_user_id())));
create policy emergency_posts_delete on public.emergency_posts for delete to authenticated using (public.emergency_can_manage(service_id,'posts') or exists(select 1 from public.emergency_services s where s.id=service_id and s.owner_id=public.current_nearshop_user_id()));

drop policy if exists emergency_followers_read on public.emergency_followers;
drop policy if exists emergency_followers_insert on public.emergency_followers;
drop policy if exists emergency_followers_delete on public.emergency_followers;
create policy emergency_followers_read on public.emergency_followers for select to authenticated using (user_id=public.current_nearshop_user_id() or public.emergency_can_manage(service_id,'profile') or exists(select 1 from public.emergency_services s where s.id=service_id and s.owner_id=public.current_nearshop_user_id()));
create policy emergency_followers_insert on public.emergency_followers for insert to authenticated with check (user_id=public.current_nearshop_user_id() and exists(select 1 from public.emergency_services s where s.id=service_id and s.status='verified' and s.verified=true));
create policy emergency_followers_delete on public.emergency_followers for delete to authenticated using (user_id=public.current_nearshop_user_id());

drop policy if exists emergency_notifications_self on public.emergency_notifications;
create policy emergency_notifications_self on public.emergency_notifications for all to authenticated using (user_id=public.current_nearshop_user_id()) with check (user_id=public.current_nearshop_user_id());

drop policy if exists emergency_analytics_insert on public.emergency_analytics;
drop policy if exists emergency_analytics_owner_read on public.emergency_analytics;
create policy emergency_analytics_insert on public.emergency_analytics for insert to anon,authenticated with check (exists(select 1 from public.emergency_services s where s.id=service_id and s.status='verified' and s.verified=true));
create policy emergency_analytics_owner_read on public.emergency_analytics for select to authenticated using (public.emergency_can_manage(service_id,'profile') or exists(select 1 from public.emergency_services s where s.id=service_id and s.owner_id=public.current_nearshop_user_id()));

drop policy if exists emergency_roadside_self on public.emergency_roadside_requests;
create policy emergency_roadside_self on public.emergency_roadside_requests for all to authenticated using (user_id=public.current_nearshop_user_id()) with check (user_id=public.current_nearshop_user_id());

-- Followers receive in-app notifications for new posts. Push delivery requires a separate
-- trusted server/web-push sender and is intentionally not faked by a browser-only insert.
create or replace function public.emergency_notify_followers()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.emergency_notifications(user_id,service_id,post_id,title,body)
  select f.user_id,new.service_id,new.id,coalesce((select name from public.emergency_services where id=new.service_id),'Emergency provider') || ' ne update post kiya',left(new.body,180)
  from public.emergency_followers f where f.service_id=new.service_id and f.user_id<>new.author_id;
  return new;
end $$;
drop trigger if exists emergency_post_notify_followers on public.emergency_posts;
create trigger emergency_post_notify_followers after insert on public.emergency_posts for each row execute function public.emergency_notify_followers();

revoke all on function public.emergency_is_member(uuid),public.emergency_can_manage(uuid,text),public.emergency_business_guard(),public.emergency_add_owner_membership(),public.emergency_notify_followers() from public,anon,authenticated;
grant execute on function public.emergency_is_member(uuid),public.emergency_can_manage(uuid,text) to anon,authenticated;

-- Public read grants are explicit; writes remain authenticated and RLS-scoped.
grant update on public.emergency_services to authenticated;
grant select on public.emergency_staff,public.emergency_posts to anon,authenticated;
create or replace function public.admin_list_emergency_services(p_password text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.nearshop_admin_ok(p_password) then return null; end if;
  return coalesce((select jsonb_agg(to_jsonb(e) order by (e.status='pending') desc,e.created_at desc) from public.emergency_services e),'[]'::jsonb);
end $$;
revoke all on function public.admin_list_emergency_services(text) from public;
grant execute on function public.admin_list_emergency_services(text) to anon,authenticated;

-- Shared public image bucket for Emergency galleries, staff portraits and post media.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('emergency-media','emergency-media',true,6291456,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=6291456,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists emergency_media_public_read on storage.objects;
create policy emergency_media_public_read on storage.objects for select to anon,authenticated using (bucket_id='emergency-media');
drop policy if exists emergency_media_business_upload on storage.objects;
create policy emergency_media_business_upload on storage.objects for insert to authenticated
with check (bucket_id='emergency-media' and public.emergency_can_manage((storage.foldername(name))[1]::uuid,'profile'));
drop policy if exists emergency_media_business_update on storage.objects;
create policy emergency_media_business_update on storage.objects for update to authenticated
using (bucket_id='emergency-media' and public.emergency_can_manage((storage.foldername(name))[1]::uuid,'profile'))
with check (bucket_id='emergency-media' and public.emergency_can_manage((storage.foldername(name))[1]::uuid,'profile'));
drop policy if exists emergency_media_business_delete on storage.objects;
create policy emergency_media_business_delete on storage.objects for delete to authenticated
using (bucket_id='emergency-media' and public.emergency_can_manage((storage.foldername(name))[1]::uuid,'profile'));

create or replace function public.emergency_staff_guard()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.public_visible and not new.consent_confirmed then raise exception 'Public staff profile ke liye consent confirm karna zaruri hai'; end if;
  if tg_op='UPDATE' then
    new.service_id:=old.service_id; if current_setting('nearshop.emergency_admin',true) is distinct from '1' then new.credential_verified:=old.credential_verified; end if; new.updated_at:=now();
    if new.availability is distinct from old.availability then new.availability_updated_at:=now(); end if;
  else
    new.availability_updated_at:=now();
  end if;
  return new;
end $$;
drop trigger if exists emergency_staff_guard on public.emergency_staff;
create trigger emergency_staff_guard before insert or update on public.emergency_staff for each row execute function public.emergency_staff_guard();

create or replace function public.emergency_analytics_guard()
returns trigger language plpgsql set search_path=public as $$
begin
  new.actor_id:=public.current_nearshop_user_id();
  return new;
end $$;
drop trigger if exists emergency_analytics_guard on public.emergency_analytics;
create trigger emergency_analytics_guard before insert on public.emergency_analytics for each row execute function public.emergency_analytics_guard();
revoke all on function public.emergency_staff_guard(),public.emergency_analytics_guard() from public,anon,authenticated;

-- Admin RPCs explicitly set a transaction-local guard so verified/field-added rows remain admin-controlled.
create or replace function public.admin_add_emergency(p_password text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare h text; r public.emergency_services;
begin
 select pass_hash into h from public.app_admin where id=1;
 if h is null or p_password is null or extensions.crypt(p_password,h)<>h then perform pg_sleep(1); return null; end if;
 perform set_config('nearshop.emergency_admin','1',true);
 insert into public.emergency_services(type,name,address,area,city,phone,lat,lng,open24,source,status,verified,verified_by,verified_at,updated_at)
 values(p_payload->>'type',p_payload->>'name',p_payload->>'address',p_payload->>'area',coalesce(p_payload->>'city','Surat'),p_payload->>'phone',nullif(p_payload->>'lat','')::double precision,nullif(p_payload->>'lng','')::double precision,coalesce((p_payload->>'open24')::boolean,false),coalesce(p_payload->>'source','authorized'),'verified',true,'admin',now(),now()) returning * into r;
 perform set_config('nearshop.emergency_admin','',true);
 return to_jsonb(r);
end $$;
create or replace function public.admin_set_emergency_status(p_password text,p_service_id uuid,p_status text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare h text; r public.emergency_services;
begin
 select pass_hash into h from public.app_admin where id=1;
 if h is null or p_password is null or extensions.crypt(p_password,h)<>h then perform pg_sleep(1); return null; end if;
 if p_status not in ('verified','rejected','blocked') then raise exception 'Invalid status'; end if;
 perform set_config('nearshop.emergency_admin','1',true);
 update public.emergency_services set status=p_status,verified=(p_status='verified'),verified_by='admin',verified_at=case when p_status='verified' then now() else verified_at end,updated_at=now() where id=p_service_id returning * into r;
 perform set_config('nearshop.emergency_admin','',true);
 if r.id is null then return null; end if;
 return to_jsonb(r);
end $$;
revoke all on function public.admin_add_emergency(text,jsonb),public.admin_set_emergency_status(text,uuid,text) from public;
grant execute on function public.admin_add_emergency(text,jsonb),public.admin_set_emergency_status(text,uuid,text) to anon,authenticated;

-- Reports and credential review are admin-only; public users can only submit a report.
alter table public.emergency_services drop constraint if exists emergency_services_status_check;
alter table public.emergency_services add constraint emergency_services_status_check check(status in ('pending','verified','rejected','blocked'));
create table if not exists public.emergency_reports(
 id uuid primary key default gen_random_uuid(),
 service_id uuid not null references public.emergency_services(id) on delete cascade,
 user_id uuid not null references public.users(id) on delete cascade,
 reason text not null check(char_length(reason) between 3 and 500),
 created_at timestamptz not null default now(),
 unique(service_id,user_id)
);
alter table public.emergency_reports enable row level security;
revoke all on public.emergency_reports from public,anon,authenticated;
grant insert on public.emergency_reports to authenticated;
drop policy if exists emergency_reports_insert on public.emergency_reports;
create policy emergency_reports_insert on public.emergency_reports for insert to authenticated with check(user_id=public.current_nearshop_user_id() and exists(select 1 from public.emergency_services s where s.id=service_id and s.status='verified'));
create or replace function public.admin_list_emergency_reports(p_password text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.nearshop_admin_ok(p_password) then return null; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'service_id',r.service_id,'service_name',s.name,'reason',r.reason,'created_at',r.created_at,'reporter',u.name) order by r.created_at desc) from public.emergency_reports r join public.emergency_services s on s.id=r.service_id left join public.users u on u.id=r.user_id),'[]'::jsonb);
end $$;
create or replace function public.admin_list_emergency_staff(p_password text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.nearshop_admin_ok(p_password) then return null; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',st.id,'service_id',st.service_id,'business_name',s.name,'name',st.name,'role_title',st.role_title,'qualification',st.qualification,'specialization',st.specialization,'credential_verified',st.credential_verified) order by st.created_at desc) from public.emergency_staff st join public.emergency_services s on s.id=st.service_id where st.qualification is not null or st.specialization is not null),'[]'::jsonb);
end $$;
create or replace function public.admin_set_emergency_staff_credential(p_password text,p_staff_id uuid,p_verified boolean)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_found boolean;
begin
 if not public.nearshop_admin_ok(p_password) then return false; end if;
 perform set_config('nearshop.emergency_admin','1',true);
 update public.emergency_staff set credential_verified=p_verified,updated_at=now() where id=p_staff_id;
 v_found:=found;
 perform set_config('nearshop.emergency_admin','',true);
 return coalesce(v_found,false);
end $$;
revoke all on function public.admin_list_emergency_reports(text),public.admin_list_emergency_staff(text),public.admin_set_emergency_staff_credential(text,uuid,boolean) from public;
grant execute on function public.admin_list_emergency_reports(text),public.admin_list_emergency_staff(text),public.admin_set_emergency_staff_credential(text,uuid,boolean) to anon,authenticated;

create or replace function public.emergency_membership_guard()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_owner uuid; v_me uuid:=public.current_nearshop_user_id();
begin
 if tg_op='INSERT' then
   select owner_id into v_owner from public.emergency_services where id=new.service_id;
   if v_me is distinct from v_owner and new.role in ('owner','manager') then raise exception 'Sirf business owner owner/manager access de sakta hai'; end if;
   if v_me is distinct from v_owner and not public.emergency_can_manage(new.service_id,'staff') then raise exception 'Staff invite permission nahi hai'; end if;
   new.invited_by:=v_me;
   return new;
 elsif tg_op='DELETE' then
   select owner_id into v_owner from public.emergency_services where id=old.service_id;
   if v_me is distinct from v_owner then raise exception 'Sirf business owner staff access revoke kar sakta hai'; end if;
   return old;
 else
   select owner_id into v_owner from public.emergency_services where id=old.service_id;
   if v_me is distinct from v_owner then raise exception 'Sirf business owner staff access revoke/change kar sakta hai'; end if;
   new.service_id:=old.service_id; new.user_id:=old.user_id;
   return new;
 end if;
end $$;
drop trigger if exists emergency_membership_guard on public.emergency_business_users;
create trigger emergency_membership_guard before insert or update or delete on public.emergency_business_users for each row execute function public.emergency_membership_guard();
revoke all on function public.emergency_membership_guard() from public,anon,authenticated;
