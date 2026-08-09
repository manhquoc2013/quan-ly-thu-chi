/**
 * Viewport-fixed bulk action bar via portal (escapes Layout transform ancestors).
 * Same row as the AI FAB: bar fills content width minus FAB column; both sit on the status bar.
 */
import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils/cn';

/** Match FAB size (size-12) so they share one horizontal row. */
export const SELECTION_BAR_HEIGHT = '48px';

export interface StickyBulkBarProps {
  open: boolean;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
}

export function StickyBulkBar({ open, ariaLabel, children, className }: StickyBulkBarProps) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="toolbar"
      aria-label={ariaLabel}
      className={cn(
        'fixed z-40 flex items-center justify-between gap-3',
        'h-12 px-4 md:px-5',
        'left-0 bottom-[var(--dimens-statusBarHeight)]',
        /* FAB column: right inset + 48px FAB + gap */
        'right-[calc(1rem+var(--dimens-fabSize)+0.75rem)]',
        'md:left-[var(--layout-sidebar-offset,var(--dimens-sidebar-width))]',
        'md:right-[calc(1.5rem+var(--dimens-fabSize)+0.75rem)]',
        'bg-accent-bg border border-b-0 border-accent-fg/35',
        'rounded-tr-2xl shadow-[0_-2px_12px_rgba(0,0,0,0.06)]',
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}
