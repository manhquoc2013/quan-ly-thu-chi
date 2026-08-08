-- Shared household ledger (phase 1) — idempotent for Supabase SQL Editor
-- Project: brapacxuhvbolzjbenfr
-- Order: tables → helper fn → RLS → RPCs → storage

create extension if not exists "pgcrypto";

-- ── 1. Tables first (function below needs household_members) ─────────────────

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (household_id, user_id),
  unique (user_id)
);

create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  code text not null unique,
  expires_at timestamptz not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists household_members_household_id_idx on public.household_members (household_id);
create index if not exists household_invites_household_id_idx on public.household_invites (household_id);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  phone text not null default '',
  email text,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  default_unit_price bigint not null default 0 check (default_unit_price >= 0),
  unit text not null,
  sku text,
  notes text,
  image_path text,
  created_at timestamptz not null default now()
);

create unique index if not exists products_household_sku_uidx
  on public.products (household_id, sku)
  where sku is not null;

create table if not exists public.order_platforms (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  code text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists order_platforms_household_code_uidx
  on public.order_platforms (household_id, code)
  where code is not null;

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  date date not null,
  category text not null check (category in (
    'office', 'rent', 'utilities', 'salary', 'marketing',
    'supplies', 'transportation', 'maintenance', 'tax', 'other'
  )),
  amount bigint not null check (amount > 0),
  description text not null,
  status text not null check (status in ('pending', 'paid', 'cancelled')),
  payment_method text not null check (payment_method in (
    'cash', 'bank_transfer', 'credit_card', 'e_wallet'
  )),
  supplier text,
  notes text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

create table if not exists public.revenues (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  date date not null,
  order_code text not null,
  customer_id uuid not null references public.customers (id) on delete restrict,
  total_amount bigint not null check (total_amount >= 0),
  discount bigint not null default 0 check (discount >= 0),
  final_amount bigint not null check (final_amount >= 0),
  order_status text not null check (order_status in (
    'new', 'confirmed', 'processing', 'completed', 'cancelled'
  )),
  delivery_status text not null check (delivery_status in (
    'pending', 'shipping', 'delivered', 'returned'
  )),
  payment_method text not null check (payment_method in (
    'cash', 'bank_transfer', 'credit_card', 'e_wallet'
  )),
  payment_status text not null check (payment_status in ('unpaid', 'paid')),
  deposit_amount bigint check (deposit_amount is null or deposit_amount >= 0),
  deposited_at date,
  paid_amount bigint check (paid_amount is null or paid_amount >= 0),
  paid_at date,
  shipping_fee bigint check (shipping_fee is null or shipping_fee >= 0),
  shipping_payer text check (shipping_payer is null or shipping_payer in ('customer', 'shop')),
  shipping_expense_id uuid references public.expenses (id) on delete set null,
  platform_id uuid references public.order_platforms (id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, order_code)
);

drop trigger if exists revenues_set_updated_at on public.revenues;
create trigger revenues_set_updated_at
  before update on public.revenues
  for each row execute function public.set_updated_at();

create table if not exists public.revenue_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  revenue_id uuid not null references public.revenues (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name text not null,
  quantity integer not null check (quantity > 0),
  unit_price bigint not null check (unit_price > 0),
  total bigint not null check (total > 0),
  sort_index integer not null default 0
);

create index if not exists customers_household_id_idx on public.customers (household_id);
create index if not exists products_household_id_idx on public.products (household_id);
create index if not exists order_platforms_household_id_idx on public.order_platforms (household_id);
create index if not exists expenses_household_date_idx on public.expenses (household_id, date desc);
create index if not exists revenues_household_date_idx on public.revenues (household_id, date desc);
create index if not exists revenues_household_customer_idx on public.revenues (household_id, customer_id);
create index if not exists revenue_items_revenue_id_idx on public.revenue_items (revenue_id);
create index if not exists revenue_items_product_idx on public.revenue_items (household_id, product_id)
  where product_id is not null;

-- ── 2. Helper AFTER tables exist ─────────────────────────────────────────────

create or replace function public.is_household_member(hid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.household_members m
    where m.household_id = hid
      and m.user_id = auth.uid()
  );
end;
$$;

revoke all on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;

-- ── 3. RLS ───────────────────────────────────────────────────────────────────

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.order_platforms enable row level security;
alter table public.expenses enable row level security;
alter table public.revenues enable row level security;
alter table public.revenue_items enable row level security;

drop policy if exists households_select on public.households;
create policy households_select on public.households
  for select to authenticated
  using (public.is_household_member(id));

drop policy if exists household_members_select on public.household_members;
create policy household_members_select on public.household_members
  for select to authenticated
  using (public.is_household_member(household_id));

drop policy if exists household_invites_select on public.household_invites;
create policy household_invites_select on public.household_invites
  for select to authenticated
  using (public.is_household_member(household_id));

drop policy if exists household_invites_insert on public.household_invites;
create policy household_invites_insert on public.household_invites
  for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and created_by = auth.uid()
  );

