/**
 * ProductScreen — Manage product catalog (CRUD).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import type { Product } from '@/models';
import { useProductStore } from '@/store/productStore';
import { useRevenueStore } from '@/store/revenueStore';
import { getAllProducts, deleteProduct } from '@/services/productService';
import { formatCurrency } from '@/utils/currency';
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

export function ProductScreen() {
  const products = useProductStore((s) => s.products);
  const searchQuery = useProductStore((s) => s.searchQuery);
  const setSearchQuery = useProductStore((s) => s.setSearchQuery);
  const revenues = useRevenueStore((s) => s.records);

  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  useEffect(() => {
    getAllProducts().finally(() => setLoading(false));
  }, []);

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

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = [...products];
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku?.toLowerCase().includes(q) ?? false) ||
          (p.notes?.toLowerCase().includes(q) ?? false),
      );
    }
    list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    return list;
  }, [products, searchQuery]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteProduct(deleteTarget.id);
    } catch {
      // toasted
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget]);

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
        <span className="text-xs text-text-muted">{filtered.length} SP</span>
        <Button
          variant="default"
          size="sm"
          className="ml-auto"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus /> Thêm SP
        </Button>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden min-h-0 border-none">
        <CardContent className="flex-1 p-0 overflow-y-auto">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-text-muted py-16 text-center">
              {searchQuery
                ? 'Không tìm thấy sản phẩm'
                : 'Chưa có sản phẩm — thêm mới hoặc để AI tự tạo khi bán'}
            </p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {filtered.map((p) => {
                const used = usageCount.get(p.id) ?? 0;
                return (
                  <li
                    key={p.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-surface-hover transition-colors"
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
                        Gợi ý: {formatCurrency(p.defaultUnitPrice)} / {p.unit}
                        {p.notes ? ` · ${p.notes}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
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
          )}
        </CardContent>
      </Card>

      <ProductDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        editProduct={editing}
      />

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
