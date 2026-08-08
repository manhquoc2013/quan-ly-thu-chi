-- Product on-hand stock + expense/order stock application flags

alter table public.products
  add column if not exists stock_qty bigint not null default 0;

alter table public.expenses
  add column if not exists stock_product_id uuid references public.products (id) on delete set null,
  add column if not exists stock_qty_in integer check (stock_qty_in is null or stock_qty_in > 0),
  add column if not exists stock_applied boolean not null default false;

alter table public.revenues
  add column if not exists stock_applied boolean not null default false;
