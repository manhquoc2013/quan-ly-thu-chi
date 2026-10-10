/** OverviewReport — cash P&L hero, quick nav strip, thu/chi chart, top unpaid */
import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { TrendingUp, Receipt, Wallet } from "lucide-react";
import { useExpenseStore } from "@/store/expenseStore";
import { useRevenueStore } from "@/store/revenueStore";
import { useCustomerStore } from "@/store/customerStore";
import { useReportStore } from "@/store/reportStore";
import { useUIStore } from "@/store/uiStore";
import { useTheme } from "@/hooks/useTheme";
import { formatCurrency } from "@/utils/currency";
import { formatAxisVnd, chartTooltipFormatter } from "@/utils/chartFormat";
import { isDateInRange } from "@/utils/date";
import { allCashEvents } from "@/utils/revenueMetrics";
import { buildReportSnapshot } from "@/services/reportSnapshot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type OverviewNavTab = "revenue" | "expense" | "unpaid" | "profit";

interface OverviewReportProps {
  onNavigateTab: (tab: OverviewNavTab) => void;
}

function customerLabel(
  customerId: string,
  customers: { id: string; name: string }[],
  notes?: string,
): string {
  if (customerId === "walk-in") return "Khách vãng lai";
  return (
    customers.find((c) => c.id === customerId)?.name ||
    notes?.replace(/^Khách:\s*/i, "") ||
    "—"
  );
}

