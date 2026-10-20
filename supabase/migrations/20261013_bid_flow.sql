-- Bid flow: customer phone, accepted offer, extra statuses.
alter table public.bids add column if not exists customer_phone text;
alter table public.bids add column if not exists accepted_shop_id uuid references public.shops(id) on delete set null;
alter table public.bids add column if not exists accepted_at timestamptz;
alter table public.bids drop constraint if exists bids_status_check;
create index if not exists bid_offers_bid_idx on public.bid_offers(bid_id);
