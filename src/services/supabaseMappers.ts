/**
 * Snake_case Supabase rows ↔ camelCase domain models.
 */

import type {
  Customer,
  Expense,
  ExpenseCategory,
  ExpenseStatus,
  OrderItem,
  OrderPlatform,
  OrderStatus,
  DeliveryStatus,
  PaymentStatus,
  PaymentMethod,
  Product,
  Revenue,
  ShippingPayer,
} from '@/models';

export interface ExpenseRow {
  id: string;
  household_id: string;
  date: string;
  category: string;
  amount: number;
  description: string;
  status: string;
  payment_method: string;
  supplier: string | null;
  notes: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerRow {
  id: string;
  household_id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  created_at: string;
}

export interface ProductRow {
  id: string;
  household_id: string;
  name: string;
  default_unit_price: number;
  unit: string;
  sku: string | null;
  notes: string | null;
  image_path: string | null;
  created_at: string;
}

export interface PlatformRow {
  id: string;
  household_id: string;
  name: string;
  code: string | null;
  active: boolean;
  created_at: string;
}

export interface RevenueRow {
  id: string;
  household_id: string;
  date: string;
  order_code: string;
  customer_id: string;
  total_amount: number;
  discount: number;
  final_amount: number;
  order_status: string;
  delivery_status: string;
  payment_method: string;
  payment_status: string;
  deposit_amount: number | null;
  deposited_at: string | null;
  paid_amount: number | null;
  paid_at: string | null;
  shipping_fee: number | null;
  shipping_payer: string | null;
  shipping_expense_id: string | null;
  platform_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RevenueItemRow {
  id: string;
  household_id: string;
  revenue_id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  sort_index: number;
}

export function mapExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    date: row.date,
    category: row.category as ExpenseCategory,
    amount: Number(row.amount),
    description: row.description,
    status: row.status as ExpenseStatus,
    paymentMethod: row.payment_method as PaymentMethod,
    supplier: row.supplier ?? undefined,
    notes: row.notes ?? undefined,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function expenseToRow(householdId: string, e: Expense): ExpenseRow {
  return {
    id: e.id,
    household_id: householdId,
    date: e.date,
    category: e.category,
    amount: e.amount,
    description: e.description,
    status: e.status,
    payment_method: e.paymentMethod,
    supplier: e.supplier ?? null,
    notes: e.notes ?? null,
    tags: e.tags ?? [],
    created_at: e.createdAt,
    updated_at: e.updatedAt,
  };
}

export function mapCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? '',
    email: row.email ?? undefined,
    address: row.address ?? undefined,
    createdAt: row.created_at,
  };
}

export function customerToRow(householdId: string, c: Customer): CustomerRow {
  return {
    id: c.id,
    household_id: householdId,
    name: c.name,
    phone: c.phone ?? '',
    email: c.email ?? null,
    address: c.address ?? null,
    created_at: c.createdAt,
  };
}

export function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    defaultUnitPrice: Number(row.default_unit_price),
    unit: row.unit,
    sku: row.sku ?? undefined,
    notes: row.notes ?? undefined,
    imagePath: row.image_path ?? undefined,
    createdAt: row.created_at,
  };
}

export function productToRow(householdId: string, p: Product): ProductRow {
  return {
    id: p.id,
    household_id: householdId,
    name: p.name,
    default_unit_price: p.defaultUnitPrice,
    unit: p.unit,
    sku: p.sku ?? null,
    notes: p.notes ?? null,
    image_path: p.imagePath ?? null,
    created_at: p.createdAt,
  };
}

export function mapPlatform(row: PlatformRow): OrderPlatform {
  return {
    id: row.id,
    name: row.name,
    code: row.code ?? undefined,
    active: row.active,
    createdAt: row.created_at,
  };
}

export function platformToRow(householdId: string, p: OrderPlatform): PlatformRow {
  return {
    id: p.id,
    household_id: householdId,
    name: p.name,
    code: p.code ?? null,
    active: p.active,
    created_at: p.createdAt,
  };
}

export function mapOrderItem(row: RevenueItemRow): OrderItem {
  return {
    id: row.id,
    productId: row.product_id ?? undefined,
    name: row.name,
    quantity: row.quantity,
    unitPrice: Number(row.unit_price),
    total: Number(row.total),
  };
}

export function mapRevenue(row: RevenueRow, items: RevenueItemRow[]): Revenue {
  const sorted = [...items].sort((a, b) => a.sort_index - b.sort_index);
  return {
    id: row.id,
    date: row.date,
    orderCode: row.order_code,
    customerId: row.customer_id,
    items: sorted.map(mapOrderItem),
    totalAmount: Number(row.total_amount),
    discount: Number(row.discount),
    finalAmount: Number(row.final_amount),
    orderStatus: row.order_status as OrderStatus,
    deliveryStatus: row.delivery_status as DeliveryStatus,
    paymentMethod: row.payment_method as PaymentMethod,
    paymentStatus: row.payment_status as PaymentStatus,
    depositAmount: row.deposit_amount != null ? Number(row.deposit_amount) : undefined,
    depositedAt: row.deposited_at ?? undefined,
    paidAmount: row.paid_amount != null ? Number(row.paid_amount) : undefined,
    paidAt: row.paid_at ?? undefined,
    shippingFee: row.shipping_fee != null ? Number(row.shipping_fee) : undefined,
    shippingPayer: (row.shipping_payer as ShippingPayer | null) ?? undefined,
    shippingExpenseId: row.shipping_expense_id ?? undefined,
    platformId: row.platform_id ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function revenueToUpsertPayload(householdId: string, r: Revenue): {
  revenue: Record<string, unknown>;
  items: Record<string, unknown>[];
} {
  return {
    revenue: {
      id: r.id,
      household_id: householdId,
      date: r.date,
      order_code: r.orderCode,
      customer_id: r.customerId,
      total_amount: r.totalAmount,
      discount: r.discount,
      final_amount: r.finalAmount,
      order_status: r.orderStatus,
      delivery_status: r.deliveryStatus,
      payment_method: r.paymentMethod,
      payment_status: r.paymentStatus,
      deposit_amount: r.depositAmount ?? null,
      deposited_at: r.depositedAt ?? null,
      paid_amount: r.paidAmount ?? null,
      paid_at: r.paidAt ?? null,
      shipping_fee: r.shippingFee ?? null,
      shipping_payer: r.shippingPayer ?? null,
      shipping_expense_id: r.shippingExpenseId ?? null,
      platform_id: r.platformId ?? null,
      notes: r.notes ?? null,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    },
    items: r.items.map((item, sort_index) => ({
      id: item.id,
      product_id: item.productId ?? null,
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total: item.total,
      sort_index,
    })),
  };
}
