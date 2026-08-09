-- Ensure upsert_revenue_with_items persists priority / priority_at / stock_applied
-- (table columns may already exist from 20260809170000; RPC was still the old column list)

create or replace function public.upsert_revenue_with_items(
  p_revenue jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  rid uuid;
  item jsonb;
  idx int := 0;
begin
  hid := (p_revenue->>'household_id')::uuid;
  if not public.is_household_member(hid) then
    raise exception 'Forbidden';
  end if;

  rid := coalesce((p_revenue->>'id')::uuid, gen_random_uuid());

  insert into public.revenues (
    id, household_id, date, order_code, customer_id,
    total_amount, discount, final_amount,
    order_status, delivery_status, payment_method, payment_status,
    deposit_amount, deposited_at, paid_amount, paid_at,
    shipping_fee, shipping_payer, shipping_expense_id, platform_id, notes,
    stock_applied, priority, priority_at,
    created_at, updated_at
  ) values (
    rid,
    hid,
    (p_revenue->>'date')::date,
    p_revenue->>'order_code',
    (p_revenue->>'customer_id')::uuid,
    (p_revenue->>'total_amount')::bigint,
    coalesce((p_revenue->>'discount')::bigint, 0),
    (p_revenue->>'final_amount')::bigint,
    p_revenue->>'order_status',
    p_revenue->>'delivery_status',
    p_revenue->>'payment_method',
    p_revenue->>'payment_status',
    nullif(p_revenue->>'deposit_amount', '')::bigint,
    nullif(p_revenue->>'deposited_at', '')::date,
    nullif(p_revenue->>'paid_amount', '')::bigint,
    nullif(p_revenue->>'paid_at', '')::date,
    nullif(p_revenue->>'shipping_fee', '')::bigint,
    nullif(p_revenue->>'shipping_payer', ''),
    nullif(p_revenue->>'shipping_expense_id', '')::uuid,
    nullif(p_revenue->>'platform_id', '')::uuid,
    nullif(p_revenue->>'notes', ''),
    coalesce((p_revenue->>'stock_applied')::boolean, false),
    coalesce((p_revenue->>'priority')::boolean, false),
    nullif(p_revenue->>'priority_at', '')::timestamptz,
    coalesce((p_revenue->>'created_at')::timestamptz, now()),
    now()
  )
  on conflict (id) do update set
    date = excluded.date,
    order_code = excluded.order_code,
    customer_id = excluded.customer_id,
    total_amount = excluded.total_amount,
    discount = excluded.discount,
    final_amount = excluded.final_amount,
    order_status = excluded.order_status,
    delivery_status = excluded.delivery_status,
    payment_method = excluded.payment_method,
    payment_status = excluded.payment_status,
    deposit_amount = excluded.deposit_amount,
    deposited_at = excluded.deposited_at,
    paid_amount = excluded.paid_amount,
    paid_at = excluded.paid_at,
    shipping_fee = excluded.shipping_fee,
    shipping_payer = excluded.shipping_payer,
    shipping_expense_id = excluded.shipping_expense_id,
    platform_id = excluded.platform_id,
    notes = excluded.notes,
    stock_applied = excluded.stock_applied,
    priority = excluded.priority,
    priority_at = excluded.priority_at,
    updated_at = now();

  delete from public.revenue_items where revenue_id = rid;

  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    insert into public.revenue_items (
      id, household_id, revenue_id, product_id, name, quantity, unit_price, total, sort_index
    ) values (
      coalesce((item->>'id')::uuid, gen_random_uuid()),
      hid,
      rid,
      nullif(item->>'product_id', '')::uuid,
      item->>'name',
      (item->>'quantity')::int,
      (item->>'unit_price')::bigint,
      (item->>'total')::bigint,
      idx
    );
    idx := idx + 1;
  end loop;

  return rid;
end;
$$;
