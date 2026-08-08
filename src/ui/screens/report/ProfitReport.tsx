/** ProfitReport — P&L in dateRange: cash events (cọc+TT) + expenses by date */
import { useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { useExpenseStore } from "@/store/expenseStore";
import { useRevenueStore } from "@/store/revenueStore";
import { useReportStore } from "@/store/reportStore";
import { useTheme } from "@/hooks/useTheme";
import { formatCurrency } from "@/utils/currency";
import { formatAxisVnd, chartTooltipFormatter } from "@/utils/chartFormat";
import { isDateInRange } from "@/utils/date";
import { allCashEvents, sumCashEventsInRange } from "@/utils/revenueMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ProfitReport() {
  const { isDark } = useTheme();
  const expenses = useExpenseStore((s) => s.records);
  const revenues = useRevenueStore((s) => s.records);
  const { from, to } = useReportStore((s) => s.dateRange);

  const filteredExp = useMemo(
    () => expenses.filter((e) => isDateInRange(e.date, from, to)),
    [expenses, from, to],
  );
  const cashEvents = useMemo(() => {
    return allCashEvents(revenues).filter((e) => {
      if (from && e.date < from) return false;
      if (to && e.date > to) return false;
      return true;
    });
  }, [revenues, from, to]);

  const totalRevenue = useMemo(
    () => sumCashEventsInRange(revenues, from, to),
    [revenues, from, to],
  );
  const totalExpense = useMemo(
    () => filteredExp.reduce((s, e) => s + e.amount, 0),
    [filteredExp],
  );
  const profit = totalRevenue - totalExpense;
  const margin = totalRevenue ? (profit / totalRevenue) * 100 : 0;

  const byMonth = useMemo(() => {
    const map = new Map<string, { rev: number; exp: number }>();
    cashEvents.forEach((e) => {
      const k = e.date.slice(0, 7);
      const v = map.get(k) || { rev: 0, exp: 0 };
      v.rev += e.amount;
      map.set(k, v);
    });
    filteredExp.forEach((e) => {
      const k = e.date.slice(0, 7);
      const v = map.get(k) || { rev: 0, exp: 0 };
      v.exp += e.amount;
      map.set(k, v);
    });
    return Array.from(map.entries())
      .sort()
      .map(([m, { rev, exp }]) => ({
        month: m.slice(5),
        thu: rev,
        chi: exp,
        loi: rev - exp,
      }));
  }, [filteredExp, cashEvents]);

  return (
    <div className="space-y-[var(--s-lg)]">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[var(--s-md)]">
        {[
          {
            l: "Doanh thu đã thu",
            v: formatCurrency(totalRevenue),
            c: "text-success-fg",
          },
          {
            l: "Chi phí",
            v: formatCurrency(totalExpense),
            c: "text-danger-fg",
          },
          {
            l: "Lợi nhuận",
            v: formatCurrency(profit),
            c: profit >= 0 ? "text-success-fg" : "text-danger-fg",
          },
          {
            l: "Biên lợi nhuận",
            v: `${margin.toFixed(1)}%`,
            c: "text-accent-fg",
          },
        ].map((c) => (
          <Card key={c.l} className="text-center py-4">
            <CardContent>
              <p className="text-xs text-text-muted">{c.l}</p>
              <p className={`text-lg font-bold ${c.c}`}>{c.v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thu / chi / lãi theo tháng</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {byMonth.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-text-muted">
                Chưa có dữ liệu trong khoảng này
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={byMonth}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? '#334155' : '#CBD5E1'}
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
                    fill={isDark ? '#34D399' : '#059669'}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    dataKey="chi"
                    name="Chi"
                    fill={isDark ? '#F87171' : '#DC2626'}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Line
                    type="monotone"
                    dataKey="loi"
                    name="Lãi"
                    stroke={isDark ? '#60A5FA' : '#2563EB'}
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
