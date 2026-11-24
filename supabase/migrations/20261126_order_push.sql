-- Push notifications for orders: shopkeeper gets "naya order", customer gets status updates.
-- Run AFTER 20261125_orders_stock_coupons.sql. Used by Edge Function send-order-push.
alter table public.orders add column if not exists push_new_sent boolean not null default false;

-- Called with the CALLER's JWT: is this caller allowed to trigger this push?
create or replace function public.order_push_authorize(p_order uuid, p_event text)
returns boolean language plpgsql security definer set search_path = public as $$
declare o public.orders; v_uid uuid := public.current_nearshop_user_id();
begin
  select * into o from public.orders where id = p_order;
  if not found or v_uid is null then return false; end if;
  if p_event = 'new' then
    return o.customer_id = v_uid and o.status = 'placed' and not o.push_new_sent and o.created_at > now() - interval '10 minutes';
  elsif p_event = 'status' then
    return public.nearshop_can(o.shop_id, 'sell') and o.status in ('confirmed','ready','completed','cancelled','rejected');
  end if;
  return false;
end $$;

-- Service role only: who gets the push and what it says.
create or replace function public.order_push_targets(p_order uuid, p_event text)
returns table(token text, title text, body text) language plpgsql security definer set search_path = public as $$
declare o public.orders; v_shop text; v_n int;
begin
  select * into o from public.orders where id = p_order;
  if not found then return; end if;
  select name into v_shop from public.shops where id = o.shop_id;
  if p_event = 'new' then
    select count(*) into v_n from public.order_items where order_id = o.id;
    update public.orders set push_new_sent = true where id = o.id;
    return query select distinct d.token, 'Naya order aaya 📦'::text, (coalesce(o.customer_name,'Customer') || ' · ' || v_n || ' item · ₹' || o.total)::text
      from public.user_devices d
      where d.revoked_at is null and (
        d.user_id = (select owner_id from public.shops where id = o.shop_id)
        or d.user_id in (select st.user_id from public.shop_staff st where st.shop_id = o.shop_id and st.revoked_at is null and 'sell' = any(st.permissions)));
  else
    return query select distinct d.token,
      (case o.status when 'confirmed' then 'Order confirm ho gaya ✅' when 'ready' then 'Order taiyaar hai 🎉' when 'completed' then 'Order poora hua' when 'rejected' then 'Shop ne order mana kiya' else 'Order cancel hua' end)::text,
      (v_shop || ' · ₹' || o.total)::text
      from public.user_devices d where d.revoked_at is null and d.user_id = o.customer_id;
  end if;
end $$;

revoke all on function public.order_push_authorize(uuid,text), public.order_push_targets(uuid,text) from public, anon, authenticated;
grant execute on function public.order_push_authorize(uuid,text) to authenticated;
grant execute on function public.order_push_targets(uuid,text) to service_role;
