-- NearShop follow-up fixes (run AFTER 20261110 and 20261111 migrations).
-- Idempotent. This migration fixes owner-controlled staff permissions and strengthens
-- server-side feature checks for broadcasts and promotions.

-- 1) Managers and employees receive ONLY the permissions explicitly selected by the owner.
create or replace function public.owner_set_staff(
  p_shop_id uuid,
  p_username text,
  p_role text,
  p_permissions text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_user uuid;
  v_id uuid;
  v_perms text[];
begin
  select owner_id into v_owner
  from public.shops
  where id = p_shop_id;

  if v_owner is null or v_owner <> public.current_nearshop_user_id() then
    raise exception 'NOT_OWNER';
  end if;

  if public.nearshop_plan_rank(public.nearshop_owner_plan(v_owner)) < 2 then
    raise exception 'PLAN_REQUIRED: staff access needs Business Pro';
  end if;

  if p_role not in ('manager','employee') then
    raise exception 'Invalid role';
  end if;

  select id into v_user
  from public.users
  where username = lower(trim(p_username));

  if v_user is null then raise exception 'USER_NOT_FOUND'; end if;
  if v_user = v_owner then raise exception 'Owner ko staff nahi bana sakte'; end if;

  v_perms := coalesce(p_permissions, '{}'::text[]);
  if cardinality(v_perms) = 0 then
    raise exception 'At least one permission select karein';
  end if;
  if not (v_perms <@ array['sell','inventory','reports','khata']::text[]) then
    raise exception 'Invalid staff permission';
  end if;

  insert into public.shop_staff(shop_id, user_id, role, permissions, created_by)
  values (p_shop_id, v_user, p_role, v_perms, v_owner)
  on conflict (shop_id, user_id)
  do update set
    role = excluded.role,
    permissions = excluded.permissions,
    revoked_at = null
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.owner_set_staff(uuid,text,text,text[]) from public, anon;
grant execute on function public.owner_set_staff(uuid,text,text,text[]) to authenticated;

-- 2) Broadcast OFF must block both new broadcasts and edits to existing broadcasts.
create or replace function public.enforce_broadcast_feature()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.nearshop_feature_on('broadcast') then
    raise exception 'FEATURE_OFF: broadcast is currently disabled by admin';
  end if;
  return new;
end;
$$;

drop trigger if exists broadcasts_feature_flag on public.broadcasts;
create trigger broadcasts_feature_flag
before insert or update on public.broadcasts
for each row execute function public.enforce_broadcast_feature();

-- 3) Feature type must match the admin feature key. Clearing a promotion is always allowed.
create or replace function public.enforce_promotion_feature()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
begin
  if tg_op = 'INSERT' then
    if new.promotion is null then return new; end if;
  elsif new.promotion is not distinct from old.promotion then
    return new;
  elsif new.promotion is null then
    return new;
  end if;

  if jsonb_typeof(new.promotion) <> 'object' or not (new.promotion ? 'type') then
    return new;
  end if;

  v_type := new.promotion->>'type';
  if not public.nearshop_feature_on(v_type) then
    raise exception 'FEATURE_OFF: % is currently disabled by admin', v_type;
  end if;
  return new;
end;
$$;

drop trigger if exists shops_promotion_feature_flag on public.shops;
drop trigger if exists shops_promotion_feature_flag_update on public.shops;
create trigger shops_promotion_feature_flag
before insert on public.shops
for each row execute function public.enforce_promotion_feature();
create trigger shops_promotion_feature_flag_update
before update of promotion on public.shops
for each row execute function public.enforce_promotion_feature();

drop trigger if exists products_promotion_feature_flag on public.products;
drop trigger if exists products_promotion_feature_flag_update on public.products;
create trigger products_promotion_feature_flag
before insert on public.products
for each row execute function public.enforce_promotion_feature();
create trigger products_promotion_feature_flag_update
before update of promotion on public.products
for each row execute function public.enforce_promotion_feature();
