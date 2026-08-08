/**
 * Chat tools — execute structured intents against app services/stores.
 */

import type { Expense, Revenue, OrderStatus } from '@/models';
import { EXPENSE_CATEGORY_LABELS, ORDER_STATUS_LABELS } from '@/models';
import { formatCurrency } from '@/utils/currency';
import { sumPaidRevenue, sumUnpaidReceivable } from '@/utils/revenueMetrics';
import {
  updateExpense,
  deleteExpenses,
} from './expenseService';
import {
  updateRevenue,
  deleteRevenues,
} from './revenueService';
import { persistConfirmed } from './intakeService';
import { intentToDraft, type ChatIntent } from './chatIntent';
import {
  resolveCustomerForOrder,
  resolveProductForOrder,
  resolvePlatformForOrder,
  formatEntityPickMessage,
  type EntityOption,
} from './entityResolve';
import { findOrCreateCustomerByName, createCustomer, updateCustomer, deleteCustomer } from './customerService';
import {
  createProduct,
  updateProduct,
  deleteProduct,
  searchProducts,
} from './productService';
import {
  createPlatform,
  updatePlatform,
  deletePlatform,
} from './platformService';
import { useExpenseStore } from '@/store/expenseStore';
import { useRevenueStore } from '@/store/revenueStore';
import { useCustomerStore } from '@/store';
import { useProductStore } from '@/store/productStore';
import { usePlatformStore } from '@/store/platformStore';

export interface ToolResult {
  ok: boolean;
  message: string;
  needDeleteConfirm?: boolean;
  needEntityPick?: {
    kind: 'customer' | 'product' | 'platform';
    query: string;
    options: EntityOption[];
  };
  createdRecord?: { kind: 'expense' | 'revenue' | 'product'; id: string };
  matchedMultiple?: Array<{ id: string; label: string }>;
}

function scoreText(hay: string, needle: string): number {
  const h = hay.toLowerCase();
  const n = needle.toLowerCase().trim();
  if (!n) return 0;
  if (h === n) return 100;
  if (h.includes(n)) return 80;
  const parts = n.split(/\s+/).filter(Boolean);
  const hit = parts.filter((p) => h.includes(p)).length;
  return parts.length ? (hit / parts.length) * 60 : 0;
}

export function findExpenses(intent: ChatIntent): Expense[] {
  const records = useExpenseStore.getState().records;
  const hint = intent.targetHint || intent.description || intent.query || '';
  let list = [...records];
  if (hint) {
    list = list
      .map((e) => ({
        e,
        s: Math.max(scoreText(e.description, hint), scoreText(e.id, hint), scoreText(e.notes ?? '', hint)),
      }))
      .filter((x) => x.s >= 40)
      .sort((a, b) => b.s - a.s || b.e.date.localeCompare(a.e.date))
      .map((x) => x.e);
  }
  if (intent.amount) {
    const amt = intent.amount;
    const filtered = list.filter((e) => e.amount === amt);
    if (filtered.length) list = filtered;
  }
  return list;
}

export function findRevenues(intent: ChatIntent): Revenue[] {
  const records = useRevenueStore.getState().records;
  const hint = intent.targetHint || intent.description || intent.query || '';
  let list = [...records];
  if (hint) {
    list = list
      .map((r) => ({
        r,
        s: Math.max(
          scoreText(r.orderCode, hint),
          scoreText(r.notes ?? '', hint),
          scoreText(r.items.map((i) => i.name).join(' '), hint),
          scoreText(r.id, hint),
        ),
      }))
      .filter((x) => x.s >= 40)
      .sort((a, b) => b.s - a.s || b.r.date.localeCompare(a.r.date))
      .map((x) => x.r);
  }
  if (intent.amount) {
    const amt = intent.amount;
    const filtered = list.filter((r) => r.finalAmount === amt);
    if (filtered.length) list = filtered;
  }
  return list;
}

