/**
 * OrderBillDialog — A6 preview + window.print()
 */

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

export interface OrderBillDialogProps {
  open: boolean;
  revenue: Revenue | null;
  onClose: () => void;
}

export function OrderBillDialog({ open, revenue, onClose }: OrderBillDialogProps) {
  const customers = useCustomerStore((s) => s.customers);
  const profile = useAuthStore((s) => s.userProfile);

  const customerName = !revenue
    ? '—'
    : revenue.customerId === 'walk-in'
      ? 'Khách vãng lai'
      : customers.find((c) => c.id === revenue.customerId)?.name ||
        revenue.notes?.replace(/^Khách:\s*/i, '') ||
        '—';

  const store = {
    storeName: profile?.storeName?.trim() || 'Cửa hàng',
    phone: profile?.phone?.trim() || undefined,
    address: profile?.address?.trim() || undefined,
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
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
          <Button
            onClick={() => {
              window.print();
            }}
            disabled={!revenue}
          >
            <Printer size={14} /> In phiếu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
