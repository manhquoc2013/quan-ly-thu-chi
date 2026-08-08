-- Allow unpaid / TBD orders with 0đ line items

alter table public.revenue_items
  drop constraint if exists revenue_items_unit_price_check;

alter table public.revenue_items
  drop constraint if exists revenue_items_total_check;

alter table public.revenue_items
  add constraint revenue_items_unit_price_nonneg check (unit_price >= 0);

alter table public.revenue_items
  add constraint revenue_items_total_nonneg check (total >= 0);
