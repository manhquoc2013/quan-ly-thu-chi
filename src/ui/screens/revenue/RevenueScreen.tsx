/**
 * RevenueScreen — Main order management screen.
 *
 * Composes: Toolbar (search, date filter, status filter, "Tạo đơn hàng" button),
 * RevenueGrid, and ActionBar (bulk actions + selected total).
 * Integrates useRevenueStore for filtering, sorting, and selection.
 *
 * Uses: RevenueGrid, OrderDialog, OrderRowCard, useRevenueStore.
 *
 * Note: The store API uses `filteredRecords`, `selectedRecords`, `setFilters`,
 * `deleteRecords`, `clearSelection`, `selectAll`. These are aliased to readable
 * names in the component.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import type { Revenue, OrderStatus } from '@/models';
import { useRevenueStore } from '@/store/revenueStore';
import { useCustomerStore } from '@/store/customerStore';
import { getAllRevenues } from '@/services/revenueService';
import { getAllCustomers } from '@/services/customerService';
import { formatCurrency } from '@/utils/currency';
import { RevenueGrid } from './RevenueGrid';
import { OrderDialog } from './OrderDialog';
import { OrderRowCard } from './OrderRowCard';
import { Toolbar } from '@ui/components/Toolbar';
import {
  Panel,
  Button,
  Badge,
  Dropdown,
  DatePicker,
  type DropdownOption,
} from '@ui/components';
import { ActionBar } from '@ui/components/ActionBar';
/* ─── Status filter options ─────────────────────────────────────────────── */

const STATUS_FILTER_OPTIONS: DropdownOption[] = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'new', label: 'Mới tạo' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'processing', label: 'Đang xử lý' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'cancelled', label: 'Đã hủy' },
];

/* ─── Screen ────────────────────────────────────────────────────────────── */