drop policy if exists customers_all on public.customers;
create policy customers_all on public.customers
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists products_all on public.products;
create policy products_all on public.products
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists order_platforms_all on public.order_platforms;
create policy order_platforms_all on public.order_platforms
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists expenses_all on public.expenses;
create policy expenses_all on public.expenses
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists revenues_all on public.revenues;
create policy revenues_all on public.revenues
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists revenue_items_all on public.revenue_items;
create policy revenue_items_all on public.revenue_items
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- ── 4. RPCs ──────────────────────────────────────────────────────────────────

create or replace function public.create_household(p_name text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  row_h public.households;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if exists (select 1 from public.household_members where user_id = uid) then
    raise exception 'User already in a household';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'Household name required';
  end if;

  insert into public.households (name)
  values (trim(p_name))
  returning * into row_h;

  hid := row_h.id;

  insert into public.household_members (household_id, user_id, role)
  values (hid, uid, 'owner');

  insert into public.order_platforms (household_id, name, code, active) values
    (hid, 'Trực tiếp', 'direct', true),
    (hid, 'Facebook', 'facebook', true),
    (hid, 'Zalo', 'zalo', true),
    (hid, 'Shopee', 'shopee', true),
    (hid, 'TikTok', 'tiktok', true),
    (hid, 'Website', 'website', true),
    (hid, 'Khác', 'other', true);

  return row_h;
end;
$$;

create or replace function public.create_invite(p_expires_hours int default 72)
returns public.household_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  inv public.household_invites;
  code text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select household_id into hid
  from public.household_members
  where user_id = uid and role = 'owner';

  if hid is null then
    raise exception 'Only owner can create invites';
  end if;

  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.household_invites (household_id, code, expires_at, created_by)
  values (hid, code, now() + make_interval(hours => greatest(p_expires_hours, 1)), uid)
  returning * into inv;

  return inv;
end;
$$;

create or replace function public.redeem_invite(p_code text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inv public.household_invites;
  row_h public.households;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if exists (select 1 from public.household_members where user_id = uid) then
    raise exception 'User already in a household';
  end if;

  select * into inv
  from public.household_invites
  where code = upper(trim(p_code))
  for update;

  if inv.id is null then
    raise exception 'Invalid invite code';
  end if;
  if inv.used_by is not null then
    raise exception 'Invite already used';
  end if;
  if inv.expires_at < now() then
    raise exception 'Invite expired';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (inv.household_id, uid, 'member');

  update public.household_invites
  set used_by = uid, used_at = now()
  where id = inv.id;

  select * into row_h from public.households where id = inv.household_id;
  return row_h;
end;
$$;

create or replace function public.get_my_household()
returns table (
  household_id uuid,
  household_name text,
  role text
)
language sql
stable
security definer
set search_path = public
as $$
  select m.household_id, h.name, m.role
  from public.household_members m
  join public.households h on h.id = m.household_id
  where m.user_id = auth.uid()
  limit 1;
$$;

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

revoke all on function public.create_household(text) from public;
revoke all on function public.create_invite(int) from public;
revoke all on function public.redeem_invite(text) from public;
revoke all on function public.get_my_household() from public;
revoke all on function public.upsert_revenue_with_items(jsonb, jsonb) from public;

grant execute on function public.create_household(text) to authenticated;
grant execute on function public.create_invite(int) to authenticated;
grant execute on function public.redeem_invite(text) to authenticated;
grant execute on function public.get_my_household() to authenticated;
grant execute on function public.upsert_revenue_with_items(jsonb, jsonb) to authenticated;

-- ── 5. Storage: product images ───────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', false)
on conflict (id) do nothing;

drop policy if exists product_images_select on storage.objects;
create policy product_images_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'product-images'
    and public.is_household_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists product_images_insert on storage.objects;
create policy product_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and public.is_household_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists product_images_update on storage.objects;
create policy product_images_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'product-images'
    and public.is_household_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists product_images_delete on storage.objects;
create policy product_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and public.is_household_member((storage.foldername(name))[1]::uuid)
  );
