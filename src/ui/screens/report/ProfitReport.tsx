/** ProfitReport — P&L from real store data */
import { useMemo } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useExpenseStore } from '@/store/expenseStore';
import { useRevenueStore } from '@/store/revenueStore';
import { formatCurrency } from '@/utils/currency';
import { Panel } from '@components/Panel';

export function ProfitReport() {
  const expenses = useExpenseStore((s) => s.records);
  const revenues = useRevenueStore((s) => s.records);
  const totalRevenue = useMemo(() => revenues.reduce((s, r) => s + r.finalAmount, 0), [revenues]);
  const totalExpense = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const profit = totalRevenue - totalExpense;
  const margin = totalRevenue ? ((profit / totalRevenue) * 100) : 0;
  const byMonth = useMemo(() => {
    const map = new Map<string, { rev: number; exp: number }>();
    revenues.forEach(r => { const k = r.date.slice(0,7); const v = map.get(k) || { rev:0,exp:0 }; v.rev+=r.finalAmount; map.set(k,v); });
    expenses.forEach(e => { const k = e.date.slice(0,7); const v = map.get(k) || { rev:0,exp:0 }; v.exp+=e.amount; map.set(k,v); });
    return Array.from(map.entries()).sort().map(([m, {rev,exp}]) => ({ month: m.slice(5), thu: rev/1_000_000, chi: exp/1_000_000, loi: (rev-exp)/1_000_000 }));
  }, [expenses, revenues]);
  return <div className="space-y-[var(--s-lg)]">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-[var(--s-md)]">
      {[{l:'Doanh thu',v:formatCurrency(totalRevenue),c:'text-success-fg'},{l:'Chi phí',v:formatCurrency(totalExpense),c:'text-danger-fg'},{l:'Lợi nhuận',v:formatCurrency(profit),c:profit>=0?'text-success-fg':'text-danger-fg'},{l:'Biên lợi nhuận',v:`${margin.toFixed(1)}%`,c:'text-accent-fg'}].map(c=><Panel key={c.l} className="text-center py-4"><p className="text-xs text-text-muted">{c.l}</p><p className={`text-lg font-bold ${c.c}`}>{c.v}</p></Panel>)}
    </div>
    <Panel title="Lợi nhuận theo tháng">
      <div className="h-[280px] overflow-hidden">{byMonth.length===0?<div className="flex items-center justify-center h-full text-xs text-text-muted">Chưa có dữ liệu</div>:<ResponsiveContainer><ComposedChart data={byMonth} barCategoryGap="30%"><CartesianGrid strokeDasharray="3 3" stroke="#E0E3E8"/><XAxis dataKey="month" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}} tickFormatter={(v:number)=>`${v}tr`}/><Tooltip/><Bar dataKey="thu" fill="#059669" radius={[4,4,0,0]} name="Thu"/><Bar dataKey="chi" fill="#DC2626" radius={[4,4,0,0]} name="Chi"/><Line dataKey="loi" stroke="#2563EB" strokeWidth={2} dot={false} name="Lợi nhuận"/></ComposedChart></ResponsiveContainer>}</div>
    </Panel>
  </div>;
}
