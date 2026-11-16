-- NearShop Feed v2: Instagram-style shop posts (photo + product + video link), follow shop, likes, comments,
-- and a "Feed Pro" membership (admin-activated; there is NO payment gateway, so nothing is auto-paid).
-- Run once in Supabase SQL editor. Safe to re-run. Old text posts keep working (they stay visible to everyone).

-- 1. Feed Pro membership ----------------------------------------------------
create table if not exists public.feed_pro (
  owner_id uuid primary key references public.users(id) on delete cascade,
  valid_until timestamptz,
  note text,
  updated_at timestamptz not null default now()
);
alter table public.feed_pro enable row level security;
revoke all on public.feed_pro from public, anon, authenticated;
grant select on public.feed_pro to authenticated;
drop policy if exists feed_pro_self_read on public.feed_pro;
create policy feed_pro_self_read on public.feed_pro for select to authenticated
using (owner_id = public.current_nearshop_user_id());

create or replace function public.nearshop_feed_pro(p_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.feed_pro f where f.owner_id = p_owner and (f.valid_until is null or f.valid_until > now()))
$$;
revoke all on function public.nearshop_feed_pro(uuid) from public;
grant execute on function public.nearshop_feed_pro(uuid) to anon, authenticated;

create or replace function public.admin_set_feed_pro(p_password text, p_owner_id uuid, p_valid_until timestamptz, p_note text default null)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare v_hash text;
begin
  select pass_hash into v_hash from public.app_admin where id = 1;
  if v_hash is null or p_password is null or extensions.crypt(p_password, v_hash) <> v_hash then
    perform pg_sleep(1); return false;
  end if;
  insert into public.feed_pro(owner_id, valid_until, note, updated_at) values (p_owner_id, p_valid_until, p_note, now())
  on conflict (owner_id) do update set valid_until = excluded.valid_until, note = excluded.note, updated_at = now();
  return true;