function multiMatchMessage(
  kind: string,
  items: Array<{ id: string; label: string }>,
): ToolResult {
  const label =
    kind === 'expense'
      ? 'chi phí'
      : kind === 'revenue'
        ? 'đơn'
        : kind === 'product'
          ? 'sản phẩm'
          : kind === 'customer'
            ? 'khách'
            : kind === 'platform'
              ? 'kênh'
              : kind;
  const lines = items
    .slice(0, 5)
    .map((i, idx) => `${idx + 1}. ${i.label}`)
    .join('\n');
  return {
    ok: false,
    message: `Tìm thấy nhiều ${label} khớp. Cho mình biết rõ hơn (mã/tên):\n${lines}`,
    matchedMultiple: items,
  };
}

async function ensureCustomer(name?: string): Promise<string> {
  if (!name?.trim()) return 'walk-in';
  const customer = await findOrCreateCustomerByName(name, { silent: true });
  return customer.id;
}

function findProducts(intent: ChatIntent) {
  const hint = (intent.targetHint || intent.description || '').trim();
  const all = useProductStore.getState().products;
  if (!hint) return all.slice(0, 8);
  return searchProducts(hint, 20)
    .map((p) => ({ p, score: scoreText(p.name, hint) }))
    .filter((x) => x.score >= 40)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.p);
}

function findCustomers(intent: ChatIntent) {
  const hint = (intent.targetHint || intent.customerName || intent.description || '').trim();
  const all = useCustomerStore.getState().customers;
  if (!hint) return all.slice(0, 8);
  return all
    .map((c) => ({ c, score: Math.max(scoreText(c.name, hint), scoreText(c.phone || '', hint)) }))
    .filter((x) => x.score >= 40)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c);
}

function findPlatforms(intent: ChatIntent) {
  const hint = (intent.targetHint || intent.platformName || intent.description || '').trim();
  const all = usePlatformStore.getState().platforms;
  if (!hint) return all.slice(0, 8);
  return all
    .map((p) => ({
      p,
      score: Math.max(scoreText(p.name, hint), scoreText(p.code || '', hint)),
    }))
    .filter((x) => x.score >= 40)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.p);
}

