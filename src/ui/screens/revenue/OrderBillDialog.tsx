/**
 * OrderBillDialog — A6 preview + reliable window.print via body portal.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useCustomerStore } from '@/store/customerStore';
import { useAuthStore } from '@/store/authStore';
import type { Revenue } from '@/models';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Printer } from 'lucide-react';
import { OrderBill } from './OrderBill';
import { isWalkInCustomerId } from '@/services/revenueFilters';

export interface OrderBillDialogProps {
  open: boolean;
  revenue: Revenue | null;
  onClose: () => void;
}

function resolveCustomerName(
  revenue: Revenue,
  customers: Array<{ id: string; name: string }>,
): string {
  if (isWalkInCustomerId(revenue.customerId)) return 'Khách vãng lai';
  return (
    customers.find((c) => c.id === revenue.customerId)?.name ||
    revenue.notes?.replace(/^Khách:\s*/i, '') ||
    '—'
  );
}

/** Mount bill on document.body (outside dialog transform) then print. */
function printOrderBillToBody(
  revenue: Revenue,
  customerName: string,
  store: { storeName: string; phone?: string; address?: string },
): void {
  const host = document.createElement('div');
  host.id = 'order-bill-print-host';
  document.body.appendChild(host);
  const root: Root = createRoot(host);
  root.render(
    <OrderBill revenue={revenue} customerName={customerName} store={store} forPrint />,
  );

  const cleanup = () => {
    root.unmount();
    host.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.print();
      window.setTimeout(cleanup, 60_000);
    });
  });
}

export function OrderBillDialog({ open, revenue, onClose }: OrderBillDialogProps) {
  const customers = useCustomerStore((s) => s.customers);
  const profile = useAuthStore((s) => s.userProfile);
  const printingRef = useRef(false);

  const customerName = useMemo(
    () => (revenue ? resolveCustomerName(revenue, customers) : '—'),
    [revenue, customers],
  );

  const store = useMemo(
    () => ({
      storeName: profile?.storeName?.trim() || 'Cửa hàng',
      phone: profile?.phone?.trim() || undefined,
      address: profile?.address?.trim() || undefined,
    }),
    [profile?.storeName, profile?.phone, profile?.address],
  );

  const handlePrint = useCallback(() => {
    if (!revenue || printingRef.current) return;
    printingRef.current = true;
    printOrderBillToBody(revenue, customerName, store);
    window.setTimeout(() => {
      printingRef.current = false;
    }, 1500);
  }, [revenue, customerName, store]);

  useEffect(() => {
    if (!open) printingRef.current = false;
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden print:hidden">
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-border">
          <DialogTitle>In phiếu đơn</DialogTitle>
          <DialogDescription>
            Khổ A6 (105×148 mm). Chọn khổ A6 hoặc scale 100% trong hộp thoại in.
          </DialogDescription>
        </DialogHeader>
        <div className="bg-muted/40 px-4 py-5 flex justify-center overflow-auto max-h-[60vh]">
          {revenue ? (
            <OrderBill
              revenue={revenue}
              customerName={customerName}
              store={store}
              className="order-bill--preview shadow-md"
            />
          ) : null}
        </div>
        <DialogFooter className="px-5 py-3 border-t border-border bg-muted/20">
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
          <Button onClick={handlePrint} disabled={!revenue}>
            <Printer size={14} /> In phiếu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
