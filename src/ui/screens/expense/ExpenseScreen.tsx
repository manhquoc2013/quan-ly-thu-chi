/**
 * ExpenseScreen — Main expense management screen.
 * Data flow: IndexedDB → expenseService → Zustand store → UI
 */

import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Expense, ExpenseCategory, ExpenseStatus } from '@/models';
import { useExpenseStore } from '@/store/expenseStore';
import { useUIStore } from '@/store/uiStore';
import { getAllExpenses, updateExpense, deleteExpenses } from '@/services/expenseService';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DatePicker } from '@/ui/components/DatePicker';
import { ExpenseGrid } from './ExpenseGrid';
import { ExpenseDialog } from './ExpenseDialog';

const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Tất cả danh mục' },
  { value: 'office', label: 'Văn phòng phẩm' },
  { value: 'rent', label: 'Thuê mặt bằng' },
  { value: 'utilities', label: 'Điện, nước, internet' },
  { value: 'salary', label: 'Lương nhân viên' },
  { value: 'marketing', label: 'Marketing, quảng cáo' },
  { value: 'supplies', label: 'Nguyên vật liệu' },
  { value: 'transportation', label: 'Vận chuyển, xăng xe' },
  { value: 'maintenance', label: 'Bảo trì, sửa chữa' },
  { value: 'tax', label: 'Thuế, phí' },
  { value: 'other', label: 'Khác' },
];

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'pending', label: 'Chờ thanh toán' },
  { value: 'paid', label: 'Đã thanh toán' },
  { value: 'cancelled', label: 'Đã hủy' },
];

export function ExpenseScreen() {
  const records = useExpenseStore((s) => s.records);
  const filters = useExpenseStore((s) => s.filters);
  const setFilters = useExpenseStore((s) => s.setFilters);

  const filtered = useMemo(() => {
    let result = [...records];
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(e => e.description.toLowerCase().includes(q) || (e.supplier?.toLowerCase().includes(q) ?? false) || e.tags.some(t => t.toLowerCase().includes(q)));
    }
    if (filters.category) result = result.filter(e => e.category === filters.category);
    if (filters.status) result = result.filter(e => e.status === filters.status);
    if (filters.dateFrom) result = result.filter(e => e.date >= filters.dateFrom);
    if (filters.dateTo) result = result.filter(e => e.date <= filters.dateTo);
    result.sort((a, b) => b.date.localeCompare(a.date));
    return result;
  }, [records, filters]);

  const [searchInput, setSearchInput] = useState(filters.search);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load data from IndexedDB on mount
  useEffect(() => {
    getAllExpenses().then(() => setLoading(false));
  }, []);

  // Open edit dialog when AI chat requests expense detail
  const recordDetailRequest = useUIStore((s) => s.recordDetailRequest);
  const clearRecordDetailRequest = useUIStore((s) => s.clearRecordDetailRequest);

  useEffect(() => {
    if (!recordDetailRequest || recordDetailRequest.kind !== 'expense') return;
    const row = records.find((r) => r.id === recordDetailRequest.id);
    if (row) {
      setEditingExpenseId(row.id);
      setDialogOpen(true);
    }
    clearRecordDetailRequest();
  }, [recordDetailRequest, records, clearRecordDetailRequest]);

  const editExpense = useMemo(() => {
    if (!editingExpenseId) return null;
    return records.find((r: Expense) => r.id === editingExpenseId) ?? null;
  }, [records, editingExpenseId]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setFilters({ search: value }), 300);
  }, [setFilters]);

  const handleCategoryChange = useCallback((value: string) => {
    setFilters({ category: value ? (value as ExpenseCategory) : undefined });
  }, [setFilters]);

  const handleStatusChange = useCallback((value: string) => {
    setFilters({ status: value ? (value as ExpenseStatus) : undefined });
  }, [setFilters]);

  const handleDateFromChange = useCallback((value: string) => { setFilters({ dateFrom: value }); }, [setFilters]);
  const handleDateToChange = useCallback((value: string) => { setFilters({ dateTo: value }); }, [setFilters]);
  const handleAdd = useCallback(() => { setEditingExpenseId(null); setDialogOpen(true); }, []);

  const handleEdit = useCallback((expense: { id: string }) => {
    setEditingExpenseId(expense.id);
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingExpenseId(null);
  }, []);

  return (
    <div className="flex flex-col h-full bg-background min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-[var(--s-sm)] min-h-10 px-[var(--s-md)] py-[var(--s-xs)] bg-surface border-b border-border">
        <div className="flex items-center gap-[var(--s-sm)] flex-wrap min-w-0 flex-1">
          <input type="text" value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Tìm kiếm..." className="bg-input-bg border border-input-border rounded-field px-2 py-1 text-xs min-w-[160px] focus:outline-none focus:ring-2 focus:ring-input-focus-ring" aria-label="Tìm kiếm chi phí" />
          <Select value={filters.category || ''} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Danh mục" /></SelectTrigger>
            <SelectContent>{CATEGORY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          <DatePicker value={filters.dateFrom} onChange={handleDateFromChange} placeholder="Từ ngày" />
          <span className="text-xs text-text-muted shrink-0">→</span>
          <DatePicker value={filters.dateTo} onChange={handleDateToChange} placeholder="Đến ngày" />
          <Select value={filters.status || ''} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Trạng thái" /></SelectTrigger>
            <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button variant="default" size="sm" onClick={handleAdd}>
          <Plus /> Thêm chi phí
        </Button>
      </div>

      {/* Main content panel */}
      <Card className="flex-1 flex flex-col overflow-hidden min-h-0 border-none">
        <CardContent className="flex-1 p-0">
          {loading ? (
            <div className="flex flex-col gap-2 py-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center h-12 px-3 gap-3">
                  <Skeleton className="w-[40px] h-[18px]" />
                  <Skeleton className="w-[100px] h-[18px]" />
                  <Skeleton className="w-[130px] h-[18px]" />
                  <Skeleton className="w-[250px] h-[18px]" />
                  <Skeleton className="w-[120px] h-[18px]" />
                  <Skeleton className="w-[100px] h-[18px]" />
                  <Skeleton className="w-[120px] h-[18px]" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-12 text-text-muted">
              <Plus size={32} className="opacity-30" />
              <p className="text-sm font-medium">Không có chi phí nào</p>
              <p className="text-xs">{searchInput || filters.category || filters.status ? 'Không khớp với bộ lọc hiện tại.' : 'Nhấp "Thêm chi phí" để bắt đầu.'}</p>
              {!searchInput && !filters.category && !filters.status && (
                <Button variant="default" size="sm" onClick={handleAdd}><Plus /> Thêm chi phí</Button>
              )}
            </div>
          ) : (
            <ExpenseGrid expenses={filtered} onRowClick={() => {}} onEdit={handleEdit}
              onDelete={async (expense: Expense) => {
                await deleteExpenses([expense.id]);
                toast.success('Đã xóa chi phí');
              }}
              onStatusChange={async (id: string, status: ExpenseStatus) => {
                await updateExpense(id, { status });
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      {dialogOpen && <ExpenseDialog open={dialogOpen} onClose={handleCloseDialog} editExpense={editExpense} />}
    </div>
  );
}
