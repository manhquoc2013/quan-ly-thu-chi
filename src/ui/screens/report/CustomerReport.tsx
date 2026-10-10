/** CustomerReport — top customers by revenue (toggle: orders) */
import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useRevenueStore } from "@/store/revenueStore";
import { useCustomerStore } from "@/store/customerStore";
import { useReportStore } from "@/store/reportStore";
import { useTheme } from "@/hooks/useTheme";
import { formatCurrency } from "@/utils/currency";
import { formatAxisVnd } from "@/utils/chartFormat";
import { isDateInRange } from "@/utils/date";
import { LIST_ROW_ANIM, listRowStyle } from "@/ui/components/listRowAnim";
import {
  getTopCustomersByOrderCount,
  getTopCustomersByRevenue,
} from "@/services/reportService";
import { getAllRevenues } from "@/services/revenueService";
import { getAllCustomers } from "@/services/customerService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SortMode = "revenue" | "orders";

const TOP_N = 5;

export function CustomerReport() {
  const { isDark } = useTheme();
  const revenues = useRevenueStore((s) => s.records);
  const customers = useCustomerStore((s) => s.customers);
  const { from, to } = useReportStore((s) => s.dateRange);
  const [sortMode, setSortMode] = useState<SortMode>("revenue");

  useEffect(() => {
    if (revenues.length === 0) void getAllRevenues();
    if (customers.length === 0) void getAllCustomers();
  }, [revenues.length, customers.length]);

  const filtered = useMemo(
    () =>
      revenues.filter(
        (r) => isDateInRange(r.date, from, to) && r.orderStatus !== "cancelled",
      ),
    [revenues, from, to],
  );

  const topRows = useMemo(() => {
    if (sortMode === "orders") {
      return getTopCustomersByOrderCount(filtered, customers, TOP_N);
    }
    return getTopCustomersByRevenue(filtered, customers, TOP_N);
  }, [filtered, customers, sortMode]);

  const uniqueCustomers = useMemo(
    () => new Set(filtered.map((r) => r.customerId).filter(Boolean)).size,
    [filtered],
  );

  const totalRevenue = useMemo(
    () => filtered.reduce((sum, r) => sum + (Number(r.finalAmount) || 0), 0),
    [filtered],
  );

  const avgRevenue = useMemo(
    () =>
      uniqueCustomers > 0 ? Math.round(totalRevenue / uniqueCustomers) : 0,
    [uniqueCustomers, totalRevenue],
  );

  const chartData = useMemo(
    () =>
      topRows.map((c) => ({
        name: (c.customerName || "Khách").slice(0, 16),
        orders: Number(c.orderCount) || 0,
        revenue: Number(c.totalRevenue) || 0,
      })),
    [topRows],
  );

  return (
    <div className="space-y-[var(--s-lg)] min-w-0 w-full max-w-full font-sans">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-[var(--s-md)] min-w-0">
        {[
          { l: "Tổng số khách", v: String(uniqueCustomers) },
          { l: "Tổng doanh thu từ khách", v: formatCurrency(totalRevenue) },
          { l: "TB doanh thu/khách", v: formatCurrency(avgRevenue) },
        ].map((c) => (
          <Card key={c.l} className="text-center py-4 min-w-0 rounded-2xl border border-border/80 shadow-xs">
            <CardContent className="min-w-0 px-3">
              <p className="text-xs text-text-muted">{c.l}</p>
              <p className="text-base sm:text-lg font-bold text-text-primary tabular-nums break-words leading-snug mt-1">
                {c.v}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-1 bg-surface-hover rounded-xl p-1 w-fit border border-border/60">
        {(
          [
            { id: "revenue", label: "Theo doanh thu" },
            { id: "orders", label: "Theo số đơn" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`h-7 px-3 text-xs rounded-lg font-medium transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg ${
              sortMode === opt.id
                ? "bg-white dark:bg-surface text-text-primary shadow-xs font-semibold"
                : "text-text-muted hover:text-text-secondary"
            }`}
            onClick={() => setSortMode(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <Card className="rounded-2xl border border-border/80 shadow-xs overflow-hidden">
        <CardHeader className="py-3.5 px-4 sm:px-5 border-b border-border/70 bg-surface/70 backdrop-blur-sm">
          <CardTitle className="text-sm sm:text-base font-bold">
            Top {TOP_N} khách hàng theo{" "}
            {sortMode === "revenue" ? "doanh thu" : "số đơn"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <div className="h-[280px] w-full min-w-0 max-w-full overflow-hidden">
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-text-muted">
                Chưa có dữ liệu trong khoảng này
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  barCategoryGap="25%"
                  margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? "#334155" : "#E2E8F0"}
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: isDark ? "#94A3B8" : "#64748B" }}
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={
                      sortMode === "revenue"
                        ? (v: number) => formatAxisVnd(v)
                        : (v: number) => String(v)
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: isDark ? "#94A3B8" : "#64748B" }}
                    width={120}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(v: number) =>
                      sortMode === "revenue"
                        ? [formatCurrency(v), "Doanh thu"]
                        : [`${v} đơn`, "Đơn hàng"]
                    }
                    labelFormatter={(l) => `Khách: ${l}`}
                    contentStyle={{
                      background: isDark ? '#1E293B' : '#FFFFFF',
                      border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
                      borderRadius: 12,
                      color: isDark ? '#F1F5F9' : '#0F172A',
                      fontSize: 12,
                      boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.08)',
                    }}
                  />
                  <Bar
                    dataKey={sortMode === "revenue" ? "revenue" : "orders"}
                    fill={sortMode === "revenue" ? (isDark ? "#34D399" : "#10B981") : "#3B82F6"}
                    radius={[0, 6, 6, 0]}
                    name={sortMode === "revenue" ? "Doanh thu" : "Đơn hàng"}
                    maxBarSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-border/80 shadow-xs overflow-hidden">
        <CardHeader className="py-3.5 px-4 sm:px-5 border-b border-border/70 bg-surface/70 backdrop-blur-sm">
          <CardTitle className="text-sm sm:text-base font-bold">Bảng chi tiết</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {topRows.length === 0 ? (
            <p className="text-xs text-text-muted py-8 text-center">
              Chưa có dữ liệu
            </p>
          ) : (
            <div className="overflow-x-auto scrollbar-thin" data-table-hscroll>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle bg-muted/30">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted">
                      #
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted">
                      Khách hàng
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-muted">
                      Số đơn
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-muted">
                      Doanh thu
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {topRows.map((c, i) => (
                    <tr
                      key={c.customerId}
                      className={`hover:bg-surface-hover/70 transition-colors ${LIST_ROW_ANIM}`}
                      style={listRowStyle(i)}
                    >
                      <td className="px-4 py-3 text-xs text-text-muted font-mono">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-text-primary">
                        {c.customerName}
                      </td>
                      <td className="px-4 py-3 text-xs text-right tabular-nums text-text-secondary">
                        {c.orderCount}
                      </td>
                      <td className="px-4 py-3 text-xs text-right tabular-nums font-bold text-accent-fg">
                        {formatCurrency(c.totalRevenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

