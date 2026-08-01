/**
 * DashboardScreen — Real data from expense & revenue stores.
 */

import { useMemo } from 'react';
import { Panel } from '@components/Panel';
import { Badge } from '@components/Badge';
import { ArrowUpRight, ArrowDownRight, TrendingUp, Briefcase, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useExpenseStore } from '@/store/expenseStore';
import { useRevenueStore } from '@/store/revenueStore';
import { formatCurrency } from '@/utils/currency';

export function DashboardScreen() {
  const expenses = useExpenseStore((s) => s.records);
  const revenues = useRevenueStore((s) => s.records);

  const totalExpense = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const totalRevenue = useMemo(() => revenues.reduce((s, r) => s + r.finalAmount, 0), [revenues]);
  const profit = totalRevenue - totalExpense;
  const pendingCount = useMemo(() => revenues.filter(r => r.orderStatus !== 'completed' && r.orderStatus !== 'cancelled').length, [revenues]);

  const chartData = useMemo(() => {
    const days = ['T2','T3','T4','T5','T6','T7','CN'];
    const today = new Date();
    return days.map((d, i) => {
      const date = new Date(today); date.setDate(date.getDate() - (6 - i));
      const dateStr = date.toISOString().slice(0, 10);
      return {
        day: d,
        thu: revenues.filter(r => r.date === dateStr).reduce((s, r) => s + r.finalAmount / 1_000_000, 0),
        chi: expenses.filter(e => e.date === dateStr).reduce((s, e) => s + e.amount / 1_000_000, 0),
      };
    });
  }, [expenses, revenues]);

  const pendingOrders = useMemo(() =>
    revenues.filter(r => r.orderStatus !== 'completed' && r.orderStatus !== 'cancelled').slice(0, 5),
  [revenues]);

  const recentTransactions = useMemo(() => {
    const items = [
      ...expenses.map(e => ({ id: e.id, desc: e.description, amount: e.amount, type: 'expense' as const, date: e.date, cat: e.category })),
      ...revenues.map(r => ({ id: r.id, desc: r.orderCode, amount: r.finalAmount, type: 'income' as const, date: r.date, cat: 'Doanh thu' })),
    ];
    return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  }, [expenses, revenues]);

  return (
    <div className="space-y-[var(--s-lg)]">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[var(--s-md)]">
        {[
          { title: 'Tổng thu', value: formatCurrency(totalRevenue), icon: ArrowUpRight, positive: true },
          { title: 'Tổng chi', value: formatCurrency(totalExpense), icon: ArrowDownRight, positive: false },
          { title: 'Lợi nhuận', value: formatCurrency(profit), icon: TrendingUp, positive: profit >= 0 },
          { title: 'Đơn chờ', value: String(pendingCount), icon: Briefcase, positive: false },
        ].map(c => (
          <Panel key={c.title} style="translucent" className="flex flex-col gap-1 hover:shadow-lg hover:-translate-y-px transition-all">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex items-center justify-center w-10 h-10 rounded-field bg-surface-hover">
                <c.icon className="w-5 h-5 text-accent-fg" />
              </div>
              <span className="text-[13px] text-text-muted">{c.title}</span>
            </div>
            <p className="text-xl font-bold text-text-primary">{c.value}</p>
          </Panel>
        ))}
      </div>

      <Panel title="Thu chi 7 ngày gần đây" titleTrailing={<Badge variant="accent">Tuần này</Badge>}>
        <div className="h-[200px] -mx-2">
          {chartData.every(d => d.thu === 0 && d.chi === 0) ? (
            <div className="flex items-center justify-center h-full text-xs text-text-muted">Chưa có dữ liệu</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#E0E3E8" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}tr`} />
                <Tooltip contentStyle={{ background: '#1E293B', border: 'none', borderRadius: 6, color: '#F8FAFC', fontSize: 12 }} />
                <Bar dataKey="thu" fill="#059669" radius={[4,4,0,0]} />
                <Bar dataKey="chi" fill="#DC2626" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--s-lg)]">
        <Panel title="Đơn đang chờ" titleTrailing={<Badge variant="warning">{pendingOrders.length} đơn</Badge>}>
          {pendingOrders.length === 0 ? (
            <p className="text-xs text-text-muted py-4 text-center">Không có đơn chờ</p>
          ) : pendingOrders.map(o => (
            <div key={o.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-[var(--s-lg)] py-[var(--s-md)] border-b border-border-subtle last:border-b-0">
              <div><span className="font-mono text-xs text-accent-fg font-semibold">{o.orderCode}</span></div>
              <div className="flex items-center gap-1 text-xs text-text-muted"><Clock size={12} />{o.date}</div>
              <span className="font-semibold text-xs text-right">{formatCurrency(o.finalAmount)}</span>
            </div>
          ))}
        </Panel>

        <Panel title="Giao dịch gần đây" titleTrailing={<Badge variant="neutral">{recentTransactions.length} mới</Badge>}>
          {recentTransactions.length === 0 ? (
            <p className="text-xs text-text-muted py-4 text-center">Chưa có giao dịch</p>
          ) : recentTransactions.map(tx => (
            <div key={tx.id} className="flex items-center justify-between py-[var(--s-sm)] border-b border-border-subtle last:border-b-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`flex items-center justify-center shrink-0 w-8 h-8 rounded-full ${tx.type === 'income' ? 'bg-success-bg' : 'bg-danger-bg'}`}>
                  {tx.type === 'income' ? <ArrowUpRight size={14} className="text-success-fg" /> : <ArrowDownRight size={14} className="text-danger-fg" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">{tx.desc}</p>
                  <p className="text-[10px] text-text-muted">{tx.cat} · {tx.date}</p>
                </div>
              </div>
              <span className={`shrink-0 text-xs font-semibold ${tx.type === 'income' ? 'text-success-fg' : 'text-danger-fg'}`}>
                {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
              </span>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}
