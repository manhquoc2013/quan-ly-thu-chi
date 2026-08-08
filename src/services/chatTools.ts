/**
 * Chat tools — execute structured intents against app services/stores.
 */

import type { Expense, Revenue, OrderStatus } from '@/models';
import { EXPENSE_CATEGORY_LABELS, ORDER_STATUS_LABELS } from '@/models';
import { resolveNavigateTarget } from './appNavigation';
import { formatCurrency } from '@/utils/currency';
import {
  sumPaidRevenue,
  sumUnpaidReceivable,
  isUnpaidReceivable,
  getRemainingBalance,
} from '@/utils/revenueMetrics';
import { todayISO } from '@/utils/date';
import {
  getExpenseByCategory,
  getExpenseByMonth,
  getRevenueByMonth,
  getProfitSummary,
  getTopCustomersByRevenue,
  getTopProductsByRevenue,
  getRevenueByPlatform,
} from './reportService';
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
  guessProductUnit,
  cleanProductSearchHint,
  isAnimalProductName,
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
  /** App route to open (navigate intent) */
  navigateTo?: string;
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
  const raw = (intent.targetHint || intent.description || '').trim();
  const hint = cleanProductSearchHint(raw) || raw;
  const all = useProductStore.getState().products;
  if (!hint) return all.slice(0, 8);

  // Category: "thú" → all animal/plush products
  if (/^thú$/i.test(hint) || (intent.unit && /^thú$/i.test(hint))) {
    const animals = all.filter((p) => isAnimalProductName(p.name));
    if (animals.length) return animals;
  }

  const scored = all
    .map((p) => ({
      p,
      score: Math.max(
        scoreText(p.name, hint),
        scoreText(p.sku || '', hint),
        // token overlap: any significant token of hint in name
        hint
          .split(/\s+/)
          .filter((t) => t.length >= 2)
          .some((t) => p.name.toLowerCase().includes(t.toLowerCase()))
          ? 55
          : 0,
      ),
    }))
    .filter((x) => x.score >= 40)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.p);

  if (scored.length) return scored;
  return searchProducts(hint, 20);
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

