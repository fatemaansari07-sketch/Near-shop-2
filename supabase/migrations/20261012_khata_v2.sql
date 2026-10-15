-- Khata v2: paid sales (loyalty), customer phone for WhatsApp.
alter table public.khata_entries drop constraint if exists khata_entries_kind_check;
alter table public.khata_entries add constraint khata_entries_kind_check check (kind in ('udhar','payment','sale'));
alter table public.khata_entries add column if not exists customer_phone text;
