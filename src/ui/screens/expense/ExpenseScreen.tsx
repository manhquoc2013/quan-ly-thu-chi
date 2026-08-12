/**
 * ExpenseScreen — Main expense management screen.
 * List UI uses hybrid paged query (Supabase / IndexedDB); store stays for mutations & reports.
 */

import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import type { Expense, ExpenseCategory } from '@/models';
import { EXPENSE_CATEGORY_LABELS } from '@/models';
import { useExpenseStore } from '@/store/expenseStore';
import { useUIStore } from '@/store/uiStore';
import { useMascotStore } from '@/store/mascotStore';
import { getAllExpenses, deleteExpenses } from '@/services/expenseService';
import { notifyListInvalidated, queryExpensesPage } from '@/services/listQuery';
import { usePagedList } from '@/hooks/usePagedList';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/ui/components/DatePicker';
import { Dropdown, optionsFromLabels } from '@/ui/components/Dropdown';
import { ListLoadingOverlay } from '@/ui/components/ListLoadingOverlay';
import { PaginationBar } from '@/ui/components/PaginationBar';
import { ExpenseGrid } from './ExpenseGrid';
import { ExpenseDialog } from './ExpenseDialog';

const CATEGORY_OPTIONS = optionsFromLabels(EXPENSE_CATEGORY_LABELS, [
  { value: '', label: 'Tất cả danh mục' },
]);

