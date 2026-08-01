/** RevenueReport — cash-flow revenue (cọc + TT) in dateRange */
import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useRevenueStore } from "@/store/revenueStore";
import { useReportStore } from "@/store/reportStore";
import { formatCurrency } from "@/utils/currency";
import { formatAxisVnd } from "@/utils/chartFormat";
import { allCashEvents, sumCashEventsInRange } from "@/utils/revenueMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = [
  "#2563EB",
  "#7C3AED",
  "#16A34A",
  "#D97706",
  "#EC4899",
  "#6B7280",
];

export function RevenueReport() {
  const revenues = useRevenueStore((s) => s.records);
  const { from, to } = useReportStore((s) => s.dateRange);

  const events = useMemo(() => {
    return allCashEvents(revenues).filter((e) => {
      if (from && e.date < from) return false;
      if (to && e.date > to) return false;
      return true;
    });
  }, [revenues, from, to]);

  const total = useMemo(
    () => sumCashEventsInRange(revenues, from, to),
    [revenues, from, to],
  );
  const orderIds = useMemo(
    () => new Set(events.map((e) => e.orderId)),
    [events],
  );

  const byMonth = useMemo(() => {
    const map = new Map<string, number>();
    events.forEach((e) => {
      const k = e.date.slice(0, 7);
      map.set(k, (map.get(k) || 0) + e.amount);
    });
    return Array.from(map.entries())
      .sort()
      .map(([month, totalAmt]) => ({ month: month.slice(5), total: totalAmt }));
  }, [events]);

  const byKind = useMemo(() => {
    const deposit = events
      .filter((e) => e.kind === "deposit")
      .reduce((s, e) => s + e.amount, 0);
    const payment = events
      .filter((e) => e.kind === "payment")
      .reduce((s, e) => s + e.amount, 0);
    return [
      { name: "Tiền cọc", value: deposit },
      { name: "Thanh toán", value: payment },
    ].filter((d) => d.value > 0);
  }, [events]);

  return (
    <div className="space-y-[var(--s-lg)]">
      <div className="grid grid-cols-3 gap-[var(--s-md)]">
        {[
          { l: "Tổng thu (cọc + TT)", v: formatCurrency(total) },
          { l: "Số đơn có thu", v: String(orderIds.size) },
          {
            l: "TB/đơn",
            v: formatCurrency(
              orderIds.size ? Math.round(total / orderIds.size) : 0,
            ),
          },
        ].map((c) => (
          <Card key={c.l} className="text-center py-4">
            <CardContent>
              <p className="text-xs text-text-muted">{c.l}</p>
              <p className="text-lg font-bold text-text-primary">{c.v}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--s-lg)]">
        <Card>
          <CardHeader>
            <CardTitle>Theo tháng thu tiền</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] overflow-hidden">
              {byMonth.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-text-muted">
                  Chưa có dữ liệu trong khoảng này
                </div>
              ) : (
                <ResponsiveContainer>
                  <BarChart data={byMonth} barCategoryGap="30%">
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#E0E3E8"
                      vertical={false}
                    />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      width={52}
                      tickFormatter={(v: number) => formatAxisVnd(v)}
                    />
                    <Tooltip
                      formatter={(v: number) => formatCurrency(v)}
                      labelFormatter={(l) => `Tháng ${l}`}
                    />
                    <Bar
                      dataKey="total"
                      fill="#059669"
                      radius={[4, 4, 0, 0]}
                      name="Thu"
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
            <CardTitle>Cọc vs thanh toán</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] overflow-hidden">
              {byKind.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-text-muted">
                  Chưa có dữ liệu trong khoảng này
                </div>
              ) : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={byKind}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({
                        name,
                        percent,
                      }: {
                        name: string;
                        percent: number;
                      }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {byKind.map((_, i) => (
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
      </div>
    </div>
  );
}
