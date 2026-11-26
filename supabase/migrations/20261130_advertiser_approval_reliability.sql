-- Advertiser approval reliability patch
-- Replaces the approval RPC with explicit row-count verification.
create or replace function public.admin_review_advertiser(
  p_password text,
  p_advertiser uuid,
  p_status text,
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_rows integer;
begin
  if not public.nearshop_admin_ok(p_password) then
    raise exception 'Admin verification failed';
  end if;

  if p_status not in ('approved','rejected','suspended') then
    raise exception 'Invalid advertiser status';
  end if;

  update public.advertiser_accounts
     set status=p_status,
         admin_note=nullif(left(coalesce(p_note,''),500),''),
         updated_at=now()
   where id=p_advertiser;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'Advertiser record nahi mila. Admin list refresh karke dobara try karein.';
  end if;

  return true;
end;
$$;

revoke all on function public.admin_review_advertiser(text,uuid,text,text) from public, anon, authenticated;
grant execute on function public.admin_review_advertiser(text,uuid,text,text) to anon, authenticated;

notify pgrst, 'reload schema';
