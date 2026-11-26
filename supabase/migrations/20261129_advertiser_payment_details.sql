-- Advertiser wallet payment instructions (manual UPI / bank transfer).
-- Run AFTER 20261128_external_advertiser_platform.sql.
-- Safe to re-run.

insert into public.platform_settings(id, settings, updated_at)
values (
  'advertiser_payment',
  '{"upi_id":"","payee_name":"NearShop","qr_image_url":"","bank_name":"","account_name":"","account_number":"","ifsc":"","instructions":"Payment ke baad UTR / transaction reference submit karein. Admin verification ke baad wallet credit hoga."}'::jsonb,
  now()
)
on conflict (id) do nothing;

-- Advertisers need to read only the public payment instructions. Existing admin-only
-- write protection on platform_settings remains in place.
drop policy if exists "advertiser payment details readable" on public.platform_settings;
create policy "advertiser payment details readable"
  on public.platform_settings
  for select to anon, authenticated
  using (id = 'advertiser_payment');

-- Extend the existing password-protected settings writer for this one public config row.
-- Do not allow clients to write the row directly.
create or replace function public.admin_update_platform_setting(
  p_password text,
  p_id text,
  p_settings jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_id not in ('features','plans','advertiser_payment') then
    raise exception 'Unsupported setting id';
  end if;
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' then
    raise exception 'Invalid settings';
  end if;
  if p_id = 'advertiser_payment' then
    if length(coalesce(p_settings->>'upi_id','')) > 120
       or length(coalesce(p_settings->>'payee_name','')) > 120
       or length(coalesce(p_settings->>'qr_image_url','')) > 1000
       or length(coalesce(p_settings->>'bank_name','')) > 120
       or length(coalesce(p_settings->>'account_name','')) > 120
       or length(coalesce(p_settings->>'account_number','')) > 40
       or length(coalesce(p_settings->>'ifsc','')) > 20
       or length(coalesce(p_settings->>'instructions','')) > 500 then
      raise exception 'Payment setting value is too long';
    end if;
    if coalesce(p_settings->>'qr_image_url','') <> ''
       and p_settings->>'qr_image_url' !~* '^https://' then
      raise exception 'QR image URL must use HTTPS';
    end if;
  end if;
  if not public.nearshop_admin_ok(p_password) then
    perform pg_sleep(1);
    return false;
  end if;
  insert into public.platform_settings(id, settings, updated_at)
  values (p_id, p_settings, now())
  on conflict (id) do update
    set settings = excluded.settings, updated_at = now();
  return true;
end;
$$;

revoke all on function public.admin_update_platform_setting(text,text,jsonb) from public;
grant execute on function public.admin_update_platform_setting(text,text,jsonb) to anon, authenticated;

comment on table public.platform_settings is
  'Platform configuration. advertiser_payment contains public advertiser wallet payment instructions; writes are restricted to password-verified admin RPC.';