export function ExpenseScreen() {
  const records = useExpenseStore((s) => s.records);
  const filters = useExpenseStore((s) => s.filters);
  const setFilters = useExpenseStore((s) => s.setFilters);

  const [searchInput, setSearchInput] = useState(filters.search);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [peekExpenseId, setPeekExpenseId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const listFilters = useMemo(
    () => ({
      search: filters.search,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      category: filters.category,
      status: filters.status,
    }),
    [filters],
  );

  const filterKey = useMemo(
    () =>
      JSON.stringify({
        s: filters.search,
        df: filters.dateFrom,
        dt: filters.dateTo,
        c: filters.category ?? '',
        st: filters.status ?? '',
      }),
    [filters],
  );

  const {
    items,
    total,
    page,
    pageSize,
    loading,
    error,
    setPage,
    setPageSize,
    refetch,
  } = usePagedList<Expense, typeof listFilters>({
    entity: 'expenses',
    filters: listFilters,
    filterKey,
    debounceMs: 0,
    fetchPage: ({ page: p, pageSize: ps, filters: f }) =>
      queryExpensesPage({ page: p, pageSize: ps }, f),
  });

  useEffect(() => {
    void getAllExpenses();
  }, []);

  const recordDetailRequest = useUIStore((s) => s.recordDetailRequest);
  const clearRecordDetailRequest = useUIStore((s) => s.clearRecordDetailRequest);

  useEffect(() => {
    if (!recordDetailRequest || recordDetailRequest.kind !== 'expense') return;
    const row = records.find((r) => r.id === recordDetailRequest.id);
    if (row) setPeekExpenseId(row.id);
    clearRecordDetailRequest();
  }, [recordDetailRequest, records, clearRecordDetailRequest]);

  const editExpense = useMemo(() => {
    if (!editingExpenseId) return null;
    return (
      items.find((r) => r.id === editingExpenseId) ??
      records.find((r: Expense) => r.id === editingExpenseId) ??
      null
    );
  }, [records, items, editingExpenseId]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => setFilters({ search: value }), 300);
    },
    [setFilters],
  );

  const handleCategoryChange = useCallback(
    (value: string) => {
      setFilters({ category: value ? (value as ExpenseCategory) : undefined });
    },
    [setFilters],
  );

  const handleDateFromChange = useCallback(
    (value: string) => {
      setFilters({ dateFrom: value });
    },
    [setFilters],
  );
  const handleDateToChange = useCallback(
    (value: string) => {
      setFilters({ dateTo: value });
    },
    [setFilters],
  );
  const handleAdd = useCallback(() => {
    setEditingExpenseId(null);
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((expense: { id: string }) => {
    setEditingExpenseId(expense.id);
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingExpenseId(null);
  }, []);

  const hasActiveFilters = Boolean(
    searchInput || filters.category || filters.dateFrom || filters.dateTo,
  );

  const showSkeleton = loading && items.length === 0;

  return (
    <div className="flex flex-col w-full min-w-0 bg-background">
      <div className="flex flex-wrap items-center gap-[var(--s-sm)] min-h-10 px-[var(--s-md)] py-[var(--s-xs)] bg-surface border-b border-border">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Tìm mô tả, NCC, tag..."
          className="bg-input-bg border border-input-border rounded-field px-2 py-1 text-xs flex-1 min-w-[140px] max-w-[300px] focus:outline-none focus:ring-2 focus:ring-input-focus-ring"
          aria-label="Tìm kiếm chi phí"
        />
        <Dropdown
          options={CATEGORY_OPTIONS}
          value={filters.category || ''}
          onChange={handleCategoryChange}
          placeholder="Danh mục"
          clearable
          className="w-[160px] h-8"
          aria-label="Lọc danh mục"
        />
        <span className="inline-flex items-center gap-1">
          <DatePicker
            value={filters.dateFrom}
            onChange={handleDateFromChange}
            placeholder="Từ ngày"
            className="w-[130px] h-8"
          />
          <span className="text-xs text-text-muted shrink-0 hidden sm:inline">→</span>
          <DatePicker
            value={filters.dateTo}
            onChange={handleDateToChange}
            placeholder="Đến ngày"
            className="w-[130px] h-8"
          />
        </span>
        <span className="text-xs text-text-muted tabular-nums">{total} mục</span>
        <Button variant="default" size="sm" className="md:ml-auto" onClick={handleAdd}>
          <Plus /> Thêm chi phí
        </Button>
      </div>

      <Card className="flex flex-col border-none gap-0 py-0 shadow-none min-w-0">
        <CardContent className="flex flex-col p-0">
          {showSkeleton ? (
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
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-text-muted">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Thử lại
              </Button>
            </div>
          ) : total === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-text-muted">
              <Plus size={32} className="opacity-30" />
              <p className="text-sm font-medium">Không có chi phí nào</p>
              <p className="text-xs">
                {hasActiveFilters
                  ? 'Không khớp với bộ lọc hiện tại.'
                  : 'Nhấp "Thêm chi phí" để bắt đầu.'}
              </p>
              {!hasActiveFilters && (
                <Button variant="default" size="sm" onClick={handleAdd}>
                  <Plus /> Thêm chi phí
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="relative">
                <ListLoadingOverlay show={loading} />
                <ExpenseGrid
                  expenses={items}
                  onEdit={handleEdit}
                  onDelete={async (expense: Expense) => {
                    await deleteExpenses([expense.id]);
                    notifyListInvalidated('expenses');
                    useMascotStore.getState().speak('Đã xóa một khoản chi 🗑️', 'sad');
                  }}
                  onBulkDelete={async (ids: string[]) => {
                    await deleteExpenses(ids);
                    notifyListInvalidated('expenses');
                    useMascotStore.getState().speak(`Đã xóa ${ids.length} khoản chi 🧹`, 'warning');
                  }}
                  peekExpenseId={peekExpenseId}
                  onPeekConsumed={() => setPeekExpenseId(null)}
                />
              </div>
              <PaginationBar
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                disabled={loading}
              />
            </>
          )}
        </CardContent>
      </Card>

      {dialogOpen && (
        <ExpenseDialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          editExpense={editExpense}
          onSuccess={(isEdit) => {
            notifyListInvalidated('expenses');
            useMascotStore
              .getState()
              .speak(
                isEdit ? 'Đã cập nhật chi phí ✏️' : 'Đã thêm chi phí mới! 💸',
                isEdit ? 'idle' : 'happy',
              );
          }}
        />
      )}
    </div>
  );
}
