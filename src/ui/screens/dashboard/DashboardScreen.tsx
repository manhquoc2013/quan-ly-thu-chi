/**
 * DashboardScreen — Real data from expense & revenue stores.
 */

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Clock,
  Package,
  Wallet,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useExpenseStore } from '@/store/expenseStore';
import { useRevenueStore } from '@/store/revenueStore';
import { useCustomerStore } from '@/store/customerStore';
import { formatCurrency } from '@/utils/currency';
import { bootstrapAppData } from '@/services/bootstrap';
import { useTheme } from '@/hooks/useTheme';
import { formatAxisVnd, chartTooltipFormatter } from '@/utils/chartFormat';
import {
  sumPaidRevenue,
  sumUnpaidReceivable,
  cashRevenueOnDate,
  isUnpaidReceivable,
} from '@/utils/revenueMetrics';
import {
  ORDER_STATUS_LABELS,
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_STATUS_LABELS,
  type Expense,
  type ExpenseCategory,
  type OrderStatus,
  type Revenue,
} from '@/models';
import { TransactionDetailModal } from './TransactionDetailModal';

function money(amount: number): string {
  return formatCurrency(amount);
}

function statusTone(status: OrderStatus): string {
  switch (status) {
    case 'processing':
    case 'confirmed':
      return 'bg-accent-bg text-accent-fg border-transparent';
    case 'new':
      return 'bg-surface-hover text-text-secondary border-transparent';
    default:
      return '';
  }
}

function customerLabel(order: Revenue, customers: { id: string; name: string }[]): string {
  if (order.customerId === 'walk-in') return 'Khách vãng lai';
  const name = customers.find((c) => c.id === order.customerId)?.name;
  if (name) return name;
  const fromNotes = order.notes?.replace(/^Khách:\s*/i, '').trim();
  return fromNotes || 'Khách chưa rõ';
}

function orderSummary(order: Revenue): string {
  const first = order.items[0]?.name?.trim();
  if (!first) return ORDER_STATUS_LABELS[order.orderStatus];
  const extra = order.items.length > 1 ? ` +${order.items.length - 1}` : '';
  return `${first}${extra}`;
}

