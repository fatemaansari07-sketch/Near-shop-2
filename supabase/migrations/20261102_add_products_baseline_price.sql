-- NearShop: baseline_price is used by product creation and PC/CSV imports.
-- Safe to run more than once. Existing products inherit their current selling price.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS baseline_price numeric;

UPDATE public.products
SET baseline_price = price
WHERE baseline_price IS NULL;

ALTER TABLE public.products
  ALTER COLUMN baseline_price SET DEFAULT 0;

NOTIFY pgrst, 'reload schema';
