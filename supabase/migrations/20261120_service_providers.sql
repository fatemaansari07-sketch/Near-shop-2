-- NearShop Services: painters, electricians, plumbers, tutors, property dealers... each person makes a profile,
-- admin approves it, customers call / WhatsApp / review. Needs nearshop_admin_ok (from the Ads migration).
create table if not exists public.service_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  category text not null check (char_length(category) between 2 and 40),
  name text not null check (char_length(name) between 2 and 80),
  about text check (about is null or char_length(about) <= 600),
  experience_years integer check (experience_years is null or experience_years between 0 and 70),
  city text not null check (char_length(city) between 2 and 60),
  area text check (area is null or char_length(area) <= 80),
  phone text not null,
  whatsapp text,
  rate_note text check (rate_note is null or char_length(rate_note) <= 80),
  photo_url text,
  work_photos text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','approved','rejected','blocked')),
  featured_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists service_profiles_status_idx on public.service_profiles(status, category, city);
create index if not exists service_profiles_owner_idx on public.service_profiles(owner_id);

-- validation + safety: contact format, image sources, max 3 profiles per person, clients can never self-approve
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
  if cardinality(new.work_photos) > 4 then raise exception 'Maximum 4 kaam ki photos'; end if;
  foreach p in array new.work_photos loop
    if p !~* '^(https://|data:image/(jpeg|png|webp);base64,)' or char_length(p) > 250000 then raise exception 'Kaam ki photo sahi nahi'; end if;
  end loop;
  if tg_op = 'INSERT' then
    if (select count(*) from public.service_profiles where owner_id = new.owner_id) >= 3 then raise exception 'Maximum 3 service profiles'; end if;
    new.status := 'pending'; new.featured_until := null;
  else
    v_feat := new.featured_until;
    new.owner_id := old.owner_id; new.status := old.status; new.featured_until := old.featured_until;  -- only admin RPCs may change these
    if current_setting('nearshop.admin_edit', true) = '1' then new.status := coalesce(nullif(current_setting('nearshop.new_status', true), ''), old.status); new.featured_until := v_feat; end if;
    new.updated_at := now();
  end if;
  return new;
end $$;
drop trigger if exists service_profiles_guard on public.service_profiles;
create trigger service_profiles_guard before insert or update on public.service_profiles for each row execute function public.service_profiles_guard();

alter table public.service_profiles enable row level security;
revoke all on public.service_profiles from public, anon, authenticated;
grant select, insert, update, delete on public.service_profiles to authenticated;
drop policy if exists sp_read on public.service_profiles;
drop policy if exists sp_insert on public.service_profiles;
drop policy if exists sp_update on public.service_profiles;
drop policy if exists sp_delete on public.service_profiles;
create policy sp_read on public.service_profiles for select to authenticated using (status = 'approved' or owner_id = public.current_nearshop_user_id());
create policy sp_insert on public.service_profiles for insert to authenticated with check (owner_id = public.current_nearshop_user_id());
create policy sp_update on public.service_profiles for update to authenticated using (owner_id = public.current_nearshop_user_id()) with check (owner_id = public.current_nearshop_user_id());
create policy sp_delete on public.service_profiles for delete to authenticated using (owner_id = public.current_nearshop_user_id());

-- reviews (one per person per profile; not on your own profile)
create table if not exists public.service_reviews (
  profile_id uuid not null references public.service_profiles(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 300),
  author_name text,
  created_at timestamptz not null default now(),
  primary key (profile_id, user_id)
);
create or replace function public.service_reviews_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.current_nearshop_user_id();
begin
  new.user_id := v_me;
  if exists (select 1 from public.service_profiles p where p.id = new.profile_id and p.owner_id = v_me) then raise exception 'Apni profile ko review nahi de sakte'; end if;
  new.author_name := coalesce((select name from public.users where id = v_me), 'User');
  return new;
end $$;
drop trigger if exists service_reviews_guard on public.service_reviews;
create trigger service_reviews_guard before insert on public.service_reviews for each row execute function public.service_reviews_guard();
alter table public.service_reviews enable row level security;
revoke all on public.service_reviews from public, anon, authenticated;
grant select, insert, update, delete on public.service_reviews to authenticated;
drop policy if exists sr_read on public.service_reviews;
drop policy if exists sr_insert on public.service_reviews;
drop policy if exists sr_update on public.service_reviews;
drop policy if exists sr_delete on public.service_reviews;
create policy sr_read on public.service_reviews for select to authenticated using (exists (select 1 from public.service_profiles p where p.id = profile_id));
create policy sr_insert on public.service_reviews for insert to authenticated with check (user_id = public.current_nearshop_user_id());
create policy sr_update on public.service_reviews for update to authenticated using (user_id = public.current_nearshop_user_id()) with check (user_id = public.current_nearshop_user_id());
create policy sr_delete on public.service_reviews for delete to authenticated using (user_id = public.current_nearshop_user_id());

create or replace function public.service_ratings()
returns table(profile_id uuid, avg_rating numeric, reviews bigint) language sql stable security definer set search_path = public as $$
  select r.profile_id, round(avg(r.rating)::numeric, 1), count(*) from public.service_reviews r
  join public.service_profiles p on p.id = r.profile_id and p.status = 'approved' group by r.profile_id
$$;

-- reports (readable only by admin)
create table if not exists public.service_reports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.service_profiles(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 300),
  created_at timestamptz not null default now(),
  unique (profile_id, user_id)
);
alter table public.service_reports enable row level security;
revoke all on public.service_reports from public, anon, authenticated;
grant insert on public.service_reports to authenticated;
drop policy if exists srep_insert on public.service_reports;
create policy srep_insert on public.service_reports for insert to authenticated with check (user_id = public.current_nearshop_user_id());

-- admin
create or replace function public.admin_list_service_profiles(p_password text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.nearshop_admin_ok(p_password) then return null; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by (x.status = 'pending') desc, x.created_at desc) from (
    select p.id, p.owner_id, p.category, p.name, p.about, p.experience_years, p.city, p.area, p.phone, p.status, p.featured_until, p.created_at,
           p.photo_url, p.work_photos,
           (select count(*) from public.service_reports r where r.profile_id = p.id) as reports
    from public.service_profiles p) x), '[]'::jsonb);
end $$;
create or replace function public.admin_set_service_status(p_password text, p_id uuid, p_status text, p_featured_until timestamptz default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.nearshop_admin_ok(p_password) then return false; end if;
  if p_status not in ('pending','approved','rejected','blocked') then return false; end if;
  perform set_config('nearshop.admin_edit', '1', true);
  perform set_config('nearshop.new_status', p_status, true);
  update public.service_profiles set status = p_status,
    featured_until = case when p_featured_until is null then featured_until when p_featured_until <= now() then null else p_featured_until end
  where id = p_id;
  perform set_config('nearshop.admin_edit', '', true);
  return true;
end $$;
revoke all on function public.service_profiles_guard(), public.service_reviews_guard() from public, anon, authenticated;
revoke all on function public.service_ratings(), public.admin_list_service_profiles(text), public.admin_set_service_status(text, uuid, text, timestamptz) from public;
grant execute on function public.service_ratings() to authenticated;
grant execute on function public.admin_list_service_profiles(text), public.admin_set_service_status(text, uuid, text, timestamptz) to anon, authenticated;
