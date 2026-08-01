/** RevenueReport — Real data from revenueStore */
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { useRevenueStore } from '@/store/revenueStore';
import { formatCurrency } from '@/utils/currency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/models';

export function RevenueReport() {
  const revenues = useRevenueStore((s) => s.records);
  const total = useMemo(() => revenues.reduce((s, r) => s + r.finalAmount, 0), [revenues]);
  const byMonth = useMemo(() => {
    const m = new Map<string, number>(); revenues.forEach(r => { const k = r.date.slice(0,7); m.set(k,(m.get(k)||0)+r.finalAmount); });
    return Array.from(m.entries()).sort().map(([mo, v]) => ({ month: mo.slice(5), total: v }));
  }, [revenues]);
  const byStatus = useMemo(() => {
    const m = new Map<string, number>(); revenues.forEach(r => m.set(r.orderStatus, (m.get(r.orderStatus)||0)+1));
    const all = Array.from(m.entries()).map(([s, c]) => ({ name: ORDER_STATUS_LABELS[s as OrderStatus]||s, value: c }));
    // Sort descending by value, take top 5, group the rest as "Khác"
    const sorted = all.sort((a, b) => b.value - a.value);
    const top5 = sorted.slice(0, 5);
    const remainingSum = sorted.slice(5).reduce((s, d) => s + d.value, 0);
    if (remainingSum > 0) {
      top5.push({ name: 'Khác', value: remainingSum });
    }
    return top5;
  }, [revenues]);
  return <div className="space-y-[var(--s-lg)]">
    <div className="grid grid-cols-3 gap-[var(--s-md)]">
      {[{l:'Tổng thu',v:formatCurrency(total)},{l:'Số đơn',v:String(revenues.length)},{l:'TB/đơn',v:formatCurrency(revenues.length?Math.round(total/revenues.length):0)}].map(c=><Card key={c.l} className="text-center py-4"><CardContent><p className="text-xs text-text-muted">{c.l}</p><p className="text-lg font-bold text-text-primary">{c.v}</p></CardContent></Card>)}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--s-lg)]">
      <Card><CardHeader><CardTitle>Theo tháng</CardTitle></CardHeader><CardContent><div className="h-[280px] overflow-hidden">{byMonth.length===0?<div className="flex items-center justify-center h-full text-xs text-text-muted">Chưa có dữ liệu</div>:<ResponsiveContainer><BarChart data={byMonth} barCategoryGap="30%"><CartesianGrid strokeDasharray="3 3" stroke="#E0E3E8"/><XAxis dataKey="month" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}} tickFormatter={(v:number)=>`${(v/1_000_000).toFixed(0)}tr`}/><Tooltip formatter={(v:number)=>formatCurrency(v)}/><Bar dataKey="total" fill="#059669" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>}</div></CardContent></Card>
      <Card><CardHeader><CardTitle>Theo trạng thái</CardTitle></CardHeader><CardContent><div className="h-[280px] overflow-hidden">{byStatus.length===0?<div className="flex items-center justify-center h-full text-xs text-text-muted">Chưa có dữ liệu</div>:<ResponsiveContainer><PieChart><Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({name, percent}: {name: string, percent: number}) => (name === 'Khác' ? undefined : `${name} ${(percent*100).toFixed(0)}%`)}>{byStatus.map((_,i)=><Cell key={i} fill={['#2563EB','#7C3AED','#16A34A','#D97706','#EC4899'][i%5]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer>}</div></CardContent></Card>
    </div>
  </div>;
}