export async function executeChatIntent(
  intent: ChatIntent,
  opts?: { deleteConfirmed?: boolean },
): Promise<ToolResult> {
  switch (intent.intent) {
    case 'create_expense': {
      const draft = intentToDraft(intent, 'text');
      if (!draft) {
        return { ok: false, message: 'Thiếu thông tin để tạo bản ghi.' };
      }
      const { ok, failed, created } = await persistConfirmed([draft]);
      if (ok > 0 && created[0]) {
        return {
          ok: true,
          message: `Đã thêm chi phí: **${draft.description}** — ${formatCurrency(draft.amount)}`,
          createdRecord: { kind: created[0].kind, id: created[0].id },
        };
      }
      return { ok: false, message: failed.join('; ') || 'Không lưu được.' };
    }

    case 'create_revenue': {
      const draft = intentToDraft(intent, 'text');
      if (!draft) {
        return { ok: false, message: 'Thiếu thông tin để tạo bản ghi.' };
      }

      const qty = draft.quantity ?? 1;
      const suggestedUnit =
        draft.unitPrice ?? (draft.amount > 0 ? Math.round(draft.amount / qty) : 0);

      const cust = await resolveCustomerForOrder(intent.customerName, {
        customerId: intent.customerId,
        forceCreate: intent.forceNewCustomer,
        silent: true,
      });
      if (cust.status === 'ambiguous') {
        return {
          ok: false,
          message: formatEntityPickMessage('customer', cust.query, cust.options),
          needEntityPick: {
            kind: 'customer',
            query: cust.query,
            options: cust.options,
          },
        };
      }

      const prod = await resolveProductForOrder(draft.description, {
        productId: intent.productId,
        forceCreate: intent.forceNewProduct,
        suggestedPrice: suggestedUnit,
        silent: true,
      });
      if (prod.status === 'ambiguous') {
        return {
          ok: false,
          message: formatEntityPickMessage('product', prod.query, prod.options),
          needEntityPick: {
            kind: 'product',
            query: prod.query,
            options: prod.options,
          },
        };
      }

      const plat = await resolvePlatformForOrder(intent.platformName, {
        platformId: intent.platformId,
        forceCreate: intent.forceNewPlatform,
        silent: true,
      });
      if (plat.status === 'ambiguous') {
        return {
          ok: false,
          message: formatEntityPickMessage('platform', plat.query, plat.options),
          needEntityPick: {
            kind: 'platform',
            query: plat.query,
            options: plat.options,
          },
        };
      }

      draft.customerId = cust.status === 'walk-in' ? 'walk-in' : cust.id;
      if (cust.status === 'resolved') draft.customerName = cust.name;
      if (prod.status === 'resolved') {
        draft.productId = prod.id;
      }
      if (plat.status === 'resolved') {
        draft.platformId = plat.id;
      }

      const { ok, failed, created } = await persistConfirmed([draft]);
      if (ok > 0 && created[0]) {
        const custLabel =
          draft.customerName && draft.customerId !== 'walk-in'
            ? ` · khách **${draft.customerName}**`
            : '';
        const platLabel =
          plat.status === 'resolved' ? ` · kênh **${plat.name}**` : '';
        const qtyLabel = (draft.quantity ?? 1) > 1 ? ` · SL **${draft.quantity}**` : '';
        const payLabel =
          draft.paymentStatus === 'paid'
            ? draft.paymentMethod === 'bank_transfer'
              ? ' · **đã TT · CK**'
              : ' · **đã thanh toán**'
            : '';
        return {
          ok: true,
          message: `Đã thêm doanh thu: **${prod.status === 'resolved' ? prod.name : draft.description}** — ${formatCurrency(draft.amount)}${qtyLabel}${custLabel}${platLabel}${payLabel}`,
          createdRecord: { kind: created[0].kind, id: created[0].id },
        };
      }
      return { ok: false, message: failed.join('; ') || 'Không lưu được.' };
    }

    case 'create_product': {
      const name = (intent.description || '').trim();
      const price = intent.unitPrice ?? intent.amount ?? 0;
      if (name.length < 2 || !(price > 0)) {
        return { ok: false, message: 'Thiếu tên hoặc đơn giá sản phẩm.' };
      }
      const record = await createProduct(
        { name, defaultUnitPrice: price, unit: 'cái' },
        { silent: true },
      );
      return {
        ok: true,
        message: `Đã thêm sản phẩm: **${record.name}** — ${formatCurrency(record.defaultUnitPrice)}`,
        createdRecord: { kind: 'product', id: record.id },
      };
    }

    case 'create_customer': {
      const name = (intent.customerName || intent.description || '').trim();
      if (name.length < 2) return { ok: false, message: 'Thiếu tên khách hàng.' };
      const record = await createCustomer({ name, phone: '' }, { silent: true });
      return {
        ok: true,
        message: `Đã thêm khách: **${record.name}**`,
      };
    }

    case 'create_platform': {
      const name = (intent.platformName || intent.description || '').trim();
      if (name.length < 2) return { ok: false, message: 'Thiếu tên kênh.' };
      const record = await createPlatform({ name, active: true }, { silent: true });
      return {
        ok: true,
        message: `Đã thêm kênh: **${record.name}**`,
      };
    }

    case 'update_expense': {
      const hits = findExpenses(intent);
      if (hits.length === 0) return { ok: false, message: 'Không tìm thấy chi phí phù hợp.' };
      if (hits.length > 1) {
        return multiMatchMessage(
          'expense',
          hits.map((e) => ({
            id: e.id,
            label: `${e.date} · ${e.description} · ${formatCurrency(e.amount)}`,
          })),
        );
      }
      const e = hits[0]!;
      await updateExpense(e.id, {
        amount: intent.amount ?? e.amount,
        description: intent.description ?? e.description,
        category: intent.category ?? e.category,
      });
      return {
        ok: true,
        message: `Đã cập nhật chi phí **${intent.description ?? e.description}**.`,
        createdRecord: { kind: 'expense', id: e.id },
      };
    }

    case 'update_revenue': {
      const hits = findRevenues(intent);
      if (hits.length === 0) return { ok: false, message: 'Không tìm thấy đơn hàng phù hợp.' };
      if (hits.length > 1) {
        return multiMatchMessage(
          'revenue',
          hits.map((r) => ({
            id: r.id,
            label: `${r.orderCode} · ${formatCurrency(r.finalAmount)} · ${ORDER_STATUS_LABELS[r.orderStatus]}`,
          })),
        );
      }
      const r = hits[0]!;
      const patch: Parameters<typeof updateRevenue>[1] = {};
      if (intent.orderStatus) patch.orderStatus = intent.orderStatus;
      if (intent.customerName) {
        patch.customerId = await ensureCustomer(intent.customerName);
        patch.notes = `Khách: ${intent.customerName}`;
      }
      if (intent.amount && intent.amount > 0) {
        const qty = r.items[0]?.quantity ?? 1;
        const unit = Math.round(intent.amount / qty);
        patch.items = r.items.map((it, idx) =>
          idx === 0
            ? {
                ...it,
                name: intent.description ?? it.name,
                unitPrice: unit,
                total: intent.amount!,
              }
            : it,
        );
        patch.totalAmount = intent.amount;
        patch.finalAmount = intent.amount - (r.discount || 0);
      } else if (intent.description && r.items[0]) {
        patch.items = r.items.map((it, idx) =>
          idx === 0 ? { ...it, name: intent.description! } : it,
        );
      }
      await updateRevenue(r.id, patch);
      return {
        ok: true,
        message: `Đã cập nhật đơn **${r.orderCode}**.`,
        createdRecord: { kind: 'revenue', id: r.id },
      };
    }

    case 'delete_expense': {
      const hits = findExpenses(intent);
      if (hits.length === 0) return { ok: false, message: 'Không tìm thấy chi phí để xóa.' };
      if (hits.length > 1) {
        return multiMatchMessage(
          'expense',
          hits.map((e) => ({
            id: e.id,
            label: `${e.date} · ${e.description} · ${formatCurrency(e.amount)}`,
          })),
        );
      }
      const e = hits[0]!;
      if (!opts?.deleteConfirmed) {
        return {
          ok: false,
          needDeleteConfirm: true,
          message: `Xóa chi phí **${e.description}** (${formatCurrency(e.amount)})? Gõ **xác nhận** để xóa, hoặc **hủy**.`,
          createdRecord: { kind: 'expense', id: e.id },
        };
      }
      await deleteExpenses([e.id]);
      return { ok: true, message: `Đã xóa chi phí **${e.description}**.` };
    }

    case 'delete_revenue': {
      const hits = findRevenues(intent);
      if (hits.length === 0) return { ok: false, message: 'Không tìm thấy đơn để xóa.' };
      if (hits.length > 1) {
        return multiMatchMessage(
          'revenue',
          hits.map((r) => ({
            id: r.id,
            label: `${r.orderCode} · ${formatCurrency(r.finalAmount)}`,
          })),
        );
      }
      const r = hits[0]!;
      if (!opts?.deleteConfirmed) {
        return {
          ok: false,
          needDeleteConfirm: true,
          message: `Xóa đơn **${r.orderCode}** (${formatCurrency(r.finalAmount)})? Gõ **xác nhận** để xóa, hoặc **hủy**.`,
          createdRecord: { kind: 'revenue', id: r.id },
        };
      }
      await deleteRevenues([r.id]);
      return { ok: true, message: `Đã xóa đơn **${r.orderCode}**.` };
    }

    case 'update_product': {
      const hits = findProducts(intent);
      if (hits.length === 0) return { ok: false, message: 'Không tìm thấy sản phẩm phù hợp.' };
      if (hits.length > 1) {
        return multiMatchMessage(
          'product',
          hits.map((p) => ({
            id: p.id,
            label: `${p.name} · ${formatCurrency(p.defaultUnitPrice)}`,
          })),
        );
      }
      const p = hits[0]!;
      const price = intent.unitPrice ?? intent.amount;
      const patch: { name?: string; defaultUnitPrice?: number } = {};
      if (intent.description && intent.description.trim().length >= 2 && intent.description !== p.name) {
        patch.name = intent.description.trim();
      }
      if (price && price > 0) patch.defaultUnitPrice = price;
      if (!patch.name && patch.defaultUnitPrice === undefined) {
        return { ok: false, message: 'Chưa có thay đổi (tên/giá) để cập nhật.' };
      }
      const updated = await updateProduct(p.id, patch, { silent: true });
      if (!updated) return { ok: false, message: 'Không cập nhật được sản phẩm.' };
      return {
        ok: true,
        message: `Đã cập nhật SP **${updated.name}** — ${formatCurrency(updated.defaultUnitPrice)}`,
        createdRecord: { kind: 'product', id: updated.id },
      };
    }

    case 'update_customer': {
      const hits = findCustomers(intent);
      if (hits.length === 0) return { ok: false, message: 'Không tìm thấy khách phù hợp.' };
      if (hits.length > 1) {
        return multiMatchMessage(
          'customer',
          hits.map((c) => ({ id: c.id, label: `${c.name}${c.phone ? ` · ${c.phone}` : ''}` })),
        );
      }
      const c = hits[0]!;
      const newName = intent.customerName || intent.description;
      const updated = await updateCustomer(
        c.id,
        { name: newName && newName !== c.name ? newName : undefined },
        { silent: true },
      );
      if (!updated) return { ok: false, message: 'Không cập nhật được khách.' };
      return { ok: true, message: `Đã cập nhật khách **${updated.name}**.` };
    }

    case 'update_platform': {
      const hits = findPlatforms(intent);
      if (hits.length === 0) return { ok: false, message: 'Không tìm thấy kênh phù hợp.' };
      if (hits.length > 1) {
        return multiMatchMessage(
          'platform',
          hits.map((p) => ({ id: p.id, label: p.name })),
        );
      }
      const p = hits[0]!;
      const newName = intent.platformName || intent.description;
      const updated = await updatePlatform(
        p.id,
        { name: newName && newName !== p.name ? newName : undefined },
        { silent: true },
      );
      if (!updated) return { ok: false, message: 'Không cập nhật được kênh.' };
      return { ok: true, message: `Đã cập nhật kênh **${updated.name}**.` };
    }

    case 'delete_product': {
      const hits = findProducts(intent);
      if (hits.length === 0) return { ok: false, message: 'Không tìm thấy sản phẩm để xóa.' };
      if (hits.length > 1) {
        return multiMatchMessage(
          'product',
          hits.map((p) => ({
            id: p.id,
            label: `${p.name} · ${formatCurrency(p.defaultUnitPrice)}`,
          })),
        );
      }
      const p = hits[0]!;
      if (!opts?.deleteConfirmed) {
        return {
          ok: false,
          needDeleteConfirm: true,
          message: `Xóa sản phẩm **${p.name}**? Gõ **xác nhận** để xóa, hoặc **hủy**.`,
          createdRecord: { kind: 'product', id: p.id },
        };
      }
      await deleteProduct(p.id, { silent: true });
      return { ok: true, message: `Đã xóa sản phẩm **${p.name}**.` };
    }

    case 'delete_customer': {
      const hits = findCustomers(intent);
      if (hits.length === 0) return { ok: false, message: 'Không tìm thấy khách để xóa.' };
      if (hits.length > 1) {
        return multiMatchMessage(
          'customer',
          hits.map((c) => ({ id: c.id, label: c.name })),
        );
      }
      const c = hits[0]!;
      if (!opts?.deleteConfirmed) {
        return {
          ok: false,
          needDeleteConfirm: true,
          message: `Xóa khách **${c.name}**? Gõ **xác nhận** để xóa, hoặc **hủy**.`,
        };
      }
      await deleteCustomer(c.id, { silent: true });
      return { ok: true, message: `Đã xóa khách **${c.name}**.` };
    }

    case 'delete_platform': {
      const hits = findPlatforms(intent);
      if (hits.length === 0) return { ok: false, message: 'Không tìm thấy kênh để xóa.' };
      if (hits.length > 1) {
        return multiMatchMessage(
          'platform',
          hits.map((p) => ({ id: p.id, label: p.name })),
        );
      }
      const p = hits[0]!;
      if (!opts?.deleteConfirmed) {
        return {
          ok: false,
          needDeleteConfirm: true,
          message: `Xóa kênh **${p.name}**? Gõ **xác nhận** để xóa, hoặc **hủy**.`,
        };
      }
      await deletePlatform(p.id, { silent: true });
      return { ok: true, message: `Đã xóa kênh **${p.name}**.` };
    }

    case 'update_order_status': {
      const hits = findRevenues(intent);
      if (hits.length === 0) return { ok: false, message: 'Không tìm thấy đơn để đổi trạng thái.' };
      if (hits.length > 1) {
        return multiMatchMessage(
          'revenue',
          hits.map((r) => ({
            id: r.id,
            label: `${r.orderCode} · ${ORDER_STATUS_LABELS[r.orderStatus]}`,
          })),
        );
      }
      if (!intent.orderStatus) {
        return { ok: false, message: 'Chưa rõ trạng thái mới.' };
      }
      const r = hits[0]!;
      const status = intent.orderStatus as OrderStatus;
      await updateRevenue(r.id, {
        orderStatus: status,
        deliveryStatus: status === 'processing' ? 'pending' : r.deliveryStatus,
      });
      return {
        ok: true,
        message: `Đơn **${r.orderCode}** → **${ORDER_STATUS_LABELS[status]}**.`,
        createdRecord: { kind: 'revenue', id: r.id },
      };
    }

    case 'lookup': {
      return { ok: true, message: buildLookupAnswer(intent) };
    }

    case 'chat':
    default:
      return { ok: false, message: '' };
  }
}

