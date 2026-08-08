/** ProductReport — top products by quantity and revenue */
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
import { useProductStore } from "@/store/productStore";
import { useReportStore } from "@/store/reportStore";
import { useTheme } from "@/hooks/useTheme";
import { formatCurrency } from "@/utils/currency";
import { formatAxisVnd } from "@/utils/chartFormat";
import { isDateInRange } from "@/utils/date";
import {
  getTopProductsByQuantity,
  getTopProductsByRevenue,
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

export function ProductReport() {
  const { isDark } = useTheme();
  const revenues = useRevenueStore((s) => s.records);
  const products = useProductStore((s) => s.products);
  const { from, to } = useReportStore((s) => s.dateRange);

  const filtered = useMemo(
    () =>
      revenues.filter(
        (r) => isDateInRange(r.date, from, to) && r.orderStatus !== "cancelled",
      ),
    [revenues, from, to],
  );

  const topByQuantity = useMemo(
    () => getTopProductsByQuantity(filtered, products, 10),
    [filtered, products],
  );

  const topByRevenue = useMemo(
    () => getTopProductsByRevenue(filtered, products, 10),
    [filtered, products],
  );

  const distinctProducts = useMemo(() => {
    const ids = new Set<string>();
    for (const r of filtered) {
      for (const item of r.items) {
        if (item.productId) ids.add(item.productId);
        else ids.add(item.name);
      }
    }
    return ids.size;
  }, [filtered]);

  const totalQuantity = useMemo(
    () =>
      filtered.reduce(
        (sum, r) => sum + r.items.reduce((s, i) => s + i.quantity, 0),
        0,
      ),
    [filtered],
  );

  const totalRevenue = useMemo(
    () => filtered.reduce((sum, r) => sum + r.finalAmount, 0),
    [filtered],
  );

  const avgPrice = useMemo(
    () => (totalQuantity > 0 ? Math.round(totalRevenue / totalQuantity) : 0),
    [totalQuantity, totalRevenue],
  );

  const byQuantityData = useMemo(
    () =>
      topByQuantity.map((p) => ({
        name: p.productName.slice(0, 14),
        quantity: p.totalQuantity,
        revenue: p.totalRevenue,
      })),
    [topByQuantity],
  );

  const byRevenueData = useMemo(
    () =>
      topByRevenue.map((p) => ({
        name: p.productName.slice(0, 14),
        revenue: p.totalRevenue,
      })),
    [topByRevenue],
  );

  return (
    <div className="space-y-[var(--s-lg)]">
      {/* Overview Cards */}
      <div className="grid grid-cols-3 gap-[var(--s-md)]">
        {[
          { l: "Tổng số SP đã bán", v: String(distinctProducts) },
          { l: "Tổng số lượng bán ra", v: String(totalQuantity) },
          { l: "TB giá/SP", v: formatCurrency(avgPrice) },
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
            <CardTitle>Top 10 sản phẩm theo số lượng</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] overflow-hidden">
              {byQuantityData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-text-muted">
                  Chưa có dữ liệu trong khoảng này
                </div>
              ) : (
                <ResponsiveContainer>
                  <BarChart data={byQuantityData} barCategoryGap="30%">
                    <CartesianGrid
                     strokeDasharray="3 3"
                      stroke={isDark ? '#334155' : '#CBD5E1'}
                     vertical={false}
                   />
                   <XAxis
                     dataKey="name"
                     tick={{ fontSize: 10 }}
                     angle={-30}
                     textAnchor="end"
                     height={60}
                   />
                   <YAxis
                     tick={{ fontSize: 11 }}
                     tickFormatter={(v: number) => formatAxisVnd(v)}
                   />
                   <Tooltip
                     formatter={(v: number) => formatCurrency(v)}
                     labelFormatter={(l) => `SP: ${l}`}
                   />
                   <Bar
                     dataKey="quantity"
                      fill={isDark ? '#A78BFA' : '#7C3AED'}
                      radius={[4, 4, 0, 0]}
                      name="Số lượng"
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
            <CardTitle>Top 10 sản phẩm theo doanh thu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] overflow-hidden">
              {byRevenueData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-text-muted">
                  Chưa có dữ liệu trong khoảng này
                </div>
              ) : (
                <ResponsiveContainer>
                  <BarChart data={byRevenueData} barCategoryGap="30%">
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={isDark ? '#334155' : '#CBD5E1'}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10 }}
                      angle={-30}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      width={52}
                      tickFormatter={(v: number) => formatAxisVnd(v)}
                    />
                    <Tooltip
                      formatter={(v: number) => formatCurrency(v)}
                      labelFormatter={(l) => `SP: ${l}`}
                    />
                    <Bar
                      dataKey="revenue"
                      fill={isDark ? '#FBBF24' : '#D97706'}
                      radius={[4, 4, 0, 0]}
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
            {topByQuantity.length === 0 ? (
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
                      Sản phẩm
                    </th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-text-muted">
                      Số lượng
                    </th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-text-muted">
                      Doanh thu
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topByQuantity.map((p, i) => (
                    <tr
                      key={p.productId}
                      className="border-b border-border-subtle last:border-b-0"
                    >
                      <td className="px-3 py-2 text-xs text-text-muted">
                        {i + 1}
                      </td>
                      <td className="px-3 py-2 text-xs font-medium text-text-primary truncate max-w-[160px]">
                        {p.productName}
                      </td>
                      <td className="px-3 py-2 text-xs text-right tabular-nums">
                        {p.totalQuantity}
                      </td>
                      <td className="px-3 py-2 text-xs text-right tabular-nums text-accent-fg">
                        {formatCurrency(p.totalRevenue)}
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
                      Sản phẩm
                    </th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-text-muted">
                      Số lượng
                    </th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-text-muted">
                      Doanh thu
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topByRevenue.map((p, i) => (
                    <tr
                      key={p.productId}
                      className="border-b border-border-subtle last:border-b-0"
                    >
                      <td className="px-3 py-2 text-xs text-text-muted">
                        {i + 1}
                      </td>
                      <td className="px-3 py-2 text-xs font-medium text-text-primary truncate max-w-[160px]">
                        {p.productName}
                      </td>
                      <td className="px-3 py-2 text-xs text-right tabular-nums">
                        {p.totalQuantity}
                      </td>
                      <td className="px-3 py-2 text-xs text-right tabular-nums text-accent-fg">
                        {formatCurrency(p.totalRevenue)}
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
