/**
 * PlatformScreen — CRUD order platforms / channels.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { OrderPlatform } from '@/models';
import { PLATFORM_DIRECT_ID } from '@/models';
import { usePlatformStore } from '@/store/platformStore';
import { useRevenueStore } from '@/store/revenueStore';
import { getAllPlatforms, deletePlatform } from '@/services/platformService';
import { notifyListInvalidated, queryPlatformsPage } from '@/services/listQuery';
import { buildOrderCountByPlatform } from '@/services/usageMaps';
import { usePagedList } from '@/hooks/usePagedList';
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
import { PlatformDialog } from './PlatformDialog';
import { DetailField, EntityDetailDialog } from '@/ui/components/EntityDetailDialog';
import { ListLoadingOverlay } from '@/ui/components/ListLoadingOverlay';
import { PaginationBar } from '@/ui/components/PaginationBar';
import { LIST_ROW_ANIM, listRowStyle } from '@/ui/components/listRowAnim';
import { formatDate } from '@/utils/date';

export function PlatformScreen() {
  const searchQuery = usePlatformStore((s) => s.searchQuery);
  const setSearchQuery = usePlatformStore((s) => s.setSearchQuery);
  const revenues = useRevenueStore((s) => s.records);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OrderPlatform | null>(null);
  const [detailPlatform, setDetailPlatform] = useState<OrderPlatform | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrderPlatform | null>(null);

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
  } = usePagedList<OrderPlatform, typeof listFilters>({
    entity: 'platforms',
    filters: listFilters,
    filterKey,
    fetchPage: ({ page: p, pageSize: ps, filters: f }) =>
      queryPlatformsPage({ page: p, pageSize: ps }, f),
  });

  useEffect(() => {
    void getAllPlatforms();
  }, []);

  const usage = useMemo(() => buildOrderCountByPlatform(revenues), [revenues]);

  const canDelete = (p: OrderPlatform) =>
    p.id !== PLATFORM_DIRECT_ID && (usage.get(p.id) ?? 0) === 0;

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deletePlatform(deleteTarget.id);
      notifyListInvalidated('platforms');
    } catch {
      // toasted
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget]);

  const showSkeleton = loading && items.length === 0;

  return (
    <div className="flex flex-col w-full min-w-0 bg-background">
      <div className="flex flex-wrap items-center gap-[var(--s-sm)] min-h-10 px-[var(--s-md)] py-[var(--s-xs)] bg-surface border-b border-border">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm kênh..."
          className="bg-input-bg border border-input-border rounded-field px-2 py-1 text-xs min-w-[160px] focus:outline-none focus:ring-2 focus:ring-input-focus-ring"
          aria-label="Tìm kênh đặt hàng"
        />
        <span className="text-xs text-text-muted">{total} kênh</span>
        <Button
          variant="default"
          size="sm"
          className="ml-auto"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus /> Thêm kênh bán
        </Button>
      </div>

      <Card className="flex flex-col border-none gap-0 py-0 shadow-none min-w-0">
        <CardContent className="flex flex-col p-0">
          {showSkeleton ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : total === 0 && !loading ? (
            <p className="text-xs text-text-muted py-16 text-center">Không có kênh</p>
          ) : (
            <>
            <div className="relative">
            <ListLoadingOverlay show={loading} />
            <ul className="divide-y divide-border-subtle">
              {items.map((p, index) => {
                const n = usage.get(p.id) ?? 0;
                return (
                  <li
                    key={p.id}
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-surface-hover cursor-pointer ${LIST_ROW_ANIM}`}
                    style={listRowStyle(index)}
                    onClick={() => setDetailPlatform(p)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDetailPlatform(p);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-text-primary">{p.name}</p>
                        {p.code ? (
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {p.code}
                          </Badge>
                        ) : null}
                        {!p.active ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Tắt
                          </Badge>
                        ) : null}
                        {n > 0 ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {n} đơn
                          </Badge>
                        ) : null}
                      </div>
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
                        disabled={!canDelete(p)}
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

      <PlatformDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
          notifyListInvalidated('platforms');
        }}
        editPlatform={editing}
      />

      <EntityDetailDialog
        open={detailPlatform !== null}
        onOpenChange={(o) => !o && setDetailPlatform(null)}
        title={detailPlatform?.name ?? 'Kênh'}
        description={
          detailPlatform?.createdAt
            ? `Tạo ${formatDate(detailPlatform.createdAt.slice(0, 10))}`
            : undefined
        }
      >
        {detailPlatform ? (
          <div className="grid grid-cols-2 gap-4">
            <DetailField label="Mã">
              {detailPlatform.code ? (
                <span className="font-mono">{detailPlatform.code}</span>
              ) : (
                <span className="text-text-muted">—</span>
              )}
            </DetailField>
            <DetailField label="Trạng thái">
              {detailPlatform.active ? 'Đang dùng' : 'Tắt'}
            </DetailField>
            <DetailField label="Số đơn" className="col-span-2">
              {usage.get(detailPlatform.id) ?? 0}
            </DetailField>
          </div>
        ) : null}
      </EntityDetailDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa kênh?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && !canDelete(deleteTarget)
                ? `“${deleteTarget.name}” không thể xóa (mặc định hoặc còn đơn).`
                : `Xóa “${deleteTarget?.name ?? ''}”?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            {deleteTarget && canDelete(deleteTarget) ? (
              <AlertDialogAction onClick={handleConfirmDelete}>Xóa</AlertDialogAction>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
