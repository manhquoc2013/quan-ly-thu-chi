/** CustomerReport — top customers by order count and revenue */
import { useMemo } from "react";
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

const COLORS = [
  "#2563EB",
  "#7C3AED",
  "#16A34A",
  "#D97706",
  "#EC4899",
  "#6B7280",
];

export function CustomerReport() {
  const { isDark } = useTheme();
  const revenues = useRevenueStore((s) => s.records);
  const customers = useCustomerStore((s) => s.customers);
  const { from, to } = useReportStore((s) => s.dateRange);

  const filtered = useMemo(
    () =>
      revenues.filter(
        (r) => isDateInRange(r.date, from, to) && r.orderStatus !== "cancelled",
      ),
    [revenues, from, to],
  );

  const topByOrders = useMemo(
    () => getTopCustomersByOrderCount(filtered, customers, 10),
    [filtered, customers],
  );

  const topByRevenue = useMemo(
    () => getTopCustomersByRevenue(filtered, customers, 10),
    [filtered, customers],
  );

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

  const byOrdersData = useMemo(
    () =>
      topByOrders.map((c) => ({
        name: c.customerName.slice(0, 16),
        orders: c.orderCount,
        revenue: c.totalRevenue,
      })),
    [topByOrders],
  );

  const byRevenueData = useMemo(
    () =>
      topByRevenue.map((c) => ({
        name: c.customerName.slice(0, 16),
        revenue: c.totalRevenue,
      })),
    [topByRevenue],
  );

  return (
    <div className="space-y-[var(--s-lg)]">
      {/* Overview Cards */}
      <div className="grid grid-cols-3 gap-[var(--s-md)]">
        {[
          { l: "Tổng số khách", v: String(uniqueCustomers) },
          { l: "Tổng doanh thu từ khách", v: formatCurrency(totalRevenue) },
          { l: "TB doanh thu/khách", v: formatCurrency(avgRevenue) },
        ].map((c) => (
          <Card key={c.l} className="text-center py-4">
            <CardContent>
              <p className="text-xs text-text-muted">{c.l}</p>
              <p className="text-lg font-bold text-text-primary">{c.v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--s-lg)]">
        <Card>
          <CardHeader>
            <CardTitle>Top 10 khách hàng theo số đơn hàng</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] overflow-hidden">
              {byOrdersData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-text-muted">
                  Chưa có dữ liệu trong khoảng này
                </div>
              ) : (
                <ResponsiveContainer>
                  <BarChart
                    data={byOrdersData}
                    layout="vertical"
                    barCategoryGap="30%"
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={isDark ? '#334155' : '#CBD5E1'}
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: number) => formatAxisVnd(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      width={120}
                    />
                    <Tooltip
                      formatter={(v: number) => formatCurrency(v)}
                      labelFormatter={(l) => `Khách: ${l}`}
                    />
                    <Bar
                      dataKey="orders"
                      fill="#2563EB"
                      radius={[4, 0, 0, 4]}
                      name="Đơn hàng"
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
            <CardTitle>Top 10 khách hàng theo doanh thu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] overflow-hidden">
              {byRevenueData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-text-muted">
                  Chưa có dữ liệu trong khoảng này
                </div>
              ) : (
                <ResponsiveContainer>
                  <BarChart
                    data={byRevenueData}
                    layout="vertical"
                    barCategoryGap="30%"
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={isDark ? '#334155' : '#CBD5E1'}
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: number) => formatAxisVnd(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      width={120}
                    />
                    <Tooltip
                      formatter={(v: number) => formatCurrency(v)}
                      labelFormatter={(l) => `Khách: ${l}`}
                    />
                    <Bar
                      dataKey="revenue"
                      fill="#059669"
                      radius={[4, 0, 0, 4]}
                      name="Doanh thu"
                      maxBarSize={36}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--s-lg)]">
        <Card>
          <CardHeader>
            <CardTitle>Bảng chi tiết</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topByOrders.length === 0 ? (
              <p className="text-xs text-text-muted py-6 text-center">
                Chưa có dữ liệu
              </p>
            ) : (
              <table className="w-full text-sm">
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
                  {topByOrders.map((c, i) => (
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

        <Card>
          <CardHeader>
            <CardTitle>Bảng chi tiết</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topByRevenue.length === 0 ? (
              <p className="text-xs text-text-muted py-6 text-center">
                Chưa có dữ liệu
              </p>
            ) : (
              <table className="w-full text-sm">
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
                  {topByRevenue.map((c, i) => (
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
    </div>
  );
}
