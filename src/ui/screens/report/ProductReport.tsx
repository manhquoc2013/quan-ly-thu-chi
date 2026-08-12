/** ProductReport — top products by revenue (toggle: quantity) */
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
import { LIST_ROW_ANIM, listRowStyle } from "@/ui/components/listRowAnim";

type SortMode = "revenue" | "quantity";

const TOP_N = 5;

export function ProductReport() {
  const { isDark } = useTheme();
  const revenues = useRevenueStore((s) => s.records);
  const products = useProductStore((s) => s.products);
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
    if (sortMode === "quantity") {
      return getTopProductsByQuantity(filtered, products, TOP_N);
    }
    return getTopProductsByRevenue(filtered, products, TOP_N);
  }, [filtered, products, sortMode]);

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

  const chartData = useMemo(
    () =>
      topRows.map((p) => ({
        name: p.productName.slice(0, 14),
        quantity: p.totalQuantity,
        revenue: p.totalRevenue,
      })),
    [topRows],
  );

  return (
    <div className="space-y-[var(--s-lg)]">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-[var(--s-md)] min-w-0">
        {[
          { l: "Tổng số SP đã bán", v: String(distinctProducts) },
          { l: "Tổng số lượng bán ra", v: String(totalQuantity) },
          { l: "TB giá/SP", v: formatCurrency(avgPrice) },
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
            { id: "quantity", label: "Theo số lượng" },
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
            Top {TOP_N} sản phẩm theo{" "}
            {sortMode === "revenue" ? "doanh thu" : "số lượng"}
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
                <BarChart data={chartData} barCategoryGap="30%">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? "#334155" : "#CBD5E1"}
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
                    allowDecimals={false}
                    tickFormatter={
                      sortMode === "revenue"
                        ? (v: number) => formatAxisVnd(v)
                        : (v: number) => String(v)
                    }
                  />
                  <Tooltip
                    formatter={(v: number) =>
                      sortMode === "revenue"
                        ? formatCurrency(v)
                        : [`${v}`, "Số lượng"]
                    }
                    labelFormatter={(l) => `SP: ${l}`}
                  />
                  <Bar
                    dataKey={sortMode === "revenue" ? "revenue" : "quantity"}
                    fill={
                      sortMode === "revenue"
                        ? isDark
                          ? "#FBBF24"
                          : "#D97706"
                        : isDark
                          ? "#A78BFA"
                          : "#7C3AED"
                    }
                    radius={[4, 4, 0, 0]}
                    name={sortMode === "revenue" ? "Doanh thu" : "Số lượng"}
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
                {topRows.map((p, i) => (
                  <tr
                    key={p.productId}
                    className={`border-b border-border-subtle last:border-b-0 ${LIST_ROW_ANIM}`}
                    style={listRowStyle(i)}
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
  );
}
