/**
 * Toolbar — Horizontal top action bar.
 *
 * Usage:
 *   <Toolbar>
 *     <h1 className="font-semibold text-lg">Title</h1>
 *   </Toolbar>
 *
 * Children occupy the fluid left/center area.
 * `trailing` is pinned to the right side.
 */

import type { ReactNode } from 'react';

export interface ToolbarProps {
  /** Fluid content area (left/center) — fills remaining space. */
  children?: ReactNode;
  /** Pinned actions area (right-aligned). */
  trailing?: ReactNode;
  /** Optional class names appended to the root element. */
  className?: string;
}

export function Toolbar({ children, trailing, className = '' }: ToolbarProps) {
  return (
    <div
      className={[
        'flex',
        'items-center',
        'gap-[var(--s-sm)]',
        'h-10',
        'px-[var(--s-md)]',
        'bg-surface',
        'border-b',
        'border-border',
        className,
      ].join(' ')}
      role="toolbar"
      aria-label="Page toolbar"
    >
      <div className="flex items-center gap-[var(--s-sm)] min-w-0 flex-1 overflow-x-auto">
        {children}
      </div>
      {trailing && (
        <div className="flex items-center gap-[var(--s-sm)] shrink-0">
          {trailing}
        </div>
      )}
    </div>
  );
}
