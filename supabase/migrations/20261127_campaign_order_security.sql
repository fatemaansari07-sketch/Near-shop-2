-- NearShop campaign/order permission hardening and reliable order-push retry state.
-- Run after 20261124_campaign_part1_audience_push_analytics.sql,
-- 20261125_orders_stock_coupons.sql and 20261126_order_push.sql.

-- SECURITY DEFINER RPCs must never inherit PostgreSQL's default PUBLIC EXECUTE.
revoke all on function public.quote_order(uuid,jsonb,text,uuid),
  public.place_order(uuid,jsonb,text,text,text,text,uuid,uuid),
  public.update_order_status(uuid,text,text),
  public.cancel_my_order(uuid),
  public.my_orders(),
  public.shop_orders(uuid,boolean)
from public, anon;

grant execute on function public.quote_order(uuid,jsonb,text,uuid),
  public.place_order(uuid,jsonb,text,text,text,text,uuid,uuid),
  public.update_order_status(uuid,text,text),
  public.cancel_my_order(uuid),
  public.my_orders(),
  public.shop_orders(uuid,boolean)
to authenticated;

revoke all on function public.register_device_token(text,text),
  public.unregister_device_token(text),
  public.set_my_audience(text,text),
  public.set_whatsapp_optin(text,boolean)
from public, anon;

grant execute on function public.register_device_token(text,text),
  public.unregister_device_token(text),
  public.set_my_audience(text,text),
  public.set_whatsapp_optin(text,boolean)
to authenticated;

-- Do not mark a new-order push as sent before FCM accepts it.
create or replace function public.order_push_targets(p_order uuid, p_event text)
returns table(token text, title text, body text)
language plpgsql security definer set search_path = public as $$
declare o public.orders; v_shop text; v_n int;
begin
  select * into o from public.orders where id = p_order;
  if not found then return; end if;
  select name into v_shop from public.shops where id = o.shop_id;
  if p_event = 'new' then
    select count(*) into v_n from public.order_items where order_id = o.id;
    return query
      select distinct d.token, 'Naya order aaya 📦'::text,
        (coalesce(o.customer_name,'Customer') || ' · ' || v_n || ' item · ₹' || o.total)::text
      from public.user_devices d
      where d.revoked_at is null and (
        d.user_id = (select owner_id from public.shops where id = o.shop_id)
        or d.user_id in (
          select st.user_id from public.shop_staff st
          where st.shop_id = o.shop_id and st.revoked_at is null and 'sell' = any(st.permissions)
        )
      );
  elsif p_event = 'status' then
    return query
      select distinct d.token,
        (case o.status
          when 'confirmed' then 'Order confirm ho gaya ✅'
          when 'ready' then 'Order taiyaar hai 🎉'
          when 'completed' then 'Order poora hua'
          when 'rejected' then 'Shop ne order mana kiya'
          else 'Order cancel hua' end)::text,
        (coalesce(v_shop,'NearShop') || ' · ₹' || o.total)::text
      from public.user_devices d
      where d.revoked_at is null and d.user_id = o.customer_id;
  end if;
end $$;

create or replace function public.order_push_done(p_order uuid, p_event text, p_sent integer, p_dead text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.user_devices set revoked_at = now()
    where token = any(coalesce(p_dead,'{}'));
  if p_event = 'new' and coalesce(p_sent,0) > 0 then
    update public.orders set push_new_sent = true where id = p_order;
  end if;
end $$;

revoke all on function public.order_push_authorize(uuid,text),
  public.order_push_targets(uuid,text),
  public.order_push_done(uuid,text,integer,text[])
from public, anon, authenticated;

grant execute on function public.order_push_authorize(uuid,text) to authenticated;
grant execute on function public.order_push_targets(uuid,text),
  public.order_push_done(uuid,text,integer,text[])
to service_role;
