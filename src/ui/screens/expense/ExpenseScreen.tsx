/**
 * ExpenseScreen — Main expense management screen.
 * Data flow: IndexedDB → expenseService → Zustand store → UI
 */

import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import type { Expense, ExpenseCategory } from '@/models';
import { EXPENSE_CATEGORY_LABELS } from '@/models';
import { useExpenseStore } from '@/store/expenseStore';
import { useUIStore } from '@/store/uiStore';
import { getAllExpenses, deleteExpenses } from '@/services/expenseService';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/ui/components/DatePicker';
import { Dropdown, optionsFromLabels } from '@/ui/components/Dropdown';
import { ExpenseGrid } from './ExpenseGrid';
import { ExpenseDialog } from './ExpenseDialog';

const CATEGORY_OPTIONS = optionsFromLabels(EXPENSE_CATEGORY_LABELS, [
  { value: '', label: 'Tất cả danh mục' },
]);

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

  useEffect(() => {
    getAllExpenses().then(() => setLoading(false));
  }, []);

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

  const hasActiveFilters = Boolean(searchInput || filters.category || filters.dateFrom || filters.dateTo);

  return (
    <div className="flex flex-col h-full bg-background min-h-0">
      <div className="flex flex-wrap items-center gap-[var(--s-sm)] min-h-10 px-[var(--s-md)] py-[var(--s-xs)] bg-surface border-b border-border">
        <input type="text" value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Tìm kiếm..." className="bg-input-bg border border-input-border rounded-field px-2 py-1 text-xs min-w-[160px] focus:outline-none focus:ring-2 focus:ring-input-focus-ring" aria-label="Tìm kiếm chi phí" />
        <Dropdown
          options={CATEGORY_OPTIONS}
          value={filters.category || ''}
          onChange={handleCategoryChange}
          placeholder="Danh mục"
          clearable
          className="w-[180px] h-8"
          aria-label="Lọc danh mục"
        />
        <DatePicker value={filters.dateFrom} onChange={handleDateFromChange} placeholder="Từ ngày" className="w-[140px] h-8" />
        <span className="text-xs text-text-muted shrink-0">→</span>
        <DatePicker value={filters.dateTo} onChange={handleDateToChange} placeholder="Đến ngày" className="w-[140px] h-8" />
        <Button variant="default" size="sm" className="ml-auto" onClick={handleAdd}>
          <Plus /> Thêm chi phí
        </Button>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden min-h-0 border-none">
        <CardContent className="flex-1 p-0">
          {loading ? (
            <div className="flex flex-col gap-2 py-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center h-12 px-3 gap-3">
                  <Skeleton className="w-[120px] h-[18px]" />
                  <Skeleton className="w-[140px] h-[18px]" />
                  <Skeleton className="w-[250px] h-[18px]" />
                  <Skeleton className="w-[130px] h-[18px]" />
                  <Skeleton className="w-[140px] h-[18px]" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-12 text-text-muted">
              <Plus size={32} className="opacity-30" />
              <p className="text-sm font-medium">Không có chi phí nào</p>
              <p className="text-xs">{hasActiveFilters ? 'Không khớp với bộ lọc hiện tại.' : 'Nhấp "Thêm chi phí" để bắt đầu.'}</p>
              {!hasActiveFilters && (
                <Button variant="default" size="sm" onClick={handleAdd}><Plus /> Thêm chi phí</Button>
              )}
            </div>
          ) : (
            <ExpenseGrid
              expenses={filtered}
              onRowClick={() => {}}
              onEdit={handleEdit}
              onDelete={async (expense: Expense) => {
                await deleteExpenses([expense.id]);
              }}
            />
          )}
        </CardContent>
      </Card>

      {dialogOpen && <ExpenseDialog open={dialogOpen} onClose={handleCloseDialog} editExpense={editExpense} />}
    </div>
  );
}
