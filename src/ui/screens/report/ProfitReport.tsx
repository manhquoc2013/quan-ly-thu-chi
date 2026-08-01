/** ProfitReport — P&L from real store data */
import { useMemo } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useExpenseStore } from '@/store/expenseStore';
import { useRevenueStore } from '@/store/revenueStore';
import { formatCurrency } from '@/utils/currency';
import { formatAxisVnd, chartTooltipFormatter } from '@/utils/chartFormat';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ProfitReport() {
  const expenses = useExpenseStore((s) => s.records);
  const revenues = useRevenueStore((s) => s.records);
  const totalRevenue = useMemo(() => revenues.reduce((s, r) => s + r.finalAmount, 0), [revenues]);
  const totalExpense = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const profit = totalRevenue - totalExpense;
  const margin = totalRevenue ? (profit / totalRevenue) * 100 : 0;

  const byMonth = useMemo(() => {
    const map = new Map<string, { rev: number; exp: number }>();
    revenues.forEach((r) => {
      const k = r.date.slice(0, 7);
      const v = map.get(k) || { rev: 0, exp: 0 };
      v.rev += r.finalAmount;
      map.set(k, v);
    });
    expenses.forEach((e) => {
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
  }, [expenses, revenues]);

  return (
    <div className="space-y-[var(--s-lg)]">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[var(--s-md)]">
        {[
          { l: 'Doanh thu', v: formatCurrency(totalRevenue), c: 'text-success-fg' },
          { l: 'Chi phí', v: formatCurrency(totalExpense), c: 'text-danger-fg' },
          { l: 'Lợi nhuận', v: formatCurrency(profit), c: profit >= 0 ? 'text-success-fg' : 'text-danger-fg' },
          { l: 'Biên lợi nhuận', v: `${margin.toFixed(1)}%`, c: 'text-accent-fg' },
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
          <CardTitle>Lợi nhuận theo tháng</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] overflow-hidden">
            {byMonth.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-text-muted">Chưa có dữ liệu</div>
            ) : (
              <ResponsiveContainer>
                <ComposedChart data={byMonth} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E3E8" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={52} tickFormatter={formatAxisVnd} />
                  <Tooltip
                    formatter={chartTooltipFormatter as never}
                    labelFormatter={(l) => `Tháng ${l}`}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend />
                  <Bar dataKey="thu" fill="#059669" radius={[4, 4, 0, 0]} name="Thu" maxBarSize={32} />
                  <Bar dataKey="chi" fill="#DC2626" radius={[4, 4, 0, 0]} name="Chi" maxBarSize={32} />
                  <Line dataKey="loi" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} name="Lợi nhuận" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