function extractPhoneFromText(text?: string): string | undefined {
  if (!text) return undefined;
  const m = text.match(/(?:\+84|0)\d{8,10}/);
  return m?.[0];
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
        const stockNote =
          draft.quantity &&
          (draft.category === 'supplies' || /^nhập\b/i.test(draft.description))
            ? ` · +${draft.quantity} tồn`
            : '';
        return {
          ok: true,
          message: `Đã thêm chi phí: **${created[0].description}** — ${formatCurrency(draft.amount)}${stockNote}`,
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
      const unit = (intent.unit?.trim() || guessProductUnit(name)).trim();
      const record = await createProduct(
        { name, defaultUnitPrice: price, unit },
        { silent: true },
      );
      return {
        ok: true,
        message: `Đã thêm sản phẩm: **${record.name}** — ${formatCurrency(record.defaultUnitPrice)}/${record.unit}`,
        createdRecord: { kind: 'product', id: record.id },
      };
    }

    case 'create_customer': {
      const name = (intent.customerName || intent.description || '').trim();
      if (name.length < 2) return { ok: false, message: 'Thiếu tên khách hàng.' };
      const phone =
        intent.phone?.trim() ||
        extractPhoneFromText(intent.customerName) ||
        extractPhoneFromText(intent.description) ||
        extractPhoneFromText(intent.query) ||
        '';
      const cleanName = name.replace(/(?:\+84|0)\d{8,10}/g, '').replace(/\s+/g, ' ').trim() || name;
      const record = await createCustomer({ name: cleanName, phone }, { silent: true });
      return {
        ok: true,
        message: `✅ Đã thêm khách: **${record.name}**${phone ? ` · ${phone}` : ''}`,
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
        paymentMethod: intent.paymentMethod ?? e.paymentMethod,
      });
      return {
        ok: true,
        message: `✅ Đã cập nhật chi phí **${intent.description ?? e.description}**.`,
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
      const notes: string[] = [];

      if (intent.orderStatus) {
        patch.orderStatus = intent.orderStatus;
        notes.push(`trạng thái → ${ORDER_STATUS_LABELS[intent.orderStatus]}`);
      }
      if (intent.customerName) {
        patch.customerId = await ensureCustomer(intent.customerName);
        patch.notes = `Khách: ${intent.customerName}`;
        notes.push(`khách → ${intent.customerName}`);
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
        const ship =
          intent.shippingFee != null
            ? intent.shippingFee
            : (r.shippingFee ?? 0);
        const payer = intent.shippingPayer ?? r.shippingPayer ?? 'customer';
        const goods = intent.amount - (r.discount || 0);
        patch.finalAmount = payer === 'customer' ? goods + ship : goods;
        notes.push(`tiền hàng → ${formatCurrency(intent.amount)}`);
      } else if (intent.description && r.items[0]) {
        patch.items = r.items.map((it, idx) =>
          idx === 0 ? { ...it, name: intent.description! } : it,
        );
        notes.push(`SP → ${intent.description}`);
      }

      if (intent.depositAmount != null && intent.depositAmount >= 0) {
        patch.depositAmount = intent.depositAmount;
        if (intent.depositAmount > 0) patch.depositedAt = todayISO();
        notes.push(`cọc → ${formatCurrency(intent.depositAmount)}`);
      }
      if (intent.shippingFee != null && intent.shippingFee >= 0) {
        patch.shippingFee = intent.shippingFee;
        notes.push(`ship → ${formatCurrency(intent.shippingFee)}`);
      }
      if (intent.shippingPayer) {
        patch.shippingPayer = intent.shippingPayer;
        notes.push(`ship do ${intent.shippingPayer === 'shop' ? 'shop' : 'khách'}`);
      }
      if (intent.paymentMethod) {
        patch.paymentMethod = intent.paymentMethod;
        notes.push(`PTTT → ${intent.paymentMethod}`);
      }
      if (intent.paymentStatus === 'paid') {
        patch.paymentStatus = 'paid';
        patch.paidAt = todayISO();
        const nextShip = intent.shippingFee ?? r.shippingFee ?? 0;
        const nextPayer = intent.shippingPayer ?? r.shippingPayer ?? 'customer';
        const goodsBase =
          intent.amount && intent.amount > 0
            ? intent.amount - (r.discount || 0)
            : r.finalAmount -
              (r.shippingPayer === 'customer' ? r.shippingFee ?? 0 : 0);
        const provisional = {
          ...r,
          ...patch,
          shippingFee: nextShip,
          shippingPayer: nextPayer,
          finalAmount:
            patch.finalAmount ??
            (nextPayer === 'customer' ? goodsBase + nextShip : goodsBase),
          depositAmount: patch.depositAmount ?? r.depositAmount,
          paymentStatus: 'unpaid' as const,
        };
        patch.paidAmount = getRemainingBalance(provisional as typeof r);
        notes.push('đã thanh toán');
      } else if (intent.paymentStatus === 'unpaid') {
        patch.paymentStatus = 'unpaid';
        patch.paidAt = undefined;
        patch.paidAmount = undefined;
        notes.push('chưa thanh toán');
      }

      if (Object.keys(patch).length === 0) {
        return {
          ok: false,
          message:
            'Chưa có thay đổi. Có thể: đánh dấu đã TT, đổi tiền/cọc/ship, đổi trạng thái, đổi khách.',
        };
      }

      await updateRevenue(r.id, patch);
      return {
        ok: true,
        message: [
          `✅ Đã cập nhật đơn **${r.orderCode}**`,
          notes.length ? notes.map((n) => `• ${n}`).join('\n') : '',
        ]
          .filter(Boolean)
          .join('\n'),
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
      if (hits.length === 0) {
        return {
          ok: false,
          message:
            '😕 Không tìm thấy sản phẩm phù hợp.\n\nThử nêu rõ tên (vd: **Hello Kitty**) hoặc nhóm (**thú**).',
        };
      }

      const price = intent.unitPrice ?? intent.amount;
      const nextUnit = intent.unit?.trim();
      const wantsUnitOnly = Boolean(nextUnit) && !(price && price > 0);
      const categoryBulk =
        wantsUnitOnly &&
        (hits.length > 1 ||
          /^thú$/i.test(cleanProductSearchHint(intent.targetHint || intent.description || '')));

      // Bulk unit change for matching set (e.g. all "thú")
      if (categoryBulk && nextUnit && hits.length >= 1) {
        const updatedNames: string[] = [];
        for (const p of hits) {
          if (p.unit === nextUnit) continue;
          const updated = await updateProduct(p.id, { unit: nextUnit }, { silent: true });
          if (updated) updatedNames.push(updated.name);
        }
        if (!updatedNames.length) {
          return {
            ok: true,
            message: `ℹ️ ${hits.length} sản phẩm đã dùng đơn vị **${nextUnit}** rồi.`,
          };
        }
        return {
          ok: true,
          message: [
            `✅ Đã đổi đơn vị → **${nextUnit}** cho **${updatedNames.length}** sản phẩm:`,
            '',
            ...updatedNames.map((n, i) => `${i + 1}. 🏷️ ${n}`),
          ].join('\n'),
          createdRecord: { kind: 'product', id: hits[0]!.id },
        };
      }

      if (hits.length > 1) {
        return multiMatchMessage(
          'product',
          hits.map((p) => ({
            id: p.id,
            label: `${p.name} · ${formatCurrency(p.defaultUnitPrice)}/${p.unit}`,
          })),
        );
      }
      const p = hits[0]!;
      const patch: { name?: string; defaultUnitPrice?: number; unit?: string } = {};
      if (
        intent.description &&
        intent.description.trim().length >= 2 &&
        intent.description !== p.name &&
        !nextUnit // don't treat unit-change description as rename
      ) {
        const desc = intent.description.trim();
        if (!/^(?:thú|con|cái)$/i.test(desc)) patch.name = desc;
      }
      if (price && price > 0) patch.defaultUnitPrice = price;
      if (nextUnit) patch.unit = nextUnit;
      if (!patch.name && patch.defaultUnitPrice === undefined && !patch.unit) {
        return { ok: false, message: 'Chưa có thay đổi (tên/giá/đơn vị) để cập nhật.' };
      }
      const updated = await updateProduct(p.id, patch, { silent: true });
      if (!updated) return { ok: false, message: 'Không cập nhật được sản phẩm.' };
      return {
        ok: true,
        message: `✅ Đã cập nhật SP **${updated.name}** — ${formatCurrency(updated.defaultUnitPrice)}/**${updated.unit}**`,
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
      const phone = intent.phone?.trim() || extractPhoneFromText(intent.description);
      const newNameRaw = intent.customerName || intent.description;
      const newName = newNameRaw
        ? newNameRaw.replace(/(?:\+84|0)\d{8,10}/g, '').replace(/\s+/g, ' ').trim()
        : undefined;
      const patch: { name?: string; phone?: string } = {};
      if (newName && newName.length >= 2 && newName !== c.name) patch.name = newName;
      if (phone && phone !== c.phone) patch.phone = phone;
      if (!patch.name && !patch.phone) {
        return { ok: false, message: 'Chưa có thay đổi (tên/SĐT) để cập nhật.' };
      }
      const updated = await updateCustomer(c.id, patch, { silent: true });
      if (!updated) return { ok: false, message: 'Không cập nhật được khách.' };
      return {
        ok: true,
        message: `✅ Đã cập nhật khách **${updated.name}**${updated.phone ? ` · ${updated.phone}` : ''}.`,
      };
    }

    case 'update_platform': {
      const hits = findPlatforms(intent);
      if (hits.length === 0) return { ok: false, message: 'Không tìm thấy kênh phù hợp.' };
      if (hits.length > 1) {
        return multiMatchMessage(
          'platform',
          hits.map((p) => ({ id: p.id, label: `${p.name}${p.active ? '' : ' (tắt)'}` })),
        );
      }
      const p = hits[0]!;
      const newName = intent.platformName || intent.description;
      const patch: { name?: string; active?: boolean } = {};
      if (newName && newName !== p.name && !/^(bật|tắt|active|inactive)$/i.test(newName)) {
        patch.name = newName;
      }
      if (typeof intent.platformActive === 'boolean') patch.active = intent.platformActive;
      else if (/\btắt|ngưng|inactive|disable/i.test(intent.summaryVi || intent.query || '')) {
        patch.active = false;
      } else if (/\bbật|kích\s*hoạt|active|enable/i.test(intent.summaryVi || intent.query || '')) {
        patch.active = true;
      }
      if (!patch.name && patch.active === undefined) {
        return { ok: false, message: 'Chưa có thay đổi (tên / bật-tắt) để cập nhật.' };
      }
      const updated = await updatePlatform(p.id, patch, { silent: true });
      if (!updated) return { ok: false, message: 'Không cập nhật được kênh.' };
      return {
        ok: true,
        message: `✅ Đã cập nhật kênh **${updated.name}**${updated.active ? '' : ' (đã tắt)'}.`,
      };
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

    case 'navigate': {
      const target = resolveNavigateTarget(intent);
      if (!target) {
        return {
          ok: false,
          message:
            '😕 Chưa rõ màn hình. Thử: **mở chi phí** · **mở doanh thu** · **mở sản phẩm** · **mở cài đặt** · **mở báo cáo**.',
        };
      }
      return {
        ok: true,
        message: `➡️ Đang mở **${target.label}**…`,
        navigateTo: target.path,
      };
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

  if (/công\s*nợ|chưa\s*thanh\s*toán|unpaid|đơn\s*nợ/.test(q)) {
    const unpaidOrders = revenues.filter(isUnpaidReceivable).slice(0, 12);
    if (!unpaidOrders.length) {
      return `✅ Không có đơn công nợ.\n\n💰 Tổng công nợ: **${formatCurrency(0)}**`;
    }
    return [
      '🧾 **Đơn công nợ**',
      '',
      `💰 Tổng còn lại: **${formatCurrency(unpaid)}**`,
      '',
      ...unpaidOrders.map(
        (r) =>
          `• **${r.orderCode}** · ${r.date} · còn ${formatCurrency(getRemainingBalance(r))} · ${ORDER_STATUS_LABELS[r.orderStatus]}`,
      ),
    ].join('\n');
  }

  if (/top\s*khách|khách\s*mua\s*nhiều|khách\s*chi\s*nhiều/.test(q)) {
    const customers = useCustomerStore.getState().customers;
    const rows = getTopCustomersByRevenue(revenues, customers, 8);
    if (!rows.length) return '😕 Chưa có dữ liệu khách.';
    return [
      '👤 **Top khách theo doanh thu**',
      '',
      ...rows.map(
        (r, i) =>
          `${i + 1}. **${r.customerName}** — ${formatCurrency(r.totalRevenue)} · ${r.orderCount} đơn`,
      ),
    ].join('\n');
  }

  if (/top\s*(sp|sản\s*phẩm)|sp\s*bán\s*chạy|sản\s*phẩm\s*bán\s*chạy/.test(q)) {
    const products = useProductStore.getState().products;
    const rows = getTopProductsByRevenue(revenues, products, 8);
    if (!rows.length) return '😕 Chưa có dữ liệu sản phẩm.';
    return [
      '🏷️ **Top sản phẩm theo doanh thu**',
      '',
      ...rows.map(
        (r, i) =>
          `${i + 1}. **${r.productName}** — ${formatCurrency(r.totalRevenue)} · SL ${r.totalQuantity}`,
      ),
    ].join('\n');
  }

  if (/theo\s*kênh|doanh\s*thu\s*kênh|revenue\s*by\s*platform/.test(q)) {
    const platforms = usePlatformStore.getState().platforms;
    const rows = getRevenueByPlatform(revenues, platforms);
    if (!rows.length) return '😕 Chưa có doanh thu theo kênh.';
    return [
      '📣 **Doanh thu theo kênh**',
      '',
      ...rows.slice(0, 10).map((r) => `• **${r.platformName}** — ${formatCurrency(r.totalRevenue)}`),
    ].join('\n');
  }

  if (/theo\s*tháng|chi\s*theo\s*tháng|thu\s*theo\s*tháng/.test(q)) {
    const expM = getExpenseByMonth(expenses).slice(-6);
    const revM = getRevenueByMonth(revenues).slice(-6);
    const profit = getProfitSummary(expenses, revenues);
    return [
      '📅 **Theo tháng**',
      '',
      `📈 LN gần nhất: **${formatCurrency(profit.profit)}**`,
      '',
      '💸 Chi:',
      ...expM.map((m) => `• ${m.month}: ${formatCurrency(m.total)} (${m.count})`),
      '',
      '💰 Thu:',
      ...revM.map((m) => `• ${m.month}: ${formatCurrency(m.total)} (${m.count})`),
    ].join('\n');
  }

  if (/tổng quan|tổng hợp|lợi nhuận|tổng thu|tổng chi|dashboard|báo cáo|thống kê/.test(q) || !q) {
    const pending = revenues.filter(
      (r) => r.orderStatus !== 'completed' && r.orderStatus !== 'cancelled',
    ).length;
    const byCat = getExpenseByCategory(expenses).slice(0, 4);
    return [
      '📊 **Tổng quan**',
      '',
      `💰 Tổng thu (đã TT): **${formatCurrency(totalR)}**`,
      `🧾 Công nợ: **${formatCurrency(unpaid)}**`,
      `💸 Tổng chi: **${formatCurrency(totalE)}** (${expenses.length} khoản)`,
      `📈 Lợi nhuận: **${formatCurrency(totalR - totalE)}**`,
      `⏳ Đơn đang xử lý: **${pending}**`,
      byCat.length ? '' : '',
      byCat.length ? '📁 Chi nhiều nhất:' : '',
      ...byCat.map(
        (c) =>
          `• ${EXPENSE_CATEGORY_LABELS[c.category as keyof typeof EXPENSE_CATEGORY_LABELS] || c.category}: ${formatCurrency(c.total)}`,
      ),
    ]
      .filter((line) => line !== '')
      .join('\n');
  }

  if (/giá\s+|bao nhiêu/.test(q) && !/chi|thu|đơn\b/.test(q)) {
    const hint = q
      .replace(/giá|bao nhiêu|của|sp|sản\s*phẩm|là|hiện\s*tại/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const hits = hint ? searchProducts(hint, 8) : [];
    if (hits.length) {
      return [
        '🏷️ **Giá sản phẩm:**',
        '',
        ...hits.map((p) => `• **${p.name}** — ${formatCurrency(p.defaultUnitPrice)}/${p.unit}`),
      ].join('\n');
    }
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

  if (/tồn\s*kho|còn\s*bao\s*nhiêu|stock\b|inventory/.test(q)) {
    const products = useProductStore.getState().products;
    const hint = q
      .replace(/tồn\s*kho|còn\s*bao\s*nhiêu|stock|inventory|của|sp|sản\s*phẩm|là|hiện\s*tại/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const hits = hint ? searchProducts(hint, 20) : [...products].sort((a, b) => a.name.localeCompare(b.name, 'vi')).slice(0, 20);
    if (!hits.length) return '😕 Chưa có sản phẩm để xem tồn.';
    return [
      '📦 **Tồn kho:**',
      '',
      ...hits.map((p) => {
        const qty = typeof p.stockQty === 'number' ? p.stockQty : 0;
        const warn = qty < 0 ? ' ⚠️' : qty === 0 ? ' (hết)' : '';
        return `• **${p.name}** — **${qty}** ${p.unit}${warn}`;
      }),
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
      ...hits.map((p) => {
        const qty = typeof p.stockQty === 'number' ? p.stockQty : 0;
        return `• **${p.name}** — ${formatCurrency(p.defaultUnitPrice)}/${p.unit} · tồn ${qty}`;
      }),
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
