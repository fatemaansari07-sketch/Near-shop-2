-- Campaign fix: admin RPCs are password-gated (nearshop_admin_ok), so anon must be able to call them
-- (same as admin_list_ads / admin_save_ad). Previously only 'authenticated' had execute.
grant execute on function public.admin_list_campaigns(text), public.admin_save_campaign(text,jsonb),
  public.admin_delete_campaign(text,uuid) to anon, authenticated;
grant execute on function public.live_admin_campaigns(), public.track_admin_campaign(uuid,text) to anon, authenticated;
create or replace function public.live_admin_campaigns()
returns setof public.admin_campaigns
language sql stable security definer set search_path=public as $$
  select * from public.admin_campaigns
  where status in ('published') and in_app_enabled=true
    and start_at <= now() and (end_at is null or end_at > now())
  order by created_at desc limit 100
$$;
grant execute on function public.live_admin_campaigns() to anon, authenticated;
