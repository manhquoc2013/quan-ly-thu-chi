/** ExpenseReport — filtered by report dateRange (expense.date) */
import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useExpenseStore } from "@/store/expenseStore";
import { useReportStore } from "@/store/reportStore";
import { useTheme } from "@/hooks/useTheme";
import { formatCurrency } from "@/utils/currency";
import { formatAxisVnd } from "@/utils/chartFormat";
import { isDateInRange } from "@/utils/date";
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/models";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = [
  "#2563EB",
  "#7C3AED",
  "#16A34A",
  "#D97706",
  "#EC4899",
  "#14B8A6",
  "#F97316",
  "#8B5CF6",
  "#EF4444",
  "#6B7280",
];

export function ExpenseReport() {
  const { isDark } = useTheme();
  const expenses = useExpenseStore((s) => s.records);
  const { from, to } = useReportStore((s) => s.dateRange);

  const filtered = useMemo(
    () => expenses.filter((e) => isDateInRange(e.date, from, to)),
    [expenses, from, to],
  );

  const total = useMemo(
    () => filtered.reduce((s, e) => s + e.amount, 0),
    [filtered],
  );
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((e) =>
      m.set(e.category, (m.get(e.category) || 0) + e.amount),
    );
    const all = Array.from(m.entries()).map(([c, v]) => ({
      name: EXPENSE_CATEGORY_LABELS[c as ExpenseCategory] || c,
      value: v,
    }));
    const sorted = all.sort((a, b) => b.value - a.value);
    const top5 = sorted.slice(0, 5);
    const remainingSum = sorted.slice(5).reduce((s, d) => s + d.value, 0);
    if (remainingSum > 0) top5.push({ name: "Khác", value: remainingSum });
    return top5;
  }, [filtered]);

  const byMonth = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((e) => {
      const k = e.date.slice(0, 7);
      m.set(k, (m.get(k) || 0) + e.amount);
    });
    return Array.from(m.entries())
      .sort()
      .map(([mo, v]) => ({ month: mo.slice(5), total: v }));
  }, [filtered]);

  const daySpan = Math.max(
    1,
    Math.round(
      (new Date(to).getTime() - new Date(from).getTime()) /
        (1000 * 60 * 60 * 24),
    ) + 1,
  );

  return (
    <div className="space-y-[var(--s-lg)]">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-[var(--s-md)] min-w-0">
        {[
          { l: "Tổng chi", v: formatCurrency(total) },
          { l: "Số khoản", v: String(filtered.length) },
          { l: "TB/ngày", v: formatCurrency(Math.round(total / daySpan)) },
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--s-lg)]">
        <Card>
          <CardHeader>
            <CardTitle>Theo danh mục</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] overflow-hidden">
              {byCategory.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-text-muted">
                  Chưa có dữ liệu trong khoảng này
                </div>
              ) : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={byCategory}
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
                      }) =>
                        name === "Khác"
                          ? undefined
                          : `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {byCategory.map((_, i) => (
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
            <CardTitle>Theo tháng</CardTitle>
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
                      stroke={isDark ? '#334155' : '#CBD5E1'}
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
                      fill={isDark ? '#F87171' : '#DC2626'}
                      radius={[4, 4, 0, 0]}
                      name="Chi"
                      maxBarSize={36}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
