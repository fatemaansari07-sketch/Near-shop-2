-- Secure delivery for Admin Campaign Center.
-- Customer/shopkeeper/category audiences are resolved from the authenticated NearShop user.
-- City/state and selected-user delivery stay hidden until a reliable user-location/selection model exists.
create or replace function public.live_admin_campaigns()
returns setof public.admin_campaigns
language sql
stable
security definer
set search_path = public
as $$
  select c.*
  from public.admin_campaigns c
  where c.status = 'published'
    and c.in_app_enabled = true
    and c.start_at <= now()
    and (c.end_at is null or c.end_at > now())
    and (
      c.audience_type = 'all'
      or (
        auth.uid() is not null
        and exists (
          select 1 from public.users u
          where u.auth_id = auth.uid()
            and (
              (c.audience_type = 'customers' and not exists (
                select 1 from public.shops s where s.owner_id = u.id
              ) and not exists (
                select 1 from public.shop_staff st where st.user_id = u.id and st.revoked_at is null
              ))
              or
              (c.audience_type = 'shopkeepers' and (
                exists (select 1 from public.shops s where s.owner_id = u.id)
                or exists (select 1 from public.shop_staff st where st.user_id = u.id and st.revoked_at is null)
              ))
              or
              (c.audience_type = 'category' and (
                exists (
                  select 1 from public.shops s
                  where s.owner_id = u.id
                    and lower(coalesce(s.category, '')) = lower(coalesce(c.audience_category, ''))
                )
                or exists (
                  select 1 from public.shop_staff st join public.shops s on s.id = st.shop_id
                  where st.user_id = u.id and st.revoked_at is null
                    and lower(coalesce(s.category, '')) = lower(coalesce(c.audience_category, ''))
                )
              ))
            )
        )
      )
    )
  order by c.created_at desc
  limit 100;
$$;

-- Only permit event counters to change for campaigns the caller could receive.
create or replace function public.track_admin_campaign(p_id uuid, p_event text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_event not in ('view', 'click') then return; end if;

  update public.admin_campaigns c
  set impressions = c.impressions + case when p_event = 'view' then 1 else 0 end,
      clicks = c.clicks + case when p_event = 'click' then 1 else 0 end
  where c.id = p_id
    and c.status = 'published'
    and c.in_app_enabled = true
    and c.start_at <= now()
    and (c.end_at is null or c.end_at > now())
    and (
      c.audience_type = 'all'
      or (
        auth.uid() is not null
        and exists (
          select 1 from public.users u
          where u.auth_id = auth.uid()
            and (
              (c.audience_type = 'customers' and not exists (
                select 1 from public.shops s where s.owner_id = u.id
              ) and not exists (
                select 1 from public.shop_staff st where st.user_id = u.id and st.revoked_at is null
              ))
              or
              (c.audience_type = 'shopkeepers' and (
                exists (select 1 from public.shops s where s.owner_id = u.id)
                or exists (select 1 from public.shop_staff st where st.user_id = u.id and st.revoked_at is null)
              ))
              or
              (c.audience_type = 'category' and (
                exists (
                  select 1 from public.shops s
                  where s.owner_id = u.id
                    and lower(coalesce(s.category, '')) = lower(coalesce(c.audience_category, ''))
                )
                or exists (
                  select 1 from public.shop_staff st join public.shops s on s.id = st.shop_id
                  where st.user_id = u.id and st.revoked_at is null
                    and lower(coalesce(s.category, '')) = lower(coalesce(c.audience_category, ''))
                )
              ))
            )
        )
      )
    );
end;
$$;

revoke all on function public.live_admin_campaigns() from public;
revoke all on function public.track_admin_campaign(uuid, text) from public;
grant execute on function public.live_admin_campaigns() to anon, authenticated;
grant execute on function public.track_admin_campaign(uuid, text) to anon, authenticated;
