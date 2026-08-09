/**
 * Visible loading state over a paged list while keeping previous rows.
 */
import { Loader2 } from 'lucide-react';

export interface ListLoadingOverlayProps {
  show: boolean;
  label?: string;
}

export function ListLoadingOverlay({ show, label = 'Đang tải…' }: ListLoadingOverlayProps) {
  if (!show) return null;

  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-surface/55 pointer-events-none"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 rounded-full bg-surface border border-border px-3 py-1.5 shadow-sm text-xs text-text-secondary">
        <Loader2 className="size-3.5 animate-spin text-accent-fg" aria-hidden />
        {label}
      </div>
    </div>
  );
}
