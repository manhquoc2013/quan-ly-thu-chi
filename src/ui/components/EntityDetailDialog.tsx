/**
 * Read-only detail dialog shell — title + scrollable body, no action buttons.
 */

import type { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function DetailField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[10px] uppercase tracking-wide text-text-muted mb-0.5">{label}</p>
      <div className="text-sm text-text-primary">{children}</div>
    </div>
  );
}

export interface EntityDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Wider content e.g. order line items */
  wide?: boolean;
}

export function EntityDetailDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide,
}: EntityDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${wide ? 'max-w-lg sm:max-w-xl' : 'max-w-lg'} max-h-[85vh] !flex !flex-col overflow-hidden p-0 gap-0 h-auto`}
        showCloseButton
      >
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-6 py-4 max-h-[calc(85vh-6rem)]">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
