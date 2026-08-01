/** PlatformReport — revenue distribution across order channels */
import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useRevenueStore } from "@/store/revenueStore";
import { usePlatformStore } from "@/store/platformStore";
import { useReportStore } from "@/store/reportStore";
import { formatCurrency } from "@/utils/currency";
import { formatAxisVnd } from "@/utils/chartFormat";
import { isDateInRange } from "@/utils/date";
import { getRevenueByPlatform } from "@/services/reportService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = [
  "#2563EB",
  "#7C3AED",
  "#16A34A",
  "#D97706",
  "#EC4899",
  "#6B7280",
];

export function PlatformReport() {
  const revenues = useRevenueStore((s) => s.records);
  const platforms = usePlatformStore((s) => s.platforms);
  const { from, to } = useReportStore((s) => s.dateRange);

  const filtered = useMemo(
    () =>
      revenues.filter(
        (r) => isDateInRange(r.date, from, to) && r.orderStatus !== "cancelled",
      ),
    [revenues, from, to],
  );

  const byPlatform = useMemo(
    () => getRevenueByPlatform(filtered, platforms),
    [filtered, platforms],
  );

  const activePlatforms = useMemo(
    () => platforms.filter((p) => p.active).length,
    [platforms],
  );

  const totalRevenue = useMemo(
    () => filtered.reduce((sum, r) => sum + r.finalAmount, 0),
    [filtered],
  );

  const topPlatform = useMemo(
    () => (byPlatform.length > 0 ? byPlatform[0] : null),
    [byPlatform],
  );

  const pieData = useMemo(
    () =>
      byPlatform.map((p) => ({
        name: p.platformName,
        value: p.totalRevenue,
        percentage: p.percentage,
      })),
    [byPlatform],
  );

  return (
    <div className="space-y-[var(--s-lg)]">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-[var(--s-md)]">
        <Card className="text-center py-4">
          <CardContent>
            <p className="text-xs text-text-muted">
              Tổng số kênh đang hoạt động
            </p>
            <p className="text-lg font-bold text-text-primary">
              {String(activePlatforms)}
            </p>
          </CardContent>
        </Card>
        <Card className="text-center py-4">
          <CardContent>
            <p className="text-xs text-text-muted">Kênh bán chạy nhất</p>
            <p className="text-lg font-bold text-text-primary">
              {topPlatform ? topPlatform.platformName : "—"}
            </p>
            {topPlatform && (
              <p className="text-sm font-semibold text-accent-fg">
                {formatCurrency(topPlatform.totalRevenue)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart + Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--s-lg)]">
        <Card>
          <CardHeader>
            <CardTitle>Doanh thu theo kênh</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] overflow-hidden">
              {pieData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-text-muted">
                  Chưa có dữ liệu trong khoảng này
                </div>
              ) : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({
                        name,
                        percent,
                      }: {
                        name: string;
                        percent: number;
                      }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Chi tiết theo kênh</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {byPlatform.length === 0 ? (
              <p className="text-xs text-text-muted py-8 text-center">
                Chưa có dữ liệu
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle bg-muted/40">
                    <th className="text-left px-3 py-2 text-xs font-medium text-text-muted">
                      Kênh
                    </th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-text-muted">
                      Số đơn
                    </th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-text-muted">
                      Doanh thu
                    </th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-text-muted">
                      %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {byPlatform.map((p) => (
                    <tr
                      key={p.platformId}
                      className="border-b border-border-subtle last:border-b-0"
                    >
                      <td className="px-3 py-2 text-xs font-medium text-text-primary">
                        {p.platformName}
                      </td>
                      <td className="px-3 py-2 text-xs text-right tabular-nums">
                        {p.orderCount}
                      </td>
                      <td className="px-3 py-2 text-xs text-right tabular-nums text-accent-fg">
                        {formatCurrency(p.totalRevenue)}
                      </td>
                      <td className="px-3 py-2 text-xs text-right tabular-nums text-text-muted">
                        {p.percentage.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                {byPlatform.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-border font-semibold">
                      <td className="px-3 py-2 text-xs text-text-primary">
                        Tổng
                      </td>
                      <td className="px-3 py-2 text-xs text-right tabular-nums">
                        {byPlatform.reduce((s, p) => s + p.orderCount, 0)}
                      </td>
                      <td className="px-3 py-2 text-xs text-right tabular-nums text-accent-fg">
                        {formatCurrency(totalRevenue)}
                      </td>
                      <td className="px-3 py-2 text-xs text-right tabular-nums text-text-muted">
                        100%
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