export function OverviewReport({ onNavigateTab }: OverviewReportProps) {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const requestRecordDetail = useUIStore((s) => s.requestRecordDetail);
  const expenses = useExpenseStore((s) => s.records);
  const revenues = useRevenueStore((s) => s.records);
  const customers = useCustomerStore((s) => s.customers);
  const { from, to } = useReportStore((s) => s.dateRange);

  const snapshot = useMemo(
    () => buildReportSnapshot(revenues, expenses, from, to),
    [revenues, expenses, from, to],
  );

  const byMonth = useMemo(() => {
    const map = new Map<string, { thu: number; chi: number }>();
    for (const e of allCashEvents(revenues)) {
      if (from && e.date < from) continue;
      if (to && e.date > to) continue;
      const k = e.date.slice(0, 7);
      const v = map.get(k) || { thu: 0, chi: 0 };
      v.thu += e.amount;
      map.set(k, v);
    }
    for (const e of expenses) {
      if (!isDateInRange(e.date, from, to)) continue;
      const k = e.date.slice(0, 7);
      const v = map.get(k) || { thu: 0, chi: 0 };
      v.chi += e.amount;
      map.set(k, v);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([m, { thu, chi }]) => ({
        month: m.slice(5),
        thu,
        chi,
      }));
  }, [revenues, expenses, from, to]);

  const openRevenue = (id: string) => {
    navigate("/revenue");
    window.setTimeout(() => requestRecordDetail("revenue", id), 80);
  };

  const strip = [
    {
      key: "revenue" as const,
      label: "Thu",
      value: formatCurrency(snapshot.cashIn),
      icon: TrendingUp,
      className: "text-success-fg",
    },
    {
      key: "expense" as const,
      label: "Chi",
      value: formatCurrency(snapshot.expenseTotal),
      icon: Receipt,
      className: "text-danger-fg",
    },
    {
      key: "unpaid" as const,
      label: "Công nợ",
      value: formatCurrency(snapshot.unpaidTotal),
      icon: Wallet,
      className: "text-warning-fg",
    },
  ];

  return (
    <div className="space-y-[var(--s-lg)]">
      {/* Executive P&L Hero Card */}
      <Card
        className={`min-w-0 overflow-hidden border ${
          snapshot.profit >= 0
            ? "bg-gradient-to-br from-emerald-500/8 via-surface to-surface border-emerald-500/25 shadow-xs"
            : "bg-gradient-to-br from-rose-500/8 via-surface to-surface border-rose-500/25 shadow-xs"
        }`}
      >
        <CardContent className="pt-6 pb-6 px-4 sm:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div>
              <p className="text-xs font-medium text-text-muted mb-1">Lợi nhuận tiền mặt ròng</p>
              <p
                className={`text-2xl sm:text-4xl font-extrabold tabular-nums break-words leading-tight ${
                  snapshot.profit >= 0 ? "text-success-fg" : "text-danger-fg"
                }`}
              >
                {formatCurrency(snapshot.profit)}
              </p>
              <div className="flex items-center gap-2 justify-center sm:justify-start mt-2">
                <span className="text-xs text-text-muted">Biên lợi nhuận:</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-accent-bg text-accent-fg">
                  {snapshot.marginPct.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Visual ratio strip */}
            <div className="flex flex-col gap-2 w-full sm:w-64">
              <div className="flex justify-between text-xs text-text-muted">
                <span>Thu: <strong className="text-text-primary">{formatCurrency(snapshot.cashIn)}</strong></span>
                <span>Chi: <strong className="text-text-primary">{formatCurrency(snapshot.expenseTotal)}</strong></span>
              </div>
              <div className="w-full h-2 rounded-full bg-surface-active overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{
                    width: `${
                      snapshot.cashIn + snapshot.expenseTotal > 0
                        ? Math.round((snapshot.cashIn / (snapshot.cashIn + snapshot.expenseTotal)) * 100)
                        : 50
                    }%`,
                  }}
                  title="Tỷ lệ Thu"
                />
                <div
                  className="bg-rose-500 h-full transition-all duration-300"
                  style={{
                    width: `${
                      snapshot.cashIn + snapshot.expenseTotal > 0
                        ? Math.round((snapshot.expenseTotal / (snapshot.cashIn + snapshot.expenseTotal)) * 100)
                        : 50
                    }%`,
                  }}
                  title="Tỷ lệ Chi"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-2.5 min-w-0">
        {strip.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onNavigateTab(s.key)}
            className="rounded-xl border border-border-subtle bg-surface/85 hover:bg-surface p-3 text-center shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all min-w-0 cursor-pointer"
          >
            <div className="flex items-center justify-center size-7 rounded-lg bg-surface-hover mx-auto mb-1.5">
              <s.icon size={15} className={s.className} />
            </div>
            <p className="text-[11px] font-medium text-text-muted">{s.label}</p>
            <p className={`text-xs sm:text-sm font-bold tabular-nums break-words leading-snug mt-0.5 ${s.className}`}>
              {s.value}
            </p>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thu vs chi theo tháng</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            {byMonth.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-text-muted">
                Chưa có dữ liệu trong khoảng này
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byMonth} barCategoryGap="28%">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? "#334155" : "#CBD5E1"}
                    vertical={false}
                  />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    width={52}
                    tickFormatter={formatAxisVnd}
                  />
                  <Tooltip formatter={chartTooltipFormatter as never} />
                  <Legend />
                  <Bar
                    dataKey="thu"
                    name="Thu"
                    fill={isDark ? "#34D399" : "#059669"}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    dataKey="chi"
                    name="Chi"
                    fill={isDark ? "#F87171" : "#DC2626"}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>Công nợ lớn nhất</CardTitle>
          {snapshot.unpaidCount > 0 && (
            <button
              type="button"
              className="text-[11px] text-accent-fg hover:underline shrink-0"
              onClick={() => onNavigateTab("unpaid")}
            >
              Xem tất cả ({snapshot.unpaidCount})
            </button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {snapshot.unpaidTop.length === 0 ? (
            <p className="text-xs text-text-muted py-8 text-center">
              Không có công nợ trong kỳ
            </p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {snapshot.unpaidTop.map((row) => {
                const rev = revenues.find((r) => r.id === row.id);
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover transition-colors"
                      onClick={() => openRevenue(row.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-mono font-semibold text-accent-fg">
                          {row.orderCode}
                        </p>
                        <p className="text-xs text-text-primary truncate">
                          {customerLabel(
                            row.customerId,
                            customers,
                            rev?.notes,
                          )}
                        </p>
                        <p className="text-[11px] text-text-muted">{row.date}</p>
                      </div>
                      <p className="text-sm font-semibold tabular-nums text-warning-fg shrink-0">
                        {formatCurrency(row.remaining)}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
