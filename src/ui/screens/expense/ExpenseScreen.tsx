/**
 * ExpenseScreen — Main expense management screen.
 * Data flow: IndexedDB → expenseService → Zustand store → UI
 */

import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Expense, ExpenseCategory, ExpenseStatus } from '@/models';
import { useExpenseStore } from '@/store/expenseStore';
import { getAllExpenses, createExpense, updateExpense, deleteExpenses } from '@/services/expenseService';
import { formatCurrency } from '@/utils/currency';
import { Toolbar } from '@components/Toolbar';
import { ActionBar } from '@components/ActionBar';
import { Button } from '@components/Button';
import { Dropdown, type DropdownOption } from '@components/Dropdown';
import { DatePicker } from '@components/DatePicker';
import { Panel } from '@components/Panel';
import { EmptyState } from '@components/EmptyState';
import { Skeleton } from '@components/Skeleton';
import { ExpenseGrid } from './ExpenseGrid';
import { ExpenseDialog } from './ExpenseDialog';

const CATEGORY_OPTIONS: DropdownOption[] = [
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

const STATUS_OPTIONS: DropdownOption[] = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'pending', label: 'Chờ thanh toán' },
  { value: 'paid', label: 'Đã thanh toán' },
  { value: 'cancelled', label: 'Đã hủy' },
];

export function ExpenseScreen() {
  const records = useExpenseStore((s) => s.records);
  const selectedIds = useExpenseStore((s) => s.selectedIds);
  const toggleSelect = useExpenseStore((s) => s.toggleSelect);
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
  const [toast, setToast] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load data from IndexedDB on mount
  useEffect(() => {
    getAllExpenses().then(() => setLoading(false));
  }, []);

  const selectedTotal = useMemo(() => {
    return selectedIds.size > 0
      ? filtered.filter((r: Expense) => selectedIds.has(r.id)).reduce((sum: number, r: Expense) => sum + r.amount, 0)
      : 0;
  }, [filtered, selectedIds]);

  const editExpense = useMemo(() => {
    if (!editingExpenseId) return null;
    return filtered.find((r: Expense) => r.id === editingExpenseId) ?? null;
  }, [filtered, editingExpenseId]);

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

  const handleDeleteSelected = useCallback(async () => {
    const ids = [...selectedIds];
    await deleteExpenses(ids);
    setToast(`Đã xóa ${ids.length} chi phí`);
    setTimeout(() => setToast(null), 3000);
  }, [selectedIds]);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingExpenseId(null);
  }, []);

  const handleSaveExpense = useCallback(async (data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => {
    await createExpense(data);
  }, []);

  const handleUpdateExpense = useCallback(async (id: string, patch: Partial<Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>>) => {
    await updateExpense(id, patch);
  }, []);

  return (
    <div className="flex flex-col h-full bg-background min-h-0">
      <Toolbar trailing={<Button variant="run" icon={Plus} onClick={handleAdd}>Thêm chi phí</Button>}>
        <div className="flex items-center gap-[var(--s-sm)] flex-wrap">
          <input type="text" value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Tìm kiếm..." className="bg-input-bg border border-input-border rounded-field px-2 py-1 text-xs min-w-[160px] focus:outline-none focus:ring-2 focus:ring-input-focus-ring" aria-label="Tìm kiếm chi phí" />
          <Dropdown options={CATEGORY_OPTIONS} value={filters.category || ''} onChange={handleCategoryChange} placeholder="Danh mục" />
          <DatePicker value={filters.dateFrom} onChange={handleDateFromChange} placeholder="Từ ngày" />
          <span className="text-xs text-text-muted shrink-0">→</span>
          <DatePicker value={filters.dateTo} onChange={handleDateToChange} placeholder="Đến ngày" />
          <Dropdown options={STATUS_OPTIONS} value={filters.status || ''} onChange={handleStatusChange} placeholder="Trạng thái" />
        </div>
      </Toolbar>

      <Panel className="flex-1 flex flex-col overflow-hidden min-h-0">
        {loading ? (
          <div className="flex flex-col gap-2 py-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center h-12 px-3 gap-3">
                <Skeleton variant="rect" width={40} height={18} />
                <Skeleton variant="rect" width={100} height={18} />
                <Skeleton variant="rect" width={130} height={18} />
                <Skeleton variant="rect" width={250} height={18} />
                <Skeleton variant="rect" width={120} height={18} />
                <Skeleton variant="rect" width={100} height={18} />
                <Skeleton variant="rect" width={120} height={18} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Plus} title="Không có chi phí nào" description={searchInput || filters.category || filters.status ? 'Không khớp với bộ lọc hiện tại.' : 'Nhấp "Thêm chi phí" để bắt đầu.'} action={!searchInput && !filters.category && !filters.status ? { label: 'Thêm chi phí', onClick: handleAdd } : undefined} />
        ) : (
          <ExpenseGrid expenses={filtered} selectedIds={selectedIds} onToggleSelect={toggleSelect} onEdit={handleEdit}
            onDelete={async (expense: Expense) => {
              await deleteExpenses([expense.id]);
              setToast('Đã xóa chi phí');
              setTimeout(() => setToast(null), 3000);
            }}
            onStatusChange={async (id: string, status: ExpenseStatus) => {
              await updateExpense(id, { status });
            }}
          />
        )}
      </Panel>

      {selectedIds.size > 0 && (
        <ActionBar selectedCount={selectedIds.size} totalCount={filtered.length} trailing={<div className="text-xs text-text-muted">Tổng: <span className="font-mono font-medium text-text-primary">{formatCurrency(selectedTotal)}</span></div>}>
          <Button variant="danger" icon={Trash2} onClick={handleDeleteSelected}>Xóa ({selectedIds.size})</Button>
        </ActionBar>
      )}

      {dialogOpen && <ExpenseDialog open={dialogOpen} onClose={handleCloseDialog} editExpense={editExpense} />}
      {toast && <div role="status" aria-live="polite" className="fixed top-4 right-4 z-[1000] px-4 py-2 rounded-panel shadow-tooltip text-xs font-medium bg-success-bg text-success-fg">{toast}</div>}
    </div>
  );
}
