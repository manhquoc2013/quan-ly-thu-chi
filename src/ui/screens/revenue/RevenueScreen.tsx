/**
 * RevenueScreen — Main order management screen.
 *
 * Composes: Toolbar (search, date filter, status filter, "Tạo đơn hàng" button),
 * and RevenueGrid (pure display). Row click opens a detail Dialog with OrderRowCard.
 * Integrates useRevenueStore for filtering and sorting.
 *
 * Uses: RevenueGrid, OrderDialog, OrderRowCard, useRevenueStore.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import type { Revenue, OrderStatus } from '@/models';
import { useRevenueStore } from '@/store/revenueStore';
import { useUIStore } from '@/store/uiStore';
import { getAllRevenues } from '@/services/revenueService';
import { getAllCustomers } from '@/services/customerService';
import { formatCurrency } from '@/utils/currency';
import { Plus } from 'lucide-react';
import { RevenueGrid } from './RevenueGrid';
import { OrderDialog } from './OrderDialog';
import { OrderRowCard } from './OrderRowCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DatePicker } from '@/ui/components/DatePicker';

/* ─── Status filter options ─────────────────────────────────────────────── */

const STATUS_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
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

  const setFilters = useRevenueStore((s) => s.setFilters);
  const deleteRecords = useRevenueStore((s) => s.deleteRecords);

  const filteredRecords = useMemo(() => {
    let r = [...records];
    if (filters.search) { const q = filters.search.toLowerCase(); r = r.filter(x => x.orderCode.toLowerCase().includes(q) || (x.notes?.toLowerCase().includes(q) ?? false)); }
    if (filters.dateFrom) r = r.filter(x => x.date >= filters.dateFrom);
    if (filters.dateTo) r = r.filter(x => x.date <= filters.dateTo);
    if (filters.orderStatus) r = r.filter(x => x.orderStatus === filters.orderStatus);
    return r;
  }, [records, filters]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRevenue, setEditingRevenue] = useState<Revenue | null>(null);
  const [detailRevenue, setDetailRevenue] = useState<Revenue | null>(null);

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
    setDetailRevenue(row);
  }, []);

  const handleEdit = useCallback((row: Revenue) => {
    setEditingRevenue(row);
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback(
    (row: Revenue) => {
      deleteRecords([row.id]);
      setDetailRevenue((prev) => (prev?.id === row.id ? null : prev));
    },
    [deleteRecords],
  );

  /* ── Load data from IndexedDB on mount ────────────────────────────── */
  useEffect(() => {
    getAllRevenues();
    getAllCustomers();
  }, []);

  /* ── Open detail when AI chat requests it ─────────────────────────── */
  const recordDetailRequest = useUIStore((s) => s.recordDetailRequest);
  const clearRecordDetailRequest = useUIStore((s) => s.clearRecordDetailRequest);

  useEffect(() => {
    if (!recordDetailRequest || recordDetailRequest.kind !== 'revenue') return;
    const row = records.find((r) => r.id === recordDetailRequest.id);
    if (row) setDetailRevenue(row);
    clearRecordDetailRequest();
  }, [recordDetailRequest, records, clearRecordDetailRequest]);

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

      <div className="flex items-center gap-[var(--s-sm)] p-[var(--s-md)] border-b border-border bg-surface">
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
        <Select value={(filters.orderStatus ?? '') as string} onValueChange={handleStatusFilter}>
          <SelectTrigger className="w-[140px] h-7 text-xs"><SelectValue placeholder="Trạng thái" /></SelectTrigger>
          <SelectContent>{STATUS_FILTER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>

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

        {/* Trailing info */}
        <div className="flex items-center gap-[var(--s-sm)] ml-auto">
          <div className="text-xs text-text-muted">
            <span className="font-semibold text-text-primary">
              {formatCurrency(filteredRecords.reduce((s, r) => s + r.finalAmount, 0))}
            </span>
            {' '}• {filteredRecords.length} đơn
          </div>
          <Button variant="default" size="sm" onClick={handleCreateClick}>
            <Plus size={14} /> Tạo đơn hàng
          </Button>
        </div>
      </div>

      {/* ── Main grid panel ──────────────────────────────────────────── */}

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <Card className="flex-1 overflow-hidden">
          <RevenueGrid
            records={filteredRecords}
            onRowClick={handleRowClick}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </Card>
      </div>

      {/* ── Revenue detail Dialog ─────────────────────────────────────── */}

      <Dialog open={detailRevenue !== null} onOpenChange={(v) => !v && setDetailRevenue(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailRevenue?.orderCode}</DialogTitle>
            <DialogDescription>{detailRevenue?.date}</DialogDescription>
          </DialogHeader>
          {detailRevenue && <OrderRowCard row={detailRevenue} />}
        </DialogContent>
      </Dialog>

      {/* ── Add/Edit Order Dialog ────────────────────────────────────── */}

      <OrderDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        editRevenue={editingRevenue}
      />
    </div>
  );
}
