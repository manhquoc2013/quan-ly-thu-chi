-- Align walk-in search with local: substring match on aliases (not exact equality).

create or replace function public.search_revenues_page(
  p_household_id uuid,
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_order_status text default null,
  p_payment_status text default null,
  p_customer_id uuid default null,
  p_priority_only boolean default false,
  p_offset integer default 0,
  p_limit integer default 20
)
returns table (
  id uuid,
  household_id uuid,
  date date,
  order_code text,
  customer_id uuid,
  total_amount bigint,
  discount bigint,
  final_amount bigint,
  order_status text,
  delivery_status text,
  payment_method text,
  payment_status text,
  deposit_amount bigint,
  deposited_at date,
  paid_amount bigint,
  paid_at date,
  shipping_fee bigint,
  shipping_payer text,
  shipping_expense_id uuid,
  platform_id uuid,
  notes text,
  stock_applied boolean,
  priority boolean,
  priority_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with filtered as (
    select
      r.*,
      count(*) over() as total_count
    from public.revenues r
    left join public.customers c
      on c.id = r.customer_id
     and c.household_id = r.household_id
    where r.household_id = p_household_id
      and public.is_household_member(p_household_id)
      and (p_date_from is null or r.date >= p_date_from)
      and (p_date_to is null or r.date <= p_date_to)
      and (p_order_status is null or r.order_status = p_order_status)
      and (p_payment_status is null or r.payment_status = p_payment_status)
      and (p_customer_id is null or r.customer_id = p_customer_id)
      and (not coalesce(p_priority_only, false) or r.priority is true)
      and (
        p_search is null
        or length(trim(p_search)) = 0
        or r.order_code ilike '%' || trim(p_search) || '%'
        or coalesce(r.notes, '') ilike '%' || trim(p_search) || '%'
        or coalesce(c.name, '') ilike '%' || trim(p_search) || '%'
        or (
          char_length(trim(p_search)) >= 3
          and r.customer_id = '00000000-0000-4000-8000-000000000001'::uuid
          and (
            'khách vãng lai' ilike '%' || trim(p_search) || '%'
            or 'khach vang lai' ilike '%' || trim(p_search) || '%'
            or 'vãng lai' ilike '%' || trim(p_search) || '%'
            or 'vang lai' ilike '%' || trim(p_search) || '%'
            or 'walk-in' ilike '%' || trim(p_search) || '%'
            or 'walk in' ilike '%' || trim(p_search) || '%'
          )
        )
      )
    order by
      r.priority desc nulls last,
      r.priority_at desc nulls last,
      r.date desc,
      r.created_at desc
  )
  select
    f.id,
    f.household_id,
    f.date,
    f.order_code,
    f.customer_id,
    f.total_amount,
    f.discount,
    f.final_amount,
    f.order_status,
    f.delivery_status,
    f.payment_method,
    f.payment_status,
    f.deposit_amount,
    f.deposited_at,
    f.paid_amount,
    f.paid_at,
    f.shipping_fee,
    f.shipping_payer,
    f.shipping_expense_id,
    f.platform_id,
    f.notes,
    f.stock_applied,
    f.priority,
    f.priority_at,
    f.created_at,
    f.updated_at,
    f.total_count
  from filtered f
  offset greatest(p_offset, 0)
  limit greatest(least(p_limit, 100), 1);
$$;
