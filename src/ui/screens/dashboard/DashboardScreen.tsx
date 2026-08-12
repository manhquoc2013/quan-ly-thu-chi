/**
 * DashboardScreen — action-first: month KPIs, work queue, products, then chart/recent.
 */

import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Package,
  Wallet,
  Star,
  ClipboardList,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useExpenseStore } from '@/store/expenseStore';
import { useRevenueStore } from '@/store/revenueStore';
import { useCustomerStore } from '@/store/customerStore';
import { useUIStore } from '@/store/uiStore';
import { formatCurrency } from '@/utils/currency';
import { bootstrapAppData } from '@/services/bootstrap';
import { buildDashboardSnapshot } from '@/services/dashboardSnapshot';
import { useTheme } from '@/hooks/useTheme';
import { formatAxisVnd, chartTooltipFormatter } from '@/utils/chartFormat';
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type OrderStatus,
  type Revenue,
} from '@/models';

const PRODUCT_DISPLAY_LIMIT = 12;

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
  const navigate = useNavigate();
  const expenses = useExpenseStore((s) => s.records);
  const revenues = useRevenueStore((s) => s.records);
  const customers = useCustomerStore((s) => s.customers);
  const requestRecordDetail = useUIStore((s) => s.requestRecordDetail);

  useEffect(() => {
    void bootstrapAppData();
  }, []);

  const snapshot = useMemo(
    () => buildDashboardSnapshot(revenues, expenses),
    [revenues, expenses],
  );

  const openRecord = (kind: 'revenue' | 'expense', id: string) => {
    navigate(kind === 'revenue' ? '/revenue' : '/expense');
    window.setTimeout(() => requestRecordDetail(kind, id), 80);
  };

  const thirdKpi =
    snapshot.unpaidTotal > 0
      ? {
          title: 'Công nợ',
          value: money(snapshot.unpaidTotal),
          hint: `${snapshot.unpaidCount} đơn chưa thu`,
          icon: Wallet,
          tone: 'text-warning-fg' as const,
        }
      : {
          title: 'Lãi tháng',
          value: money(snapshot.monthProfit),
          hint: snapshot.monthProfit >= 0 ? 'Có lãi' : 'Lỗ',
          icon: TrendingUp,
          tone: (snapshot.monthProfit >= 0 ? 'text-success-fg' : 'text-danger-fg') as
            | 'text-success-fg'
            | 'text-danger-fg',
        };

  const kpiCards = [
    {
      title: 'Đã thu',
      value: money(snapshot.monthCashIn),
      hint: 'Tiền mặt tháng này',
      icon: ArrowUpRight,
      tone: 'text-success-fg' as const,
    },
    {
      title: 'Chi',
      value: money(snapshot.monthExpense),
      hint: 'Chi phí tháng này',
      icon: ArrowDownRight,
      tone: 'text-danger-fg' as const,
    },
    thirdKpi,
  ];

  const productsShown = snapshot.products.slice(0, PRODUCT_DISPLAY_LIMIT);
  const productsExtra = Math.max(0, snapshot.products.length - PRODUCT_DISPLAY_LIMIT);

  return (
    <div className="space-y-[var(--s-lg)] min-w-0 w-full max-w-full">
      {/* KPI strip — max 3 */}
      <div className="space-y-2 min-w-0">
        <div className="grid grid-cols-3 gap-[var(--s-md)] min-w-0">
          {kpiCards.map((c) => (
            <Card
              key={c.title}
              data-mascot-platform
              className="min-w-0 bg-surface/80 backdrop-blur-sm border-border-subtle hover:shadow-md hover:-translate-y-px transition-all"
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
        <p className="text-[11px] text-text-muted px-0.5">
          Tháng này ·{' '}
          <Link to="/report" className="text-accent-fg hover:underline underline-offset-2">
            xem Báo cáo
          </Link>
        </p>
      </div>

      {/* Work queue */}
      <Card data-mascot-platform className="overflow-hidden min-w-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border-subtle bg-surface/60 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-field bg-accent-bg text-accent-fg shrink-0">
              <Package size={16} />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm">Cần xử lý</CardTitle>
              <p className="text-[11px] text-text-muted font-normal">Ưu tiên trước · chạm để mở đơn</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary">{snapshot.pendingCount}</Badge>
            <Link
              to="/revenue"
              className="text-[11px] font-medium text-accent-fg hover:underline underline-offset-2"
            >
              Xem tất cả
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {snapshot.queue.length === 0 ? (
            <p className="text-xs text-text-muted py-10 text-center">Không có đơn chờ xử lý</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {snapshot.queue.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    data-mascot-platform
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:bg-accent-bg/40"
                    onClick={() => openRecord('revenue', o.id)}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {o.priority ? (
                          <Star size={12} className="text-warning-fg shrink-0" fill="currentColor" />
                        ) : null}
                        <span className="font-mono text-xs font-semibold text-accent-fg">{o.orderCode}</span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${statusTone(o.orderStatus)}`}>
                          {ORDER_STATUS_LABELS[o.orderStatus]}
                        </Badge>
                        {o.priority ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-5 bg-warning-bg text-warning-fg border-transparent"
                          >
                            Ưu tiên
                          </Badge>
                        ) : null}
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
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-text-primary">{money(o.finalAmount)}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Products to fulfill */}
      {snapshot.products.length > 0 ? (
        <Card data-mascot-platform className="overflow-hidden min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border-subtle bg-surface/60 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-field bg-accent-bg text-accent-fg shrink-0">
                <ClipboardList size={16} />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-sm">Sản phẩm cần làm</CardTitle>
                <p className="text-[11px] text-text-muted font-normal">
                  Tổng hợp từ {snapshot.pendingCount} đơn chưa hoàn thành
                </p>
              </div>
            </div>
            <Badge variant="secondary">{snapshot.products.length} SP</Badge>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              {productsShown.map((p) => (
                <Badge
                  key={p.name.toLowerCase()}
                  variant="secondary"
                  className={`text-xs max-w-[200px] truncate ${p.hasPriority ? 'border-warning-fg/40' : ''}`}
                  title={`${p.name} x${p.totalQty} — ${p.orderCount} đơn${p.hasPriority ? ' · có đơn ưu tiên' : ''}`}
                >
                  {p.hasPriority ? (
                    <Star size={10} className="text-warning-fg shrink-0" fill="currentColor" />
                  ) : null}
                  {p.name} x{p.totalQty}
                </Badge>
              ))}
              {productsExtra > 0 ? (
                <Badge variant="outline" className="text-xs text-text-muted">
                  +{productsExtra}
                </Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Secondary: chart + recent */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-[var(--s-lg)] min-w-0">
        <Card data-mascot-platform className="min-w-0 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2 px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-base min-w-0 truncate">Thu chi 7 ngày gần đây</CardTitle>
            <Badge variant="secondary" className="shrink-0">Tuần này</Badge>
          </CardHeader>
          <CardContent className="min-w-0 px-2 sm:px-6 overflow-hidden">
            <div className="h-[200px] w-full min-w-0 max-w-full" data-mascot-platform>
              {snapshot.chart7d.every((d) => d.thu === 0 && d.chi === 0) ? (
                <div className="flex items-center justify-center h-full text-xs text-text-muted">
                  Chưa có dữ liệu
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={snapshot.chart7d}
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
            <Badge variant="outline">{snapshot.recent.length} mục</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {snapshot.recent.length === 0 ? (
              <p className="text-xs text-text-muted py-10 text-center">Chưa có giao dịch</p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {snapshot.recent.map((tx) => {
                  const isIncome = tx.type === 'income';
                  return (
                    <li key={`${tx.type}-${tx.id}`}>
                      <button
                        type="button"
                        data-mascot-platform
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:bg-accent-bg/40"
                        onClick={() => openRecord(isIncome ? 'revenue' : 'expense', tx.id)}
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
    </div>
  );
}
