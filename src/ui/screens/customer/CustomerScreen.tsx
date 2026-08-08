/**
 * CustomerScreen — Manage customer list (CRUD).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Phone, Mail, MapPin } from 'lucide-react';
import type { Customer } from '@/models';
import { useCustomerStore } from '@/store/customerStore';
import { useRevenueStore } from '@/store/revenueStore';
import { useUIStore } from '@/store/uiStore';
import { getAllCustomers, deleteCustomer } from '@/services/customerService';
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
import { CustomerDialog } from './CustomerDialog';
import { DetailField, EntityDetailDialog } from '@/ui/components/EntityDetailDialog';
import { formatDate } from '@/utils/date';

export function CustomerScreen() {
  const customers = useCustomerStore((s) => s.customers);
  const searchQuery = useCustomerStore((s) => s.searchQuery);
  const setSearchQuery = useCustomerStore((s) => s.setSearchQuery);
  const revenues = useRevenueStore((s) => s.records);

  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  useEffect(() => {
    getAllCustomers().finally(() => setLoading(false));
  }, []);

  const recordDetailRequest = useUIStore((s) => s.recordDetailRequest);
  const clearRecordDetailRequest = useUIStore((s) => s.clearRecordDetailRequest);

  useEffect(() => {
    if (!recordDetailRequest || recordDetailRequest.kind !== 'customer') return;
    const row = customers.find((c) => c.id === recordDetailRequest.id);
    if (row) setDetailCustomer(row);
    clearRecordDetailRequest();
  }, [recordDetailRequest, customers, clearRecordDetailRequest]);

  const orderCountByCustomer = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of revenues) {
      if (!r.customerId || r.customerId === 'walk-in') continue;
      map.set(r.customerId, (map.get(r.customerId) ?? 0) + 1);
    }
    return map;
  }, [revenues]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = [...customers];
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          (c.email?.toLowerCase().includes(q) ?? false),
      );
    }
    list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    return list;
  }, [customers, searchQuery]);

  const handleAdd = useCallback(() => {
    setEditing(null);
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((c: Customer) => {
    setEditing(c);
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setEditing(null);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteCustomer(deleteTarget.id);
    } catch {
      // service already toasts
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
          placeholder="Tìm tên, SĐT, email..."
          className="bg-input-bg border border-input-border rounded-field px-2 py-1 text-xs min-w-[180px] focus:outline-none focus:ring-2 focus:ring-input-focus-ring"
          aria-label="Tìm khách hàng"
        />
        <span className="text-xs text-text-muted">{filtered.length} khách</span>
        <Button variant="default" size="sm" className="ml-auto" onClick={handleAdd}>
          <Plus /> Thêm khách
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
              {searchQuery ? 'Không tìm thấy khách hàng' : 'Chưa có khách hàng — thêm mới hoặc tạo qua AI/đơn hàng'}
            </p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {filtered.map((c) => {
                const orderCount = orderCountByCustomer.get(c.id) ?? 0;
                return (
                  <li
                    key={c.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-surface-hover transition-colors cursor-pointer"
                    onClick={() => setDetailCustomer(c)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDetailCustomer(c);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-text-primary">{c.name}</p>
                        {orderCount > 0 ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {orderCount} đơn
                          </Badge>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-text-muted">
                        {c.phone ? (
                          <span className="inline-flex items-center gap-1">
                            <Phone size={11} /> {c.phone}
                          </span>
                        ) : (
                          <span className="text-text-disabled">Chưa có SĐT</span>
                        )}
                        {c.email ? (
                          <span className="inline-flex items-center gap-1 truncate max-w-[200px]">
                            <Mail size={11} /> {c.email}
                          </span>
                        ) : null}
                        {c.address ? (
                          <span className="inline-flex items-center gap-1 truncate max-w-[240px]">
                            <MapPin size={11} /> {c.address}
                          </span>
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
                        aria-label={`Sửa ${c.name}`}
                        onClick={() => handleEdit(c)}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-danger-fg"
                        aria-label={`Xóa ${c.name}`}
                        onClick={() => setDeleteTarget(c)}
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

      <CustomerDialog open={dialogOpen} onClose={handleCloseDialog} editCustomer={editing} />

      <EntityDetailDialog
        open={detailCustomer !== null}
        onOpenChange={(o) => !o && setDetailCustomer(null)}
        title={detailCustomer?.name ?? 'Khách hàng'}
        description={
          detailCustomer?.createdAt
            ? `Tạo ${formatDate(detailCustomer.createdAt.slice(0, 10))}`
            : undefined
        }
      >
        {detailCustomer ? (
          <div className="grid grid-cols-2 gap-4">
            <DetailField label="Số điện thoại">
              {detailCustomer.phone || <span className="text-text-muted">—</span>}
            </DetailField>
            <DetailField label="Số đơn">
              {orderCountByCustomer.get(detailCustomer.id) ?? 0}
            </DetailField>
            <DetailField label="Email" className="col-span-2">
              {detailCustomer.email || <span className="text-text-muted">—</span>}
            </DetailField>
            <DetailField label="Địa chỉ" className="col-span-2">
              {detailCustomer.address || <span className="text-text-muted">—</span>}
            </DetailField>
          </div>
        ) : null}
      </EntityDetailDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa khách hàng?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (orderCountByCustomer.get(deleteTarget.id) ?? 0) > 0
                ? `“${deleteTarget.name}” còn đơn hàng — không thể xóa.`
                : `Xóa “${deleteTarget?.name ?? ''}”? Thao tác không hoàn tác.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            {(orderCountByCustomer.get(deleteTarget?.id ?? '') ?? 0) === 0 ? (
              <AlertDialogAction onClick={handleConfirmDelete}>Xóa</AlertDialogAction>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
