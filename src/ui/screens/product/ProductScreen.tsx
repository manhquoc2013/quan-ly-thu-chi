/**
 * ProductScreen — Manage product catalog (CRUD).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import type { Product } from '@/models';
import { useProductStore } from '@/store/productStore';
import { useRevenueStore } from '@/store/revenueStore';
import { useUIStore } from '@/store/uiStore';
import { getAllProducts, deleteProduct, generateSkusForProducts } from '@/services/productService';
import { notifyListInvalidated, queryProductsPage } from '@/services/listQuery';
import { usePagedList } from '@/hooks/usePagedList';
import { formatCurrency } from '@/utils/currency';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ProductDialog } from './ProductDialog';
import { LIST_ROW_ANIM, listRowStyle } from '@/ui/components/listRowAnim';
import { DetailField, EntityDetailDialog } from '@/ui/components/EntityDetailDialog';
import { ListLoadingOverlay } from '@/ui/components/ListLoadingOverlay';
import { PaginationBar } from '@/ui/components/PaginationBar';
import { formatDate } from '@/utils/date';

export function ProductScreen() {
  const products = useProductStore((s) => s.products);
  const searchQuery = useProductStore((s) => s.searchQuery);
  const setSearchQuery = useProductStore((s) => s.setSearchQuery);
  const revenues = useRevenueStore((s) => s.records);

  const [bootstrapping, setBootstrapping] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const listFilters = useMemo(() => ({ search: searchQuery }), [searchQuery]);
  const filterKey = useMemo(() => searchQuery.trim(), [searchQuery]);

  const {
    items,
    total,
    page,
    pageSize,
    loading,
    setPage,
    setPageSize,
    refetch,
  } = usePagedList<Product, typeof listFilters>({
    entity: 'products',
    filters: listFilters,
    filterKey,
    fetchPage: ({ page: p, pageSize: ps, filters: f }) =>
      queryProductsPage({ page: p, pageSize: ps }, f),
  });

  useEffect(() => {
    getAllProducts().finally(() => setBootstrapping(false));
  }, []);

  const recordDetailRequest = useUIStore((s) => s.recordDetailRequest);
  const clearRecordDetailRequest = useUIStore((s) => s.clearRecordDetailRequest);

  useEffect(() => {
    if (!recordDetailRequest || recordDetailRequest.kind !== 'product') return;
    const row =
      products.find((p) => p.id === recordDetailRequest.id) ??
      items.find((p) => p.id === recordDetailRequest.id);
    if (row) setDetailProduct(row);
    clearRecordDetailRequest();
  }, [recordDetailRequest, products, items, clearRecordDetailRequest]);

  const usageCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of revenues) {
      for (const it of r.items) {
        if (!it.productId) continue;
        map.set(it.productId, (map.get(it.productId) ?? 0) + 1);
      }
    }
    return map;
  }, [revenues]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteProduct(deleteTarget.id);
      notifyListInvalidated('products');
    } catch {
      // toasted
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget]);

  const [skuBusy, setSkuBusy] = useState(false);

  const missingSkuCount = useMemo(
    () => products.filter((p) => !p.sku?.trim()).length,
    [products],
  );

  const handleGenerateSkus = useCallback(async () => {
    if (skuBusy) return;
    setSkuBusy(true);
    try {
      const { updated, skipped } = await generateSkusForProducts({ onlyMissing: true });
      notifyListInvalidated('products');
      if (updated.length === 0) {
        toast.message('Tất cả sản phẩm đã có mã SKU');
      } else {
        toast.success(`Đã gán ${updated.length} SKU` + (skipped ? ` · bỏ qua ${skipped}` : ''));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không gán được SKU');
    } finally {
      setSkuBusy(false);
    }
  }, [skuBusy]);

  const showSkeleton = loading && items.length === 0;

  return (
    <div className="flex flex-col h-full bg-background min-h-0">
      <div className="flex flex-wrap items-center gap-[var(--s-sm)] min-h-10 px-[var(--s-md)] py-[var(--s-xs)] bg-surface border-b border-border">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm tên, SKU..."
          className="bg-input-bg border border-input-border rounded-field px-2 py-1 text-xs min-w-[180px] focus:outline-none focus:ring-2 focus:ring-input-focus-ring"
          aria-label="Tìm sản phẩm"
        />
        <span className="text-xs text-text-muted">{total} SP</span>
        {missingSkuCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            disabled={skuBusy}
            onClick={() => void handleGenerateSkus()}
            title="Gán mã SKU cho sản phẩm còn thiếu"
          >
            <Tag /> {skuBusy ? 'Đang gán…' : `Gán SKU thiếu (${missingSkuCount})`}
          </Button>
        )}
        <Button
          variant="default"
          size="sm"
          className="ml-auto"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus /> Thêm sản phẩm
        </Button>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden min-h-0 border-none gap-0 py-0">
        <CardContent className="flex-1 flex flex-col min-h-0 p-0">
          {showSkeleton ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : total === 0 && !loading ? (
            <p className="text-xs text-text-muted py-16 text-center">
              {searchQuery
                ? 'Không tìm thấy sản phẩm'
                : 'Chưa có sản phẩm — thêm mới hoặc để AI tự tạo khi bán'}
            </p>
          ) : (
            <>
              <div className="flex-1 min-h-0 relative">
              <ListLoadingOverlay show={loading} />
              <ul className="h-full overflow-y-auto divide-y divide-border-subtle">
              {items.map((p, index) => {
                const used = usageCount.get(p.id) ?? 0;
                return (
                  <li
                    key={p.id}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-surface-hover transition-colors cursor-pointer ${LIST_ROW_ANIM}`}
                    style={listRowStyle(index)}
                    onClick={() => setDetailProduct(p)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDetailProduct(p);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-text-primary">{p.name}</p>
                        {p.sku ? (
                          <Badge variant="outline" className="text-[10px] font-mono">
                            <Tag size={10} className="mr-0.5" />
                            {p.sku}
                          </Badge>
                        ) : null}
                        {used > 0 ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {used} dòng đơn
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-text-muted">
                        Tồn:{' '}
                        <span
                          className={
                            (p.stockQty ?? 0) < 0
                              ? 'text-danger-fg font-medium'
                              : (p.stockQty ?? 0) === 0
                                ? 'text-text-muted'
                                : 'text-text-primary font-medium'
                          }
                        >
                          {p.stockQty ?? 0} {p.unit}
                        </span>
                        {' · '}
                        Gợi ý: {formatCurrency(p.defaultUnitPrice)} / {p.unit}
                        {p.notes ? ` · ${p.notes}` : ''}
                      </p>
                    </div>
                    <div
                      className="flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Sửa ${p.name}`}
                        onClick={() => {
                          setEditing(p);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-danger-fg"
                        aria-label={`Xóa ${p.name}`}
                        onClick={() => setDeleteTarget(p)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </li>
                );
              })}
              </ul>
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

      <ProductDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
          notifyListInvalidated('products');
          refetch();
        }}
        editProduct={editing}
      />

      <EntityDetailDialog
        open={detailProduct !== null}
        onOpenChange={(o) => !o && setDetailProduct(null)}
        title={detailProduct?.name ?? 'Sản phẩm'}
        description={
          detailProduct?.createdAt
            ? `Tạo ${formatDate(detailProduct.createdAt.slice(0, 10))}`
            : undefined
        }
      >
        {detailProduct ? (
          <div className="grid grid-cols-2 gap-4">
            <DetailField label="SKU">
              {detailProduct.sku ? (
                <span className="font-mono">{detailProduct.sku}</span>
              ) : (
                <span className="text-text-muted">—</span>
              )}
            </DetailField>
            <DetailField label="Đơn vị">{detailProduct.unit}</DetailField>
            <DetailField label="Tồn kho">
              <span
                className={
                  (detailProduct.stockQty ?? 0) < 0 ? 'text-danger-fg font-medium' : 'font-medium'
                }
              >
                {detailProduct.stockQty ?? 0} {detailProduct.unit}
              </span>
            </DetailField>
            <DetailField label="Giá gợi ý">
              <span className="font-mono">{formatCurrency(detailProduct.defaultUnitPrice)}</span>
            </DetailField>
            <DetailField label="Dùng trên đơn" className="col-span-2">
              {usageCount.get(detailProduct.id) ?? 0} dòng
            </DetailField>
            {detailProduct.notes ? (
              <DetailField label="Ghi chú" className="col-span-2">
                <p className="text-text-muted">{detailProduct.notes}</p>
              </DetailField>
            ) : null}
          </div>
        ) : null}
      </EntityDetailDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa sản phẩm?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (usageCount.get(deleteTarget.id) ?? 0) > 0
                ? `“${deleteTarget.name}” còn gắn đơn — không thể xóa.`
                : `Xóa “${deleteTarget?.name ?? ''}”?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            {(usageCount.get(deleteTarget?.id ?? '') ?? 0) === 0 ? (
              <AlertDialogAction onClick={handleConfirmDelete}>Xóa</AlertDialogAction>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
