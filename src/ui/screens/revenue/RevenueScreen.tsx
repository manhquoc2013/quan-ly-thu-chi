/**
 * RevenueScreen — Main order management screen.
 * List UI uses hybrid paged query; summary metrics use shared revenueFilters.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { Revenue, OrderStatus, PaymentStatus } from '@/models';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/models';
import { useCustomerStore } from '@/store/customerStore';
import { useRevenueStore } from '@/store/revenueStore';
import { useUIStore } from '@/store/uiStore';
import { useMascotStore } from '@/store/mascotStore';
import { CRUD_LINES } from '@/services/mascotLines';
import {
  getAllRevenues,
  deleteRevenues,
  updateRevenuesBatch,
} from '@/services/revenueService';
import { getAllCustomers } from '@/services/customerService';
import { notifyListInvalidated, queryRevenuesPage } from '@/services/listQuery';
import { filterRevenues } from '@/services/revenueFilters';
import { usePagedList } from '@/hooks/usePagedList';
import { formatCurrency } from '@/utils/currency';
import { sumPaidRevenue } from '@/utils/revenueMetrics';
import { Plus, Star } from 'lucide-react';
import { RevenueGrid } from './RevenueGrid';
import { OrderDialog } from './OrderDialog';
import { OrderRowCard } from './OrderRowCard';
import { OrderBillDialog } from './OrderBillDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/ui/components/DatePicker';
import { Dropdown, optionsFromLabels } from '@/ui/components/Dropdown';
import { ListLoadingOverlay } from '@/ui/components/ListLoadingOverlay';
import { PaginationBar } from '@/ui/components/PaginationBar';

const STATUS_FILTER_OPTIONS = optionsFromLabels(ORDER_STATUS_LABELS, [
  { value: '', label: 'Tất cả trạng thái' },
]);

const PAYMENT_FILTER_OPTIONS = optionsFromLabels(PAYMENT_STATUS_LABELS, [
  { value: '', label: 'Tất cả thanh toán' },
]);

export function RevenueScreen() {
  const records = useRevenueStore((s) => s.records);
  const customers = useCustomerStore((s) => s.customers);
  const filters = useRevenueStore((s) => s.filters);
  const setFilters = useRevenueStore((s) => s.setFilters);

  const [searchInput, setSearchInput] = useState(filters.search);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredForSummary = useMemo(
    () =>
      filterRevenues(
        records,
        {
          search: filters.search,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          orderStatus: filters.orderStatus,
          paymentStatus: filters.paymentStatus,
          customerId: filters.customerId,
          priorityOnly: filters.priorityOnly || undefined,
        },
        customers,
      ),
    [records, customers, filters],
  );

  const paidTotal = useMemo(() => sumPaidRevenue(filteredForSummary), [filteredForSummary]);
  const unpaidCount = useMemo(
    () =>
      filteredForSummary.filter(
        (r) => r.paymentStatus === 'unpaid' && r.orderStatus !== 'cancelled',
      ).length,
    [filteredForSummary],
  );

  const listFilters = useMemo(
    () => ({
      search: filters.search,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      orderStatus: filters.orderStatus,
      paymentStatus: filters.paymentStatus,
      customerId: filters.customerId,
      priorityOnly: filters.priorityOnly || undefined,
    }),
    [filters],
  );

  const filterKey = useMemo(
    () =>
      JSON.stringify({
        s: filters.search,
        df: filters.dateFrom,
        dt: filters.dateTo,
        os: filters.orderStatus ?? '',
        ps: filters.paymentStatus ?? '',
        c: filters.customerId ?? '',
        pr: filters.priorityOnly ? 1 : 0,
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
  } = usePagedList<Revenue, typeof listFilters>({
    entity: 'revenues',
    filters: listFilters,
    filterKey,
    debounceMs: 0,
    fetchPage: ({ page: p, pageSize: ps, filters: f }) =>
      queryRevenuesPage({ page: p, pageSize: ps }, f),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRevenue, setEditingRevenue] = useState<Revenue | null>(null);
  const [detailRevenueId, setDetailRevenueId] = useState<string | null>(null);
  const [billRevenue, setBillRevenue] = useState<Revenue | null>(null);

  const detailRevenue = useMemo(() => {
    if (!detailRevenueId) return null;
    return (
      items.find((r) => r.id === detailRevenueId) ??
      records.find((r) => r.id === detailRevenueId) ??
      null
    );
  }, [records, items, detailRevenueId]);

  const hasActiveFilters = !!(
    searchInput ||
    filters.search ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.orderStatus ||
    filters.paymentStatus ||
    filters.priorityOnly ||
    filters.customerId
  );

  const handleSearch = useCallback(
    (value: string) => {
      setSearchInput(value);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => setFilters({ search: value }), 300);
    },
    [setFilters],
  );

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchInput('');
    setFilters({
      search: '',
      dateFrom: '',
      dateTo: '',
      orderStatus: undefined,
      paymentStatus: undefined,
      customerId: undefined,
      priorityOnly: false,
    });
  }, [setFilters]);

  const handleDateFrom = useCallback(
    (value: string) => setFilters({ dateFrom: value }),
    [setFilters],
  );
  const handleDateTo = useCallback(
    (value: string) => setFilters({ dateTo: value }),
    [setFilters],
  );
  const handleStatusFilter = useCallback(
    (value: string) => setFilters({ orderStatus: (value as OrderStatus | '') || undefined }),
    [setFilters],
  );
  const handlePaymentFilter = useCallback(
    (value: string) => setFilters({ paymentStatus: (value as PaymentStatus | '') || undefined }),
    [setFilters],
  );

  const handleRowClick = useCallback((row: Revenue) => {
    setDetailRevenueId(row.id);
  }, []);

  const handleEdit = useCallback((row: Revenue) => {
    setEditingRevenue(row);
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback(async (row: Revenue) => {
    await deleteRevenues([row.id]);
    notifyListInvalidated('revenues');
    useMascotStore.getState().speak(CRUD_LINES.orderDeleted, 'sad');
    setDetailRevenueId((prev) => (prev === row.id ? null : prev));
  }, []);

  useEffect(() => {
    getAllRevenues();
    getAllCustomers();
  }, []);

  const recordDetailRequest = useUIStore((s) => s.recordDetailRequest);
  const clearRecordDetailRequest = useUIStore((s) => s.clearRecordDetailRequest);

  useEffect(() => {
    if (!recordDetailRequest || recordDetailRequest.kind !== 'revenue') return;
    const id = recordDetailRequest.id;
    const found =
      records.some((r) => r.id === id) || items.some((r) => r.id === id);
    if (found) {
      setDetailRevenueId(id);
      clearRecordDetailRequest();
      return;
    }
    // Keep request until data arrives; give up after ~8s so it cannot stick forever.
    const t = window.setTimeout(() => {
      const still = useUIStore.getState().recordDetailRequest;
      if (still?.kind === 'revenue' && still.id === id) {
        clearRecordDetailRequest();
      }
    }, 8_000);
    return () => window.clearTimeout(t);
  }, [recordDetailRequest, records, items, clearRecordDetailRequest]);

  const handleCreateClick = useCallback(() => {
    setEditingRevenue(null);
    setDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback(() => {
    setDialogOpen(false);
    setEditingRevenue(null);
  }, []);

  return (
    <div className="flex flex-col bg-background w-full min-w-0 max-w-full overflow-x-clip">
      <div className="flex flex-wrap items-center gap-[var(--s-sm)] p-[var(--s-md)] border-b border-border bg-surface min-w-0">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Tìm theo mã đơn, tên khách, ghi chú..."
          className={
            'h-8 px-3 text-xs flex-1 min-w-[160px] max-w-[280px] ' +
            'bg-input-bg ' +
            'border border-input-border rounded-field ' +
            'text-text-primary placeholder-input-placeholder ' +
            'focus:outline-none focus:ring-2 focus:ring-input-focus-ring ' +
            'transition-colors duration-[var(--d-fast)]'
          }
          aria-label="Tìm kiếm đơn hàng"
        />

        <Dropdown
          options={STATUS_FILTER_OPTIONS}
          value={(filters.orderStatus ?? '') as string}
          onChange={handleStatusFilter}
          placeholder="Trạng thái"
          clearable
          className="w-[150px] h-8"
          aria-label="Lọc trạng thái"
        />

        <Dropdown
          options={PAYMENT_FILTER_OPTIONS}
          value={(filters.paymentStatus ?? '') as string}
          onChange={handlePaymentFilter}
          placeholder="Thanh toán"
          clearable
          className="w-[150px] h-8"
          aria-label="Lọc thanh toán"
        />

        <Button
          variant={filters.priorityOnly ? 'default' : 'outline'}
          size="sm"
          className="h-8 gap-1"
          onClick={() => setFilters({ priorityOnly: !filters.priorityOnly })}
          aria-pressed={!!filters.priorityOnly}
        >
          <Star size={14} fill={filters.priorityOnly ? 'currentColor' : 'none'} />
          Ưu tiên
        </Button>

        <span className="inline-flex items-center gap-1">
          <DatePicker
            value={filters.dateFrom}
            onChange={handleDateFrom}
            placeholder="Từ ngày"
            className="w-[130px] h-8"
          />
          <span className="text-xs text-text-muted shrink-0 hidden sm:inline">→</span>
          <DatePicker
            value={filters.dateTo}
            onChange={handleDateTo}
            placeholder="Đến ngày"
            className="w-[130px] h-8"
          />
        </span>

        <Button variant="default" size="sm" className="md:ml-auto" onClick={handleCreateClick}>
          <Plus size={14} /> Thêm đơn hàng
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-[var(--s-md)] py-2 bg-surface/50 border-b border-border-subtle">
        <span className="text-xs text-text-muted">Doanh thu đã thu:</span>
        <span className="text-sm font-semibold text-text-primary">{formatCurrency(paidTotal)}</span>
        <span className="text-xs text-text-muted">·</span>
        <span className="text-xs text-text-muted">{total} đơn</span>
        {unpaidCount > 0 && (
          <>
            <span className="text-xs text-text-muted">·</span>
            <span className="text-xs text-warning-fg font-medium">{unpaidCount} chưa thanh toán</span>
          </>
        )}
      </div>

      <Card className="flex flex-col gap-0 py-0 border-0 md:border shadow-none md:shadow-sm rounded-none md:rounded-lg min-w-0">
        {error ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-text-muted">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Thử lại
            </Button>
          </div>
        ) : loading && items.length === 0 ? (
          <div className="flex flex-col gap-2 py-4 px-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : total === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-text-muted">
            <Plus size={32} className="opacity-30" />
            <p className="text-sm font-medium">
              {hasActiveFilters ? 'Không khớp bộ lọc' : 'Chưa có đơn hàng'}
            </p>
            <p className="text-xs">
              {hasActiveFilters
                ? 'Thử xóa bộ lọc hoặc đổi từ khóa tìm kiếm.'
                : 'Nhấp "Thêm đơn hàng" để bắt đầu.'}
            </p>
            {hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                Xóa bộ lọc
              </Button>
            ) : (
              <Button variant="default" size="sm" onClick={handleCreateClick}>
                <Plus size={14} /> Thêm đơn hàng
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="relative">
              <ListLoadingOverlay show={loading} />
              <RevenueGrid
                records={items}
                onRowClick={handleRowClick}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onPrint={(row) => setBillRevenue(row)}
                onBulkDelete={async (ids: string[]) => {
                  await deleteRevenues(ids);
                  notifyListInvalidated('revenues');
                  useMascotStore.getState().speak(CRUD_LINES.ordersDeleted(ids.length), 'warning');
                }}
                onBulkStatusChange={async (ids: string[], status) => {
                  await updateRevenuesBatch(ids, { orderStatus: status });
                  const label = ORDER_STATUS_LABELS[status] ?? status;
                  useMascotStore
                    .getState()
                    .speak(CRUD_LINES.ordersStatus(ids.length, label), 'happy');
                }}
                onPriorityChange={() => {
                  notifyListInvalidated('revenues');
                  void refetch();
                }}
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
      </Card>

      <Dialog open={detailRevenue !== null} onOpenChange={(v) => !v && setDetailRevenueId(null)}>
        <DialogContent className="max-w-lg sm:max-w-xl max-h-[85vh] !flex !flex-col overflow-hidden p-0 gap-0 h-auto">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border shrink-0">
            <DialogTitle className="font-mono tracking-tight flex items-center gap-2 flex-wrap">
              {detailRevenue?.orderCode}
              {detailRevenue?.priority ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-warning-bg text-warning-fg text-[10px] font-sans font-semibold px-1.5 py-0.5">
                  <Star size={10} fill="currentColor" />
                  Ưu tiên
                </span>
              ) : null}
            </DialogTitle>
            <DialogDescription>
              Ngày {detailRevenue?.date}
              {detailRevenue
                ? ` · ${detailRevenue.items.reduce((s, i) => s + i.quantity, 0)} sản phẩm`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto px-6 py-4 max-h-[calc(85vh-8rem)]">
            {detailRevenue && (
              <OrderRowCard
                row={detailRevenue}
                readOnly
                onPrint={() => {
                  setBillRevenue(detailRevenue);
                  setDetailRevenueId(null);
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <OrderDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        editRevenue={editingRevenue}
        onSuccess={(isEdit) => {
          notifyListInvalidated('revenues');
          useMascotStore
            .getState()
            .speak(
              isEdit ? CRUD_LINES.orderUpdated : CRUD_LINES.orderCreated,
              isEdit ? 'idle' : 'celebrate',
            );
        }}
      />

      <OrderBillDialog
        open={billRevenue !== null}
        revenue={billRevenue}
        onClose={() => setBillRevenue(null)}
      />
    </div>
  );
}