export function DashboardScreen() {
  const { isDark } = useTheme();
  const expenses = useExpenseStore((s) => s.records);
  const revenues = useRevenueStore((s) => s.records);
  const customers = useCustomerStore((s) => s.customers);

  useEffect(() => {
    void bootstrapAppData();
  }, []);

  const [selectedId, setSelectedId] = useState<
    { type: 'expense'; id: string; readOnly: boolean } | { type: 'revenue'; id: string; readOnly: boolean } | null
  >(null);

  const selectedTransaction = useMemo(() => {
    if (!selectedId) return null;
    if (selectedId.type === 'expense') {
      const data = expenses.find((e) => e.id === selectedId.id);
      return data ? ({ type: 'expense' as const, data, readOnly: selectedId.readOnly }) : null;
    }
    const data = revenues.find((r) => r.id === selectedId.id);
    return data ? ({ type: 'revenue' as const, data, readOnly: selectedId.readOnly }) : null;
  }, [selectedId, expenses, revenues]);

  const totalExpense = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const totalRevenue = useMemo(() => sumPaidRevenue(revenues), [revenues]);
  const unpaidTotal = useMemo(() => sumUnpaidReceivable(revenues), [revenues]);
  const unpaidCount = useMemo(() => revenues.filter(isUnpaidReceivable).length, [revenues]);
  const profit = totalRevenue - totalExpense;
  const pendingCount = useMemo(
    () => revenues.filter((r) => r.orderStatus !== 'completed' && r.orderStatus !== 'cancelled').length,
    [revenues],
  );

  const chartData = useMemo(() => {
    const days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    const today = new Date();
    return days.map((d, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (6 - i));
      const dateStr = date.toISOString().slice(0, 10);
      return {
        day: d,
        thu: cashRevenueOnDate(revenues, dateStr),
        chi: expenses.filter((e) => e.date === dateStr).reduce((s, e) => s + e.amount, 0),
      };
    });
  }, [expenses, revenues]);

  const pendingOrders = useMemo(
    () =>
      revenues
        .filter((r) => r.orderStatus !== 'completed' && r.orderStatus !== 'cancelled')
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 6),
    [revenues],
  );

  const recentTransactions = useMemo(() => {
    const items = [
      ...expenses.map((e) => ({
        id: e.id,
        desc: e.description,
        amount: e.amount,
        type: 'expense' as const,
        date: e.date,
        cat: EXPENSE_CATEGORY_LABELS[e.category as ExpenseCategory] ?? e.category,
        sortAt: e.updatedAt || e.createdAt || e.date,
      })),
      ...revenues.map((r) => ({
        id: r.id,
        desc: r.orderCode,
        amount: r.finalAmount,
        type: 'income' as const,
        date: r.date,
        cat: orderSummary(r),
        sortAt: r.updatedAt || r.createdAt || r.date,
      })),
    ];
    return items.sort((a, b) => b.sortAt.localeCompare(a.sortAt)).slice(0, 6);
  }, [expenses, revenues]);

  const kpiCards = [
    {
      title: 'Doanh thu',
      value: money(totalRevenue),
      hint: 'Đã thanh toán' as string | undefined,
      icon: ArrowUpRight,
      tone: 'text-success-fg',
      // mobile 2-col / md 6-col / xl 5-col
      span: 'col-span-1 md:col-span-2 xl:col-span-1',
    },
    {
      title: 'Chi phí',
      value: money(totalExpense),
      hint: 'Tất cả khoản chi' as string | undefined,
      icon: ArrowDownRight,
      tone: 'text-danger-fg',
      span: 'col-span-1 md:col-span-2 xl:col-span-1',
    },
    {
      title: 'Lợi nhuận',
      value: money(profit),
      hint: (profit >= 0 ? 'Có lãi' : 'Lỗ') as string | undefined,
      icon: TrendingUp,
      tone: profit >= 0 ? 'text-success-fg' : 'text-danger-fg',
      span: 'col-span-1 md:col-span-2 xl:col-span-1',
    },
    {
      title: 'Công nợ',
      value: money(unpaidTotal),
      hint: unpaidCount > 0 ? `${unpaidCount} đơn chưa thu` : 'Không còn nợ',
      icon: Wallet,
      tone: unpaidTotal > 0 ? 'text-warning-fg' : 'text-text-primary',
      span: 'col-span-1 md:col-span-3 xl:col-span-1',
    },
    {
      title: 'Đơn chờ',
      value: String(pendingCount),
      hint: pendingCount > 0 ? 'Cần xử lý' : 'Đã xong',
      icon: Clock,
      tone: 'text-text-primary',
      // Odd last card: full width on mobile, half on md, 1/5 on xl
      span: 'col-span-2 md:col-span-3 xl:col-span-1',
    },
  ];

  return (
    <div className="space-y-[var(--s-lg)] min-w-0 w-full max-w-full overflow-x-hidden">
      {/*
        Responsive KPI:
        - mobile: 2 cols, last card full-width
        - md: 6-col grid → 3+2 balanced rows
        - xl: 5 equal cols
      */}
      <div className="grid grid-cols-2 md:grid-cols-6 xl:grid-cols-5 gap-[var(--s-md)] min-w-0">
        {kpiCards.map((c) => (
          <Card
            key={c.title}
            data-mascot-platform
            className={`min-w-0 bg-surface/80 backdrop-blur-sm border-border-subtle hover:shadow-md hover:-translate-y-px transition-all ${c.span}`}
          >
            <CardContent className="flex flex-col gap-2 p-3 sm:p-4">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-field bg-surface-hover">
                  <c.icon className={`w-4 h-4 sm:w-[18px] sm:h-[18px] ${c.tone}`} />
                </div>
                <p className="text-[11px] sm:text-xs text-text-muted leading-tight">{c.title}</p>
              </div>
              <p
                className={`text-base sm:text-lg font-bold tabular-nums leading-snug break-words ${c.tone}`}
                title={c.value}
              >
                {c.value}
              </p>
              {c.hint ? (
                <p className="text-[10px] sm:text-[11px] text-text-muted leading-snug">{c.hint}</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card data-mascot-platform className="min-w-0 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2 px-4 sm:px-6">
          <CardTitle className="text-sm sm:text-base min-w-0 truncate">Thu chi 7 ngày gần đây</CardTitle>
          <Badge variant="secondary" className="shrink-0">Tuần này</Badge>
        </CardHeader>
        <CardContent className="min-w-0 px-2 sm:px-6 overflow-hidden">
          <div className="h-[200px] w-full min-w-0 max-w-full" data-mascot-platform>
            {chartData.every((d) => d.thu === 0 && d.chi === 0) ? (
              <div className="flex items-center justify-center h-full text-xs text-text-muted">
                Chưa có dữ liệu
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  barCategoryGap="18%"
                  margin={{ top: 4, right: 4, left: -8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#CBD5E1'} vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: isDark ? '#94A3B8' : '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                    tickFormatter={formatAxisVnd}
                  />
                  <Tooltip
                    formatter={chartTooltipFormatter as never}
                    labelFormatter={(label) => `Ngày ${label}`}
                    contentStyle={{
                      background: isDark ? '#1E293B' : '#FFFFFF',
                      border: `1px solid ${isDark ? '#334155' : '#CBD5E1'}`,
                      borderRadius: 8,
                      color: isDark ? '#F1F5F9' : '#0F172A',
                      fontSize: 12,
                      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.08)',
                    }}
                  />
                  <Bar dataKey="thu" name="Thu" fill={isDark ? '#34D399' : '#059669'} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="chi" name="Chi" fill={isDark ? '#F87171' : '#DC2626'} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-[var(--s-lg)] min-w-0">
        {/* ── Đơn đang chờ ─────────────────────────────────────────────── */}
        <Card data-mascot-platform className="overflow-hidden min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border-subtle bg-surface/60 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-field bg-accent-bg text-accent-fg shrink-0">
                <Package size={16} />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-sm">Đơn đang chờ</CardTitle>
                <p className="text-[11px] text-text-muted font-normal">Chạm để cập nhật trạng thái</p>
              </div>
            </div>
            <Badge variant="secondary">{pendingCount} đơn</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {pendingOrders.length === 0 ? (
              <p className="text-xs text-text-muted py-10 text-center">Không có đơn chờ xử lý</p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {pendingOrders.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      data-mascot-platform
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:bg-accent-bg/40"
                      onClick={() => setSelectedId({ type: 'revenue', id: o.id, readOnly: false })}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-semibold text-accent-fg">{o.orderCode}</span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${statusTone(o.orderStatus)}`}>
                            {ORDER_STATUS_LABELS[o.orderStatus]}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 h-5 border-transparent ${
                              o.paymentStatus === 'paid'
                                ? 'bg-success-bg text-success-fg'
                                : 'bg-warning-bg text-warning-fg'
                            }`}
                          >
                            {PAYMENT_STATUS_LABELS[o.paymentStatus ?? 'unpaid']}
                          </Badge>
                        </div>
                        <p className="text-xs text-text-primary truncate">{customerLabel(o, customers)}</p>
                        <p className="text-[11px] text-text-muted truncate">{orderSummary(o)} · {o.date}</p>
                      </div>
                      <div className="shrink-0 text-right space-y-1">
                        <p className="text-sm font-semibold tabular-nums text-text-primary">{money(o.finalAmount)}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ── Giao dịch gần đây ────────────────────────────────────────── */}
        <Card data-mascot-platform className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border-subtle bg-surface/60 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-field bg-surface-hover text-text-secondary shrink-0">
                <TrendingUp size={16} />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-sm">Giao dịch gần đây</CardTitle>
                <p className="text-[11px] text-text-muted font-normal">Thu / chi mới nhất</p>
              </div>
            </div>
            <Badge variant="outline">{recentTransactions.length} mục</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {recentTransactions.length === 0 ? (
              <p className="text-xs text-text-muted py-10 text-center">Chưa có giao dịch</p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {recentTransactions.map((tx) => {
                  const isIncome = tx.type === 'income';
                  return (
                    <li key={`${tx.type}-${tx.id}`}>
                      <button
                        type="button"
                        data-mascot-platform
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:bg-accent-bg/40"
                        onClick={() => {
                          if (tx.type === 'expense') {
                            const fullExpense = expenses.find((e) => e.id === tx.id);
                            if (fullExpense) {
                              setSelectedId({ type: 'expense', id: fullExpense.id, readOnly: true });
                            }
                          } else {
                            const fullRevenue = revenues.find((r) => r.id === tx.id);
                            if (fullRevenue) {
                              setSelectedId({ type: 'revenue', id: fullRevenue.id, readOnly: true });
                            }
                          }
                        }}
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                            isIncome ? 'bg-success-bg text-success-fg' : 'bg-danger-bg text-danger-fg'
                          }`}
                        >
                          {isIncome ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium text-text-primary truncate">{tx.desc}</p>
                            <Badge
                              variant="outline"
                              className={`shrink-0 text-[10px] px-1.5 py-0 h-5 border-transparent ${
                                isIncome ? 'bg-success-bg text-success-fg' : 'bg-danger-bg text-danger-fg'
                              }`}
                            >
                              {isIncome ? 'Thu' : 'Chi'}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-[11px] text-text-muted truncate">
                            {tx.cat} · {tx.date}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 text-sm font-semibold tabular-nums ${
                            isIncome ? 'text-success-fg' : 'text-danger-fg'
                          }`}
                        >
                          {isIncome ? '+' : '−'}
                          {money(tx.amount)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedTransaction?.type === 'expense' && (
        <TransactionDetailModal
          open={!!selectedTransaction}
          onClose={() => setSelectedId(null)}
          type="expense"
          record={selectedTransaction.data}
          readOnly={selectedTransaction.readOnly}
        />
      )}
      {selectedTransaction?.type === 'revenue' && (
        <TransactionDetailModal
          open={!!selectedTransaction}
          onClose={() => setSelectedId(null)}
          type="revenue"
          record={selectedTransaction.data}
          readOnly={selectedTransaction.readOnly}
        />
      )}
    </div>
  );
}