export function RevenueScreen() {
  const records = useRevenueStore((s) => s.records);
  const filters = useRevenueStore((s) => s.filters);
  const selectedIds = useRevenueStore((s) => s.selectedIds);

  const setFilters = useRevenueStore((s) => s.setFilters);
  const deleteRecords = useRevenueStore((s) => s.deleteRecords);
  const clearSelection = useRevenueStore((s) => s.clearSelection);
  const selectAll = useRevenueStore((s) => s.selectAll);

  const filteredRecords = useMemo(() => {
    let r = [...records];
    if (filters.search) { const q = filters.search.toLowerCase(); r = r.filter(x => x.orderCode.toLowerCase().includes(q) || (x.notes?.toLowerCase().includes(q) ?? false)); }
    if (filters.dateFrom) r = r.filter(x => x.date >= filters.dateFrom);
    if (filters.dateTo) r = r.filter(x => x.date <= filters.dateTo);
    if (filters.orderStatus) r = r.filter(x => x.orderStatus === filters.orderStatus);
    return r;
  }, [records, filters]);

  const selectedRecords = useMemo(() => records.filter(r => selectedIds.has(r.id)), [records, selectedIds]);

  const selectedTotal = useMemo(() => selectedRecords.reduce((sum, r) => sum + r.finalAmount, 0), [selectedRecords]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRevenue, setEditingRevenue] = useState<Revenue | null>(null);
  const [expandedRow, setExpandedRow] = useState<Revenue | null>(null);

  /* ── Filter change handlers ─────────────────────────────────────────── */

  const handleSearch = useCallback(
    (value: string) => setFilters({ search: value }),
    [setFilters],
  );

  const handleDateFrom = useCallback(
    (value: string) => setFilters({ dateFrom: value }),
    [setFilters],
  );

  const handleDateTo = useCallback(
    (value: string) => setFilters({ dateTo: value }),
    [setFilters],
  );

  const handleStatusFilter = useCallback(
    (value: string) =>
      setFilters({ orderStatus: (value as OrderStatus | '') || undefined }),
    [setFilters],
  );

  /* ── Row actions ─────────────────────────────────────────────────────── */

  const handleRowClick = useCallback((row: Revenue) => {
    setExpandedRow((prev) => (prev?.id === row.id ? null : row));
  }, []);

  const handleEdit = useCallback((row: Revenue) => {
    setEditingRevenue(row);
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback(
    (row: Revenue) => {
      deleteRecords([row.id]);
      if (expandedRow?.id === row.id) setExpandedRow(null);
    },
    [deleteRecords, expandedRow],
  );

  /* ── Bulk actions ────────────────────────────────────────────────────── */

  const handleDeleteSelected = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    deleteRecords(ids);
    clearSelection();
    setExpandedRow(null);
  }, [selectedIds, deleteRecords, clearSelection]);

  const handleClearSelection = useCallback(() => {
    clearSelection();
    setExpandedRow(null);
  }, [clearSelection]);

  const handleSelectAll = useCallback(() => {
    selectAll();
  }, [selectAll]);

  /* ── Load data from IndexedDB on mount ────────────────────────────── */
  useEffect(() => {
    getAllRevenues();
    getAllCustomers();
  }, []);

  /* ── Dialog lifecycle ────────────────────────────────────────────────── */

  const handleCreateClick = useCallback(() => {
    setEditingRevenue(null);
    setDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback(() => {
    setDialogOpen(false);
    setEditingRevenue(null);
  }, []);

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-full bg-background min-h-0">
      {/* ── Toolbar ──────────────────────────────────────────────────── */}

      <Toolbar
        trailing={
          <div className="flex items-center gap-[var(--s-sm)]">
            <div className="text-xs text-text-muted">
              <span className="font-semibold text-text-primary">
                {formatCurrency(filteredRecords.reduce((s, r) => s + r.finalAmount, 0))}
              </span>
              {' '}• {filteredRecords.length} đơn
            </div>
            <Button variant="run" onClick={handleCreateClick}>
              + Tạo đơn hàng
            </Button>
          </div>
        }
      >
        {/* Search */}
        <input
          type="text"
          value={filters.search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Tìm theo mã đơn, ghi chú..."
          className={
            'h-7 px-3 text-xs w-[220px] ' +
            'bg-input-bg ' +
            'border border-input-border rounded-field ' +
            'text-text-primary placeholder-input-placeholder ' +
            'focus:outline-none focus:ring-2 focus:ring-input-focus-ring ' +
            'transition-colors duration-[var(--d-fast)]'
          }
          aria-label="Tìm kiếm đơn hàng"
        />

        {/* Status filter */}
        <Dropdown
          options={STATUS_FILTER_OPTIONS}
          value={(filters.orderStatus ?? '') as string}
          onChange={handleStatusFilter}
        />

        {/* Date range */}
        <DatePicker
          value={filters.dateFrom}
          onChange={handleDateFrom}
          placeholder="Từ ngày"
        />
        <DatePicker
          value={filters.dateTo}
          onChange={handleDateTo}
          placeholder="Đến ngày"
        />
      </Toolbar>

      {/* ── Main grid panel ──────────────────────────────────────────── */}

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <Panel title="Quản lý đơn hàng" className="flex-1 overflow-hidden">
          <RevenueGrid
            onRowClick={handleRowClick}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </Panel>
      </div>

      {/* ── Expanded OrderRowCard ────────────────────────────────────── */}

      {expandedRow && (
        <div className="px-[var(--s-md)] pb-[var(--s-md)]">
          <OrderRowCard row={expandedRow} />
        </div>
      )}

      {/* ── ActionBar (bulk actions) ─────────────────────────────────── */}

      {selectedIds.size > 0 && (
        <ActionBar
          selectedCount={selectedIds.size}
          totalCount={filteredRecords.length}
          trailing={
            <Button variant="danger" onClick={handleDeleteSelected}>
              Xóa ({selectedIds.size}) — {formatCurrency(selectedTotal)}
            </Button>
          }
        >
          <Button variant="neutral" onClick={handleClearSelection}>
            Bỏ chọn
          </Button>
          <Button variant="accent" onClick={handleSelectAll}>
            Chọn tất cả
          </Button>
          <Badge variant="accent">
            {'Tổng: ' + formatCurrency(selectedTotal)}
          </Badge>
        </ActionBar>
      )}

      {/* ── Add/Edit Order Dialog ────────────────────────────────────── */}

      <OrderDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        editRevenue={editingRevenue}
      />
    </div>
  );
}