end $$;
create or replace function public.admin_list_feed_pro(p_password text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_hash text;
begin
  select pass_hash into v_hash from public.app_admin where id = 1;
  if v_hash is null or p_password is null or extensions.crypt(p_password, v_hash) <> v_hash then
    perform pg_sleep(1); return null;
  end if;
  return coalesce((select jsonb_agg(to_jsonb(f)) from public.feed_pro f), '[]'::jsonb);
end $$;
revoke all on function public.admin_set_feed_pro(text,uuid,timestamptz,text), public.admin_list_feed_pro(text) from public;
grant execute on function public.admin_set_feed_pro(text,uuid,timestamptz,text), public.admin_list_feed_pro(text) to anon, authenticated;

-- 2. feed_posts: new columns (old rows = v2 false = visible to everyone, exactly as before) -------
alter table public.feed_posts add column if not exists v2 boolean not null default false;
alter table public.feed_posts add column if not exists image_url text;
alter table public.feed_posts add column if not exists video_url text;
alter table public.feed_posts add column if not exists comments_count integer not null default 0;
do $$
declare t text;
begin
  select format_type(a.atttypid, a.atttypmod) into t from pg_attribute a
   where a.attrelid = 'public.products'::regclass and a.attname = 'id' and not a.attisdropped;
  execute format('alter table public.feed_posts add column if not exists product_id %s', t);
end $$;
alter table public.feed_posts drop constraint if exists feed_posts_video_url_check;
alter table public.feed_posts add constraint feed_posts_video_url_check check (
  video_url is null or video_url ~* '^https://([a-z0-9-]+\.)*(instagram\.com|youtube\.com|youtu\.be|facebook\.com|fb\.watch)(/|$)'
);

-- likes can no longer be edited by clients; the counter is maintained by trigger
revoke update on public.feed_posts from authenticated;
create or replace function public.feed_posts_before_insert()
returns trigger language plpgsql as $$
begin new.likes := 0; new.comments_count := 0; return new; end $$;
drop trigger if exists feed_posts_before_insert on public.feed_posts;
create trigger feed_posts_before_insert before insert on public.feed_posts
for each row execute function public.feed_posts_before_insert();

-- 3. Follow ---------------------------------------------------------------
create table if not exists public.feed_follows (
  user_id uuid not null references public.users(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, shop_id)
);
create index if not exists feed_follows_shop_idx on public.feed_follows(shop_id);
alter table public.feed_follows enable row level security;
revoke all on public.feed_follows from public, anon, authenticated;
grant select, insert, delete on public.feed_follows to authenticated;
drop policy if exists feed_follows_self_read on public.feed_follows;
drop policy if exists feed_follows_self_insert on public.feed_follows;
drop policy if exists feed_follows_self_delete on public.feed_follows;
create policy feed_follows_self_read on public.feed_follows for select to authenticated using (user_id = public.current_nearshop_user_id());
create policy feed_follows_self_insert on public.feed_follows for insert to authenticated with check (user_id = public.current_nearshop_user_id());
create policy feed_follows_self_delete on public.feed_follows for delete to authenticated using (user_id = public.current_nearshop_user_id());

-- follower count is public (counts only, never who)
create or replace function public.shop_follower_counts()
returns table(shop_id uuid, followers bigint) language sql stable security definer set search_path = public as $$
  select shop_id, count(*) from public.feed_follows group by shop_id
$$;
revoke all on function public.shop_follower_counts() from public;
grant execute on function public.shop_follower_counts() to anon, authenticated;

-- 4. Who can SEE a post: old posts -> all; new posts -> owner, followers, or everyone if the shop's owner has Feed Pro
create or replace function public.nearshop_can_see_post(p_shop uuid, p_v2 boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(not p_v2, false)
      or exists (select 1 from public.shops s where s.id = p_shop and (
            s.owner_id = public.current_nearshop_user_id()
            or public.nearshop_feed_pro(s.owner_id)
            or exists (select 1 from public.feed_follows f where f.shop_id = s.id and f.user_id = public.current_nearshop_user_id())))
$$;
revoke all on function public.nearshop_can_see_post(uuid, boolean) from public;
grant execute on function public.nearshop_can_see_post(uuid, boolean) to anon, authenticated;

drop policy if exists feed_posts_public_read on public.feed_posts;
drop policy if exists feed_posts_owner_insert on public.feed_posts;
drop policy if exists feed_posts_owner_delete on public.feed_posts;
drop policy if exists feed_posts_read_v2 on public.feed_posts;
create policy feed_posts_read_v2 on public.feed_posts for select to anon, authenticated
using (public.nearshop_can_see_post(shop_id, v2) or (shop_id is null and not v2));
create policy feed_posts_owner_insert on public.feed_posts for insert to authenticated
with check ((not v2 and (shop_id is null or public.nearshop_owns_shop(shop_id))) or (v2 and shop_id is not null and public.nearshop_owns_shop(shop_id)));
create policy feed_posts_owner_delete on public.feed_posts for delete to authenticated
using (shop_id is not null and public.nearshop_owns_shop(shop_id));

-- 5. Likes ----------------------------------------------------------------
do $$
declare t text;
begin
  select format_type(a.atttypid, a.atttypmod) into t from pg_attribute a
   where a.attrelid = 'public.feed_posts'::regclass and a.attname = 'id' and not a.attisdropped;
  execute format('create table if not exists public.feed_likes (post_id %s not null references public.feed_posts(id) on delete cascade, user_id uuid not null references public.users(id) on delete cascade, created_at timestamptz not null default now(), primary key (post_id, user_id))', t);
  execute format('create table if not exists public.feed_comments (id uuid primary key default gen_random_uuid(), post_id %s not null references public.feed_posts(id) on delete cascade, user_id uuid not null references public.users(id) on delete cascade, parent_id uuid references public.feed_comments(id) on delete cascade, author_name text, is_shop_reply boolean not null default false, text text not null check (char_length(text) between 1 and 500), created_at timestamptz not null default now())', t);
end $$;
create index if not exists feed_comments_post_idx on public.feed_comments(post_id, created_at);
alter table public.feed_likes enable row level security;
alter table public.feed_comments enable row level security;
revoke all on public.feed_likes, public.feed_comments from public, anon, authenticated;
grant select on public.feed_likes, public.feed_comments to anon, authenticated;
grant insert, delete on public.feed_likes to authenticated;
grant insert, delete on public.feed_comments to authenticated;

create or replace function public.feed_like_count_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update public.feed_posts set likes = likes + 1 where id = new.post_id;
  else update public.feed_posts set likes = greatest(0, likes - 1) where id = old.post_id; end if;
  return null;
end $$;
drop trigger if exists feed_likes_count on public.feed_likes;
create trigger feed_likes_count after insert or delete on public.feed_likes for each row execute function public.feed_like_count_sync();

drop policy if exists feed_likes_read on public.feed_likes;
drop policy if exists feed_likes_insert on public.feed_likes;
drop policy if exists feed_likes_delete on public.feed_likes;
create policy feed_likes_read on public.feed_likes for select to anon, authenticated
using (exists (select 1 from public.feed_posts p where p.id = post_id));   -- inherits feed_posts visibility
create policy feed_likes_insert on public.feed_likes for insert to authenticated
with check (user_id = public.current_nearshop_user_id() and exists (select 1 from public.feed_posts p where p.id = post_id));
create policy feed_likes_delete on public.feed_likes for delete to authenticated using (user_id = public.current_nearshop_user_id());

-- 6. Comments: anyone logged in may comment; ONLY the shop owner with active Feed Pro may reply (parent_id set)
create or replace function public.feed_comments_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.current_nearshop_user_id(); v_shop uuid; v_owner uuid; v_parent_post uuid;
begin
  if v_me is null then raise exception 'Login required'; end if;
  new.user_id := v_me;
  new.author_name := coalesce((select name from public.users where id = v_me), 'User');
  select p.shop_id into v_shop from public.feed_posts p where p.id = new.post_id;
  if not found then raise exception 'Post not found'; end if;
  if new.parent_id is null then
    new.is_shop_reply := false;
  else
    select post_id into v_parent_post from public.feed_comments where id = new.parent_id;
    if v_parent_post is distinct from new.post_id then raise exception 'Invalid reply'; end if;
    select owner_id into v_owner from public.shops where id = v_shop;
    if v_owner is distinct from v_me then raise exception 'Sirf dukan ka malik reply kar sakta hai'; end if;
    if not public.nearshop_feed_pro(v_me) then raise exception 'Reply ke liye Feed Pro membership chahiye'; end if;
    new.is_shop_reply := true;
  end if;
  return new;
end $$;
drop trigger if exists feed_comments_before_insert on public.feed_comments;
create trigger feed_comments_before_insert before insert on public.feed_comments for each row execute function public.feed_comments_before_insert();

create or replace function public.feed_comment_count_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update public.feed_posts set comments_count = comments_count + 1 where id = new.post_id;
  else update public.feed_posts set comments_count = greatest(0, comments_count - 1) where id = old.post_id; end if;
  return null;
end $$;
drop trigger if exists feed_comments_count on public.feed_comments;
create trigger feed_comments_count after insert or delete on public.feed_comments for each row execute function public.feed_comment_count_sync();

drop policy if exists feed_comments_read on public.feed_comments;
drop policy if exists feed_comments_insert on public.feed_comments;
drop policy if exists feed_comments_delete on public.feed_comments;
create policy feed_comments_read on public.feed_comments for select to anon, authenticated
using (exists (select 1 from public.feed_posts p where p.id = post_id));
create policy feed_comments_insert on public.feed_comments for insert to authenticated
with check (exists (select 1 from public.feed_posts p where p.id = post_id));   -- trigger enforces identity + reply rule
create policy feed_comments_delete on public.feed_comments for delete to authenticated
using (user_id = public.current_nearshop_user_id()
       or exists (select 1 from public.feed_posts p where p.id = post_id and p.shop_id is not null and public.nearshop_owns_shop(p.shop_id)));
