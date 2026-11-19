-- Who made each sale: new bills remember the logged-in seller (owner or staff). Old bills stay "unknown".
alter table public.bills add column if not exists sold_by uuid references public.users(id) on delete set null;

create or replace function public.bills_set_sold_by()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.sold_by is null then new.sold_by := public.current_nearshop_user_id(); end if;
  return new;
end $$;
drop trigger if exists bills_set_sold_by on public.bills;
create trigger bills_set_sold_by before insert on public.bills for each row execute function public.bills_set_sold_by();

-- Owner-only: sales per shop per seller in a date range (aggregates only).
create or replace function public.owner_staff_sales(p_from timestamptz default null, p_to timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := public.current_nearshop_user_id();
begin
  if v_uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  if public.nearshop_plan_rank(public.nearshop_owner_plan(v_uid)) < 1 then raise exception 'PLAN_REQUIRED: needs Multi-Shop or Business Pro'; end if;
  return coalesce((
    select jsonb_agg(r order by r->>'shop_name', (r->>'total')::numeric desc) from (
      select jsonb_build_object(
        'shop_id', s.id, 'shop_name', s.name, 'user_id', b.sold_by,
        'name', coalesce(u.name, 'Pehle ka (record nahi)'),
        'is_owner', b.sold_by = s.owner_id,
        'bills', count(*), 'total', coalesce(sum(b.total), 0)) as r
      from public.bills b
      join public.shops s on s.id = b.shop_id and s.owner_id = v_uid
      left join public.users u on u.id = b.sold_by
      where b.voided_at is null
        and b.created_at >= coalesce(p_from, now() - interval '30 days') and b.created_at <= coalesce(p_to, now())
      group by s.id, s.name, b.sold_by, u.name, s.owner_id
    ) x), '[]'::jsonb);
end $$;
revoke all on function public.owner_staff_sales(timestamptz, timestamptz) from public;
grant execute on function public.owner_staff_sales(timestamptz, timestamptz) to authenticated;
