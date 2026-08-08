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
import type { Revenue, OrderStatus, PaymentStatus } from '@/models';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/models';
import { useRevenueStore } from '@/store/revenueStore';
import { useUIStore } from '@/store/uiStore';
import { getAllRevenues, deleteRevenues, updateRevenue } from '@/services/revenueService';
import { getAllCustomers } from '@/services/customerService';
import { formatCurrency } from '@/utils/currency';
import { sumPaidRevenue } from '@/utils/revenueMetrics';
import { Plus } from 'lucide-react';
import { RevenueGrid } from './RevenueGrid';
import { OrderDialog } from './OrderDialog';
import { OrderRowCard } from './OrderRowCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DatePicker } from '@/ui/components/DatePicker';
import { Dropdown, optionsFromLabels } from '@/ui/components/Dropdown';

const STATUS_FILTER_OPTIONS = optionsFromLabels(ORDER_STATUS_LABELS, [
  { value: '', label: 'Tất cả trạng thái' },
]);

const PAYMENT_FILTER_OPTIONS = optionsFromLabels(PAYMENT_STATUS_LABELS, [
  { value: '', label: 'Tất cả thanh toán' },
]);

/* ─── Screen ────────────────────────────────────────────────────────────── */

export function RevenueScreen() {
  const records = useRevenueStore((s) => s.records);
  const filters = useRevenueStore((s) => s.filters);

  const setFilters = useRevenueStore((s) => s.setFilters);

  const filteredRecords = useMemo(() => {
    let r = [...records];
    if (filters.search) {
      const q = filters.search.toLowerCase();
      r = r.filter(
        (x) =>
          x.orderCode.toLowerCase().includes(q) ||
          (x.notes?.toLowerCase().includes(q) ?? false),
      );
    }
    if (filters.dateFrom) r = r.filter((x) => x.date >= filters.dateFrom);
    if (filters.dateTo) r = r.filter((x) => x.date <= filters.dateTo);
    if (filters.orderStatus) r = r.filter((x) => x.orderStatus === filters.orderStatus);
    if (filters.paymentStatus) r = r.filter((x) => x.paymentStatus === filters.paymentStatus);
    return r;
  }, [records, filters]);

  const paidTotal = useMemo(() => sumPaidRevenue(filteredRecords), [filteredRecords]);
  const unpaidCount = useMemo(
    () => filteredRecords.filter((r) => r.paymentStatus === 'unpaid' && r.orderStatus !== 'cancelled').length,
    [filteredRecords],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRevenue, setEditingRevenue] = useState<Revenue | null>(null);
  const [detailRevenueId, setDetailRevenueId] = useState<string | null>(null);

  const detailRevenue = useMemo(
    () => (detailRevenueId ? records.find((r) => r.id === detailRevenueId) ?? null : null),
    [records, detailRevenueId],
  );

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

  const handlePaymentFilter = useCallback(
    (value: string) =>
      setFilters({ paymentStatus: (value as PaymentStatus | '') || undefined }),
    [setFilters],
  );

  /* ── Row actions ─────────────────────────────────────────────────────── */

  const handleRowClick = useCallback((row: Revenue) => {
    setDetailRevenueId(row.id);
  }, []);

  const handleEdit = useCallback((row: Revenue) => {
    setEditingRevenue(row);
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback(async (row: Revenue) => {
    await deleteRevenues([row.id]);
    setDetailRevenueId((prev) => (prev === row.id ? null : prev));
  }, []);

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
    if (records.some((r) => r.id === recordDetailRequest.id)) {
      setDetailRevenueId(recordDetailRequest.id);
    }
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

      <div className="flex flex-col gap-2 p-[var(--s-md)] border-b border-border bg-surface md:flex-row md:flex-wrap md:items-center">
        <input
          type="text"
          value={filters.search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Tìm theo mã đơn, ghi chú..."
          className={
            'h-8 px-3 text-xs w-full md:w-[220px] ' +
            'bg-input-bg ' +
            'border border-input-border rounded-field ' +
            'text-text-primary placeholder-input-placeholder ' +
            'focus:outline-none focus:ring-2 focus:ring-input-focus-ring ' +
            'transition-colors duration-[var(--d-fast)]'
          }
          aria-label="Tìm kiếm đơn hàng"
        />

        <div className="grid grid-cols-2 gap-2 w-full md:contents">
          <Dropdown
            options={STATUS_FILTER_OPTIONS}
            value={(filters.orderStatus ?? '') as string}
            onChange={handleStatusFilter}
            placeholder="Trạng thái"
            clearable
            className="w-full md:w-[160px] h-8"
            aria-label="Lọc trạng thái"
          />

          <Dropdown
            options={PAYMENT_FILTER_OPTIONS}
            value={(filters.paymentStatus ?? '') as string}
            onChange={handlePaymentFilter}
            placeholder="Thanh toán"
            clearable
            className="w-full md:w-[160px] h-8"
            aria-label="Lọc thanh toán"
          />

          <DatePicker
            value={filters.dateFrom}
            onChange={handleDateFrom}
            placeholder="Từ ngày"
            className="w-full md:w-[140px] h-8"
          />
          <DatePicker
            value={filters.dateTo}
            onChange={handleDateTo}
            placeholder="Đến ngày"
            className="w-full md:w-[140px] h-8"
          />
        </div>

        <Button
          variant="default"
          size="sm"
          className="w-full md:w-auto md:ml-auto"
          onClick={handleCreateClick}
        >
          <Plus size={14} /> Tạo đơn hàng
        </Button>
      </div>

      {/* ── Summary bar ─────────────────────────────────────────────────── */}

      <div className="flex flex-wrap items-center gap-2 px-[var(--s-md)] py-2 bg-surface/50 border-b border-border-subtle">
        <span className="text-xs text-text-muted">Doanh thu đã thu:</span>
        <span className="text-sm font-semibold text-text-primary">{formatCurrency(paidTotal)}</span>
        <span className="text-xs text-text-muted">·</span>
        <span className="text-xs text-text-muted">{filteredRecords.length} đơn</span>
        {unpaidCount > 0 && (
          <>
            <span className="text-xs text-text-muted">·</span>
            <span className="text-xs text-warning-fg font-medium">{unpaidCount} chưa thanh toán</span>
          </>
        )}
      </div>

      {/* ── Main grid panel ──────────────────────────────────────────── */}

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <Card className="flex-1 overflow-hidden border-0 md:border shadow-none md:shadow-sm rounded-none md:rounded-lg">
          <RevenueGrid
            records={filteredRecords}
            onRowClick={handleRowClick}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onBulkDelete={async (ids: string[]) => {
              await deleteRevenues(ids);
            }}
            onBulkStatusChange={async (ids: string[], status) => {
              for (const id of ids) {
                await updateRevenue(id, { orderStatus: status });
              }
            }}
          />
        </Card>
      </div>

      {/* ── Revenue detail Dialog ─────────────────────────────────────── */}

      <Dialog open={detailRevenue !== null} onOpenChange={(v) => !v && setDetailRevenueId(null)}>
        <DialogContent className="max-w-lg sm:max-w-xl max-h-[85vh] !flex !flex-col overflow-hidden p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border shrink-0">
            <DialogTitle className="font-mono tracking-tight">{detailRevenue?.orderCode}</DialogTitle>
            <DialogDescription>
              Ngày {detailRevenue?.date}
              {detailRevenue
                ? ` · ${detailRevenue.items.reduce((s, i) => s + i.quantity, 0)} sản phẩm`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
            {detailRevenue && <OrderRowCard row={detailRevenue} readOnly />}
          </div>
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
