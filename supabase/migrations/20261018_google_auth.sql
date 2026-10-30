-- Google login: users table me auth_id + email, phone ab zaroori nahi.
alter table public.users add column if not exists auth_id uuid unique;
alter table public.users add column if not exists email text;
alter table public.users add column if not exists avatar_url text;
create unique index if not exists users_email_key on public.users (lower(email)) where email is not null;
alter table public.users alter column phone drop not null;

-- PURANE ACCOUNT KO GOOGLE SE JODNE KE LIYE (jaise teri dukaan wala account):
-- apna Gmail aur purana phone number daal ke Run karo, phir usi Gmail se Google login karo:
--   update public.users set email = lower('tera@gmail.com') where phone = '98XXXXXXXX';
