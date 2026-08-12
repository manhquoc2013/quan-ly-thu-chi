/** CustomerReport — top customers by revenue (toggle: orders) */
import { useMemo, useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SortMode = "revenue" | "orders";

const TOP_N = 5;

export function CustomerReport() {
  const { isDark } = useTheme();
  const revenues = useRevenueStore((s) => s.records);
  const customers = useCustomerStore((s) => s.customers);
  const { from, to } = useReportStore((s) => s.dateRange);
  const [sortMode, setSortMode] = useState<SortMode>("revenue");

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
    () => new Set(filtered.map((r) => r.customerId)).size,
    [filtered],
  );

  const totalRevenue = useMemo(
    () => filtered.reduce((sum, r) => sum + r.finalAmount, 0),
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
        name: c.customerName.slice(0, 16),
        orders: c.orderCount,
        revenue: c.totalRevenue,
      })),
    [topRows],
  );

  return (
    <div className="space-y-[var(--s-lg)]">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-[var(--s-md)] min-w-0">
        {[
          { l: "Tổng số khách", v: String(uniqueCustomers) },
          { l: "Tổng doanh thu từ khách", v: formatCurrency(totalRevenue) },
          { l: "TB doanh thu/khách", v: formatCurrency(avgRevenue) },
        ].map((c) => (
          <Card key={c.l} className="text-center py-4 min-w-0">
            <CardContent className="min-w-0 px-3">
              <p className="text-xs text-text-muted">{c.l}</p>
              <p className="text-base sm:text-lg font-bold text-text-primary tabular-nums break-words leading-snug">
                {c.v}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-1 bg-surface-hover rounded-lg p-0.5 w-fit">
        {(
          [
            { id: "revenue", label: "Theo doanh thu" },
            { id: "orders", label: "Theo số đơn" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`h-7 px-2.5 text-[11px] rounded-md font-medium transition-all ${
              sortMode === opt.id
                ? "bg-white dark:bg-surface text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary"
            }`}
            onClick={() => setSortMode(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Top {TOP_N} khách hàng theo{" "}
            {sortMode === "revenue" ? "doanh thu" : "số đơn"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] overflow-hidden">
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-text-muted">
                Chưa có dữ liệu trong khoảng này
              </div>
            ) : (
              <ResponsiveContainer>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  barCategoryGap="30%"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? "#334155" : "#CBD5E1"}
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    allowDecimals={false}
                    tickFormatter={
                      sortMode === "revenue"
                        ? (v: number) => formatAxisVnd(v)
                        : (v: number) => String(v)
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    width={120}
                  />
                  <Tooltip
                    formatter={(v: number) =>
                      sortMode === "revenue"
                        ? formatCurrency(v)
                        : [`${v} đơn`, "Đơn hàng"]
                    }
                    labelFormatter={(l) => `Khách: ${l}`}
                  />
                  <Bar
                    dataKey={sortMode === "revenue" ? "revenue" : "orders"}
                    fill={sortMode === "revenue" ? "#059669" : "#2563EB"}
                    radius={[4, 0, 0, 4]}
                    name={sortMode === "revenue" ? "Doanh thu" : "Đơn hàng"}
                    maxBarSize={36}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bảng chi tiết</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {topRows.length === 0 ? (
            <p className="text-xs text-text-muted py-6 text-center">
              Chưa có dữ liệu
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle bg-muted/40">
                  <th className="text-left px-3 py-2 text-xs font-medium text-text-muted">
                    #
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-text-muted">
                    Khách hàng
                  </th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-text-muted">
                    Số đơn
                  </th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-text-muted">
                    Doanh thu
                  </th>
                </tr>
              </thead>
              <tbody>
                {topRows.map((c, i) => (
                  <tr
                    key={c.customerId}
                    className={`border-b border-border-subtle last:border-b-0 ${LIST_ROW_ANIM}`}
                    style={listRowStyle(i)}
                  >
                    <td className="px-3 py-2 text-xs text-text-muted">
                      {i + 1}
                    </td>
                    <td className="px-3 py-2 text-xs font-medium text-text-primary">
                      {c.customerName}
                    </td>
                    <td className="px-3 py-2 text-xs text-right tabular-nums">
                      {c.orderCount}
                    </td>
                    <td className="px-3 py-2 text-xs text-right tabular-nums text-accent-fg">
                      {formatCurrency(c.totalRevenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
