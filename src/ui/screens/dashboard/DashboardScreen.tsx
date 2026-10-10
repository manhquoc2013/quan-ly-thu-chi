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
  Plus,
  Receipt,
  Sparkles,
  BarChart3,
  CheckCircle2,
  Calendar,
  Layers,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useExpenseStore } from '@/store/expenseStore';
import { useRevenueStore } from '@/store/revenueStore';
import { useCustomerStore } from '@/store/customerStore';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { formatCurrency } from '@/utils/currency';
import { bootstrapAppData } from '@/services/bootstrap';
import { buildDashboardSnapshot } from '@/services/dashboardSnapshot';
import { isWalkInCustomerId } from '@/services/walkIn';
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
  if (isWalkInCustomerId(order.customerId)) return 'Khách vãng lai';
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
  const userProfile = useAuthStore((s) => s.userProfile);
  const expenses = useExpenseStore((s) => s.records);
  const revenues = useRevenueStore((s) => s.records);
  const customers = useCustomerStore((s) => s.customers);
  const requestRecordDetail = useUIStore((s) => s.requestRecordDetail);
  const toggleFab = useUIStore((s) => s.toggleFab);

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
          statClass: 'stat-card-debt',
        }
      : {
          title: 'Lãi tháng',
          value: money(snapshot.monthProfit),
          hint: snapshot.monthProfit >= 0 ? 'Có lãi' : 'Lỗ',
          icon: TrendingUp,
          tone: (snapshot.monthProfit >= 0 ? 'text-success-fg' : 'text-danger-fg') as
            | 'text-success-fg'
            | 'text-danger-fg',
          statClass: 'stat-card-profit',
        };

  const kpiCards = [
    {
      title: 'Đã thu',
      value: money(snapshot.monthCashIn),
      hint: 'Tiền mặt tháng này',
      icon: ArrowUpRight,
      tone: 'text-success-fg' as const,
      statClass: 'stat-card-income',
    },
    {
      title: 'Chi',
      value: money(snapshot.monthExpense),
      hint: 'Chi phí tháng này',
      icon: ArrowDownRight,
      tone: 'text-danger-fg' as const,
      statClass: 'stat-card-expense',
    },
    thirdKpi,
  ];

  const productsShown = snapshot.products.slice(0, PRODUCT_DISPLAY_LIMIT);
  const productsExtra = Math.max(0, snapshot.products.length - PRODUCT_DISPLAY_LIMIT);

  const todayStr = useMemo(() => {
    try {
      return new Date().toLocaleDateString('vi-VN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'Hôm nay';
    }
  }, []);

  return (
    <div className="space-y-6 min-w-0 w-full max-w-full font-sans">
      {/* Welcome & Overview Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-5 rounded-2xl bg-surface/80 backdrop-blur-md border border-border/80 shadow-xs">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-bold text-text-primary tracking-tight">
              Xin chào, {userProfile?.storeName || 'Cửa hàng'}
            </h2>
            <Badge variant="outline" className="text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 py-0.5 px-2">
              <CheckCircle2 size={12} className="mr-1 inline-block text-emerald-500" /> Hệ thống sẵn sàng
            </Badge>
          </div>
          <p className="text-xs text-text-muted flex items-center gap-1.5 capitalize">
            <Calendar size={13} className="text-text-muted shrink-0" />
            <span>{todayStr}</span>
            <span>·</span>
            <span className="font-medium text-text-secondary">
              {snapshot.pendingCount > 0
                ? `${snapshot.pendingCount} đơn hàng chờ xử lý`
                : 'Mọi đơn hàng đã được xử lý'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <Link
            to="/report"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface-hover hover:bg-surface-active text-text-primary border border-border/80 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
          >
            <BarChart3 size={14} className="text-accent-fg" />
            Báo cáo chi tiết
          </Link>
        </div>
      </div>

      {/* Quick Action Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 min-w-0">
        <Link
          to="/revenue"
          className="flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl bg-surface/80 hover:bg-surface border border-border/80 hover:border-emerald-500/50 shadow-2xs hover:shadow-md transition-all group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
        >
          <div className="size-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-2xs">
            <Plus size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold text-text-primary truncate">Thêm đơn bán</p>
            <p className="text-[10px] text-text-muted truncate">Tạo đơn bán nhanh</p>
          </div>
        </Link>

        <Link
          to="/expense"
          className="flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl bg-surface/80 hover:bg-surface border border-border/80 hover:border-rose-500/50 shadow-2xs hover:shadow-md transition-all group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-fg"
        >
          <div className="size-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-2xs">
            <Receipt size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold text-text-primary truncate">Ghi chi tiêu</p>
            <p className="text-[10px] text-text-muted truncate">Khoản chi mới</p>
          </div>
        </Link>

        <Link
          to="/report"
          className="flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl bg-surface/80 hover:bg-surface border border-border/80 hover:border-blue-500/50 shadow-2xs hover:shadow-md transition-all group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
        >
          <div className="size-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-2xs">
            <BarChart3 size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold text-text-primary truncate">Xem báo cáo</p>
            <p className="text-[10px] text-text-muted truncate">Dòng tiền & lãi lỗ</p>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => toggleFab()}
          className="flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl bg-surface/80 hover:bg-surface border border-border/80 hover:border-teal-500/50 shadow-2xs hover:shadow-md transition-all group text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
        >
          <div className="size-9 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-2xs">
            <Sparkles size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold text-text-primary truncate">Trợ lý AI</p>
            <p className="text-[10px] text-text-muted truncate">Nhập liệu tự động</p>
          </div>
        </button>
      </div>

      {/* KPI Financial Overview Cards */}
      <div className="space-y-2.5 min-w-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 min-w-0">
          {kpiCards.map((c) => (
            <Card
              key={c.title}
              data-mascot-platform
              className={`min-w-0 ${c.statClass} backdrop-blur-md hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border rounded-2xl`}
            >
              <CardContent className="flex flex-col gap-2 p-4 sm:p-5">
                <div className="flex items-center justify-between min-w-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex items-center justify-center size-9 shrink-0 rounded-xl bg-surface/90 border border-border/70 shadow-2xs">
                      <c.icon className={`size-4 sm:size-5 ${c.tone}`} />
                    </div>
                    <p className="text-xs font-semibold text-text-secondary leading-tight truncate uppercase tracking-wider">{c.title}</p>
                  </div>
                  <span className="text-[11px] font-medium text-text-muted px-2 py-0.5 rounded-full bg-surface/80 border border-border/60">
                    Tháng này
                  </span>
                </div>
                <p
                  className={`text-xl sm:text-2xl font-bold tabular-nums leading-snug break-words tracking-tight mt-1 ${c.tone}`}
                  title={c.value}
                >
                  {c.value}
                </p>
                {c.hint ? (
                  <p className="text-[11px] text-text-muted leading-snug truncate mt-0.5">{c.hint}</p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Work queue */}
      <Card data-mascot-platform className="overflow-hidden min-w-0 rounded-2xl border border-border/80 shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/70 bg-surface/70 backdrop-blur-sm py-3.5 px-4 sm:px-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-9 items-center justify-center rounded-xl bg-accent-bg text-accent-fg shrink-0 shadow-2xs">
              <Package size={18} />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm sm:text-base font-bold">Cần xử lý</CardTitle>
              <p className="text-[11px] text-text-muted font-normal">Đơn hàng chờ giao hoặc đang xử lý · Chạm để xem</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <Badge variant="secondary" className="font-semibold">{snapshot.pendingCount} đơn</Badge>
            <Link
              to="/revenue"
              className="text-xs font-semibold text-accent-fg hover:underline underline-offset-2 cursor-pointer"
            >
              Xem tất cả →
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {snapshot.queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <CheckCircle2 size={32} className="text-emerald-500/40 mb-2" />
              <p className="text-xs font-semibold text-text-secondary">Chưa có đơn hàng chờ xử lý nào</p>
              <p className="text-[11px] text-text-muted mt-0.5">Tất cả đơn bán hàng hiện tại đều đã hoàn thành</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {snapshot.queue.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    data-mascot-platform
                    className="flex w-full items-center gap-3.5 px-4 sm:px-5 py-3.5 text-left hover:bg-surface-hover/80 transition-colors cursor-pointer focus-visible:outline-none focus-visible:bg-accent-bg/40"
                    onClick={() => openRecord('revenue', o.id)}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {o.priority ? (
                          <Star size={13} className="text-warning-fg shrink-0" fill="currentColor" />
                        ) : null}
                        <span className="font-mono text-xs font-bold text-accent-fg">{o.orderCode}</span>
                        <Badge variant="outline" className={`text-[10px] px-2 py-0.5 font-medium ${statusTone(o.orderStatus)}`}>
                          {ORDER_STATUS_LABELS[o.orderStatus]}
                        </Badge>
                        {o.priority ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-2 py-0.5 font-medium bg-warning-bg text-warning-fg border-transparent"
                          >
                            Ưu tiên
                          </Badge>
                        ) : null}
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-2 py-0.5 font-medium border-transparent ${
                            o.paymentStatus === 'paid'
                              ? 'bg-success-bg text-success-fg'
                              : 'bg-warning-bg text-warning-fg'
                          }`}
                        >
                          {PAYMENT_STATUS_LABELS[o.paymentStatus ?? 'unpaid']}
                        </Badge>
                      </div>
                      <p className="text-xs font-semibold text-text-primary truncate">{customerLabel(o, customers)}</p>
                      <p className="text-[11px] text-text-muted truncate">{orderSummary(o)} · {o.date}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold tabular-nums text-text-primary">{money(o.finalAmount)}</p>
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
        <Card data-mascot-platform className="overflow-hidden min-w-0 rounded-2xl border border-border/80 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/70 bg-surface/70 backdrop-blur-sm py-3.5 px-4 sm:px-5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex size-9 items-center justify-center rounded-xl bg-accent-bg text-accent-fg shrink-0 shadow-2xs">
                <ClipboardList size={18} />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-sm sm:text-base font-bold">Sản phẩm cần làm</CardTitle>
                <p className="text-[11px] text-text-muted font-normal">
                  Tổng hợp sản phẩm từ {snapshot.pendingCount} đơn chưa hoàn tất
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="font-semibold">{snapshot.products.length} SP</Badge>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              {productsShown.map((p) => (
                <Badge
                  key={p.name.toLowerCase()}
                  variant="secondary"
                  className={`text-xs max-w-[220px] truncate py-1 px-2.5 rounded-lg border ${p.hasPriority ? 'border-warning-fg/50 bg-warning-bg/40 text-text-primary' : 'border-border/60'}`}
                  title={`${p.name} x${p.totalQty} — ${p.orderCount} đơn${p.hasPriority ? ' · có đơn ưu tiên' : ''}`}
                >
                  {p.hasPriority ? (
                    <Star size={11} className="text-warning-fg shrink-0 mr-1" fill="currentColor" />
                  ) : null}
                  <span className="font-medium truncate">{p.name}</span>
                  <span className="ml-1.5 font-bold tabular-nums text-accent-fg">x{p.totalQty}</span>
                </Badge>
              ))}
              {productsExtra > 0 ? (
                <Badge variant="outline" className="text-xs text-text-muted py-1 px-2.5 rounded-lg">
                  +{productsExtra} SP khác
                </Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Secondary: 7-day Chart + Recent Transactions */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 min-w-0">
        <Card data-mascot-platform className="min-w-0 overflow-hidden rounded-2xl border border-border/80 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2 px-4 sm:px-6 pt-4 sm:pt-5">
            <div className="min-w-0">
              <CardTitle className="text-sm sm:text-base font-bold truncate">Thu chi 7 ngày gần đây</CardTitle>
              <p className="text-[11px] text-text-muted">So sánh dòng tiền thực nhận và chi</p>
            </div>
            <Badge variant="secondary" className="shrink-0 font-medium">7 ngày qua</Badge>
          </CardHeader>
          <CardContent className="min-w-0 px-2 sm:px-6 pb-4 sm:pb-6 overflow-hidden">
            <div className="h-[220px] w-full min-w-0 max-w-full" data-mascot-platform>
              {snapshot.chart7d.every((d) => d.thu === 0 && d.chi === 0) ? (
                <div className="flex items-center justify-center h-full text-xs text-text-muted">
                  Chưa có dữ liệu nào
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={snapshot.chart7d}
                    barCategoryGap="20%"
                    margin={{ top: 8, right: 8, left: -6, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#E2E8F0'} vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: isDark ? '#94A3B8' : '#64748B' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                      tickFormatter={formatAxisVnd}
                    />
                    <Tooltip
                      formatter={chartTooltipFormatter as never}
                      labelFormatter={(label) => `Ngày ${label}`}
                      contentStyle={{
                        background: isDark ? '#1E293B' : '#FFFFFF',
                        border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
                        borderRadius: 12,
                        color: isDark ? '#F1F5F9' : '#0F172A',
                        fontSize: 12,
                        boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.08)',
                      }}
                    />
                    <Bar dataKey="thu" name="Thu" fill={isDark ? '#34D399' : '#10B981'} radius={[5, 5, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="chi" name="Chi" fill={isDark ? '#F87171' : '#EF4444'} radius={[5, 5, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-mascot-platform className="overflow-hidden rounded-2xl border border-border/80 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/70 bg-surface/70 backdrop-blur-sm py-3.5 px-4 sm:px-5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex size-9 items-center justify-center rounded-xl bg-surface-hover text-text-secondary shrink-0 shadow-2xs">
                <TrendingUp size={18} />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-sm sm:text-base font-bold">Giao dịch gần đây</CardTitle>
                <p className="text-[11px] text-text-muted font-normal">Thu / chi mới nhất vừa phát sinh</p>
              </div>
            </div>
            <Badge variant="outline" className="font-semibold">{snapshot.recent.length} mục</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {snapshot.recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Layers size={32} className="text-text-muted/40 mb-2" />
                <p className="text-xs font-semibold text-text-secondary">Chưa có giao dịch nào</p>
                <p className="text-[11px] text-text-muted mt-0.5">Bắt đầu tạo đơn bán hoặc ghi chi tiêu đầu tiên</p>
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {snapshot.recent.map((tx) => {
                  const isIncome = tx.type === 'income';
                  return (
                    <li key={`${tx.type}-${tx.id}`}>
                      <button
                        type="button"
                        data-mascot-platform
                        className="flex w-full items-center gap-3.5 px-4 sm:px-5 py-3 text-left hover:bg-surface-hover/80 transition-colors cursor-pointer focus-visible:outline-none focus-visible:bg-accent-bg/40"
                        onClick={() => openRecord(isIncome ? 'revenue' : 'expense', tx.id)}
                      >
                        <div
                          className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                            isIncome
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isIncome ? <ArrowUpRight size={17} /> : <ArrowDownRight size={17} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-text-primary truncate">{tx.desc}</p>
                            <Badge
                              variant="outline"
                              className={`shrink-0 text-[10px] px-2 py-0 h-4.5 border-transparent font-medium ${
                                isIncome
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
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
                          className={`shrink-0 text-sm font-bold tabular-nums ${
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

