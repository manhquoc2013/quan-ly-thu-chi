/**
 * CommandPalette — Global search (⌘K) for quick navigation & record lookup.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Receipt, Coins, Users, Package, ArrowRight, Loader2 } from 'lucide-react';
import { useExpenseStore } from '@/store/expenseStore';
import { useRevenueStore } from '@/store/revenueStore';
import { useCustomerStore } from '@/store/customerStore';
import { useProductStore } from '@/store/productStore';
import { useUIStore } from '@/store/uiStore';
import { getAllExpenses } from '@/services/expenseService';
import { getAllRevenues } from '@/services/revenueService';
import { getAllCustomers } from '@/services/customerService';
import { getAllProducts } from '@/services/productService';
import { formatCurrency } from '@/utils/currency';

interface Result {
  id: string;
  type: 'nav' | 'expense' | 'revenue' | 'customer' | 'product';
  title: string;
  subtitle: string;
  route?: string;
}

const NAV_ITEMS: Result[] = [
  { id: 'nav-dashboard', type: 'nav', title: 'Tổng quan', subtitle: 'Dashboard', route: '/' },
  { id: 'nav-expense', type: 'nav', title: 'Chi phí', subtitle: 'Quản lý chi phí', route: '/expense' },
  { id: 'nav-revenue', type: 'nav', title: 'Doanh thu', subtitle: 'Quản lý đơn hàng', route: '/revenue' },
  { id: 'nav-customers', type: 'nav', title: 'Khách hàng', subtitle: 'Danh sách khách', route: '/customers' },
  { id: 'nav-products', type: 'nav', title: 'Sản phẩm', subtitle: 'Danh mục sản phẩm', route: '/products' },
  { id: 'nav-report', type: 'nav', title: 'Báo cáo', subtitle: 'Thống kê', route: '/report' },
  { id: 'nav-settings', type: 'nav', title: 'Cài đặt', subtitle: 'Cấu hình', route: '/settings' },
];

const TYPE_ICON: Record<string, React.ReactNode> = {
  nav: <ArrowRight size={14} />,
  expense: <Receipt size={14} />,
  revenue: <Coins size={14} />,
  customer: <Users size={14} />,
  product: <Package size={14} />,
};

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const requestRecordDetail = useUIStore((s) => s.requestRecordDetail);
  const expenses = useExpenseStore((s) => s.records);
  const revenues = useRevenueStore((s) => s.records);
  const customers = useCustomerStore((s) => s.customers);
  const products = useProductStore((s) => s.products);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Ensure data is loaded when palette opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([getAllExpenses(), getAllRevenues(), getAllCustomers(), getAllProducts()])
      .finally(() => setLoading(false));
    setQuery('');
    setSelectedIndex(0);
  }, [open]);

  const results = useMemo<Result[]>(() => {
    if (!query.trim()) return NAV_ITEMS;

    const q = query.toLowerCase();
    const res: Result[] = [];

    for (const r of revenues) {
      if (r.orderCode.toLowerCase().includes(q) || (r.notes?.toLowerCase().includes(q) ?? false)) {
        res.push({ id: `rev-${r.id}`, type: 'revenue', title: r.orderCode, subtitle: `${formatCurrency(r.finalAmount)} · ${r.date}` });
      }
    }
    for (const e of expenses) {
      if (e.description.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)) {
        res.push({ id: `exp-${e.id}`, type: 'expense', title: e.description, subtitle: `${formatCurrency(e.amount)} · ${e.date}` });
      }
    }
    for (const c of customers) {
      if (c.name.toLowerCase().includes(q) || (c.phone?.includes(q) ?? false)) {
        res.push({ id: `cus-${c.id}`, type: 'customer', title: c.name, subtitle: c.phone ?? 'Chưa có SĐT' });
      }
    }
    for (const p of products) {
      if (p.name.toLowerCase().includes(q) || (p.sku?.toLowerCase().includes(q) ?? false)) {
        res.push({ id: `prd-${p.id}`, type: 'product', title: p.name, subtitle: `${formatCurrency(p.defaultUnitPrice)} / ${p.unit}` });
      }
    }

    if (res.length === 0) {
      // Fallback: search nav items
      for (const nav of NAV_ITEMS) {
        if (nav.title.toLowerCase().includes(q) || nav.subtitle.toLowerCase().includes(q)) {
          res.push(nav);
        }
      }
    }

    return res.slice(0, 10);
  }, [query, expenses, revenues, customers, products]);

  const handleSelect = useCallback((item: Result) => {
    onClose();
    const realId = item.id.includes('-') ? item.id.slice(item.id.indexOf('-') + 1) : item.id;
    if (item.type === 'nav' && item.route) { navigate(item.route); return; }
    if (item.type === 'revenue') { navigate('/revenue'); setTimeout(() => requestRecordDetail('revenue', realId), 80); return; }
    if (item.type === 'expense') { navigate('/expense'); setTimeout(() => requestRecordDetail('expense', realId), 80); return; }
    if (item.type === 'customer') { navigate('/customers'); setTimeout(() => requestRecordDetail('customer', realId), 80); return; }
    if (item.type === 'product') { navigate('/products'); setTimeout(() => requestRecordDetail('product', realId), 80); return; }
  }, [navigate, onClose, requestRecordDetail]);

  useEffect(() => { setSelectedIndex(0); }, [query]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, results.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' && results[selectedIndex]) { handleSelect(results[selectedIndex]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, results, selectedIndex, handleSelect, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div className="w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl overflow-hidden animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={18} className="text-text-muted shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm đơn hàng, chi phí, khách hàng..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            autoFocus
          />
          <kbd className="text-[10px] font-mono bg-surface-hover border border-border rounded px-1.5 py-0.5 text-text-muted">esc</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-text-muted">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-xs">Đang tải dữ liệu...</span>
            </div>
          ) : results.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-8">Không tìm thấy kết quả cho "{query}"</p>
          ) : (
            results.map((item, i) => (
              <button
                key={item.id} type="button"
                onClick={() => handleSelect(item)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === selectedIndex ? 'bg-accent-bg' : 'hover:bg-surface-hover'}`}
              >
                <span className={`shrink-0 ${item.type === 'nav' ? 'text-text-muted' : 'text-accent-fg'}`}>
                  {TYPE_ICON[item.type]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary truncate">{item.title}</p>
                  <p className="text-[11px] text-text-muted truncate">{item.subtitle}</p>
                </div>
                {item.type === 'nav' && <span className="text-[10px] text-text-muted">→</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
