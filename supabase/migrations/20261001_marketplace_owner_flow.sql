-- NearShop owner marketplace flow: category-aware bids + one offer per shop/bid.
alter table public.bids add column if not exists category text;
update public.bids set category = case
  when lower(coalesce(item,'')) ~ '(paracetamol|medicine|tablet|capsule|syrup|goli|patta)' then 'Pharmacy'
  when lower(coalesce(item,'')) ~ '(shoe|shoes|sandal|slipper|juta|chappal)' then 'Footwear'
  when lower(coalesce(item,'')) ~ '(shirt|kurti|jeans|dress|tshirt|t-shirt|pant|kapda|clothing)' then 'Clothing'
  when lower(coalesce(item,'')) ~ '(paint|colour|color|shade)' then 'Paint'
  else 'Electronics' end where category is null;
create index if not exists bids_category_status_idx on public.bids(category,status,created_at desc);
create unique index if not exists bid_offers_bid_shop_unique on public.bid_offers(bid_id,shop_id);