function buildLookupAnswer(intent: ChatIntent): string {
  const q = (intent.query || intent.targetHint || intent.description || '').toLowerCase();
  const expenses = useExpenseStore.getState().records;
  const revenues = useRevenueStore.getState().records;
  const totalE = expenses.reduce((s, e) => s + e.amount, 0);
  const totalR = sumPaidRevenue(revenues);
  const unpaid = sumUnpaidReceivable(revenues);

  if (/tổng quan|tổng hợp|lợi nhuận|tổng thu|tổng chi|công nợ/.test(q) || !q) {
    const pending = revenues.filter(
      (r) => r.orderStatus !== 'completed' && r.orderStatus !== 'cancelled',
    ).length;
    return [
      '📊 **Tổng quan**',
      '',
      `💰 Tổng thu (đã TT): **${formatCurrency(totalR)}**`,
      `🧾 Công nợ: **${formatCurrency(unpaid)}**`,
      `💸 Tổng chi: **${formatCurrency(totalE)}** (${expenses.length} khoản)`,
      `📈 Lợi nhuận: **${formatCurrency(totalR - totalE)}**`,
      `⏳ Đơn đang xử lý: **${pending}**`,
    ].join('\n');
  }

  if (/đơn|doanh thu|bán|order/.test(q)) {
    const hits = findRevenues({ ...intent, targetHint: q });
    if (!hits.length) return '😕 Không thấy đơn khớp.';
    return [
      '🧾 **Đơn gần khớp:**',
      '',
      ...hits.slice(0, 8).map(
        (r) =>
          `• ${r.orderCode} · ${r.date} · ${formatCurrency(r.finalAmount)} · ${ORDER_STATUS_LABELS[r.orderStatus]}`,
      ),
    ].join('\n');
  }

  if (/sản\s*phẩm|sp\b|catalog|bảng\s*giá/.test(q)) {
    const products = useProductStore.getState().products;
    const hint = q.replace(/sản\s*phẩm|sp\b|catalog|bảng\s*giá|danh\s*sách|liệt\s*kê|tìm/gi, '').trim();
    const hits = hint
      ? searchProducts(hint, 12)
      : products.slice(0, 12);
    if (!hits.length) return '😕 Chưa có sản phẩm khớp.';
    return [
      '🏷️ **Sản phẩm:**',
      '',
      ...hits.map((p) => `• **${p.name}** — ${formatCurrency(p.defaultUnitPrice)}/${p.unit}`),
    ].join('\n');
  }

  if (/khách|customer/.test(q)) {
    const customers = useCustomerStore.getState().customers;
    const hint = q.replace(/khách(\s*hàng)?|customer|danh\s*sách|liệt\s*kê|tìm/gi, '').trim();
    const hits = hint
      ? customers.filter((c) => scoreText(c.name, hint) >= 40).slice(0, 12)
      : customers.slice(0, 12);
    if (!hits.length) return '😕 Chưa có khách khớp.';
    return [
      '👤 **Khách:**',
      '',
      ...hits.map((c) => `• **${c.name}**${c.phone ? ` · ${c.phone}` : ''}`),
    ].join('\n');
  }

  if (/kênh|platform|sàn/.test(q)) {
    const platforms = usePlatformStore.getState().platforms;
    return [
      '📣 **Kênh:**',
      '',
      ...platforms.slice(0, 12).map((p) => `• **${p.name}**${p.active ? '' : ' (tắt)'}`),
    ].join('\n');
  }

  if (/chi|chi phí|tiêu/.test(q)) {
    const hits = findExpenses({ ...intent, targetHint: q });
    const byCat = new Map<string, number>();
    expenses.forEach((e) => byCat.set(e.category, (byCat.get(e.category) || 0) + e.amount));
    const catLines = [...byCat.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(
        ([c, a]) =>
          `• ${EXPENSE_CATEGORY_LABELS[c as keyof typeof EXPENSE_CATEGORY_LABELS] || c}: ${formatCurrency(a)}`,
      );
    const recent = (hits.length ? hits : [...expenses].sort((a, b) => b.date.localeCompare(a.date)))
      .slice(0, 6)
      .map((e) => `• ${e.date} · ${e.description} · ${formatCurrency(e.amount)}`);
    return ['💸 **Chi phí**', '', '📁 Theo danh mục:', ...catLines, '', '🕒 Gần đây:', ...recent].join(
      '\n',
    );
  }

  // generic search ledger + master
  const eHits = findExpenses({ ...intent, targetHint: q }).slice(0, 4);
  const rHits = findRevenues({ ...intent, targetHint: q }).slice(0, 4);
  const pHits = searchProducts(q, 4);
  const cHits = useCustomerStore
    .getState()
    .customers.filter((c) => scoreText(c.name, q) >= 40)
    .slice(0, 4);
  if (!eHits.length && !rHits.length && !pHits.length && !cHits.length) {
    return `Không tìm thấy kết quả cho “${intent.query || intent.targetHint}”.`;
  }
  const lines: string[] = ['🔍 **Kết quả:**'];
  eHits.forEach((e) =>
    lines.push(`• [Chi] ${e.date} · ${e.description} · ${formatCurrency(e.amount)}`),
  );
  rHits.forEach((r) =>
    lines.push(`• [Thu] ${r.orderCode} · ${formatCurrency(r.finalAmount)} · ${ORDER_STATUS_LABELS[r.orderStatus]}`),
  );
  pHits.forEach((p) =>
    lines.push(`• [SP] ${p.name} · ${formatCurrency(p.defaultUnitPrice)}`),
  );
  cHits.forEach((c) => lines.push(`• [Khách] ${c.name}`));
  return lines.join('\n');
}

/** Legacy ChatAction bridge */
export async function executeLegacyCreate(action: {
  type: 'create_expense' | 'create_revenue';
  amount: number;
  description: string;
  category?: string;
  customerName?: string;
}): Promise<ToolResult> {
  return executeChatIntent({
    intent: action.type,
    amount: action.amount,
    description: action.description,
    category: action.category as ChatIntent['category'],
    customerName: action.customerName,
    confidence: 0.9,
    missing: [],
  });
}
