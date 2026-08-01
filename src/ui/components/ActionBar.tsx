/**
 * ActionBar — Bottom action bar for bulk-item selection actions.
 *
 * Usage:
 *   <ActionBar selectedCount={3} totalCount={10}>
 *     <Button variant="danger" icon={Trash2}>Delete</Button>
 *   </ActionBar>
 *
 * Shows selection info when items are selected, otherwise hidden.
 * `children` are action buttons placed in the middle section.
 * `trailing` is a right-aligned CTA.
 */

import type { ReactNode } from 'react';

export interface ActionBarProps {
  /** Number of selected items. */
  selectedCount: number;
  /** Total number of items. */
  totalCount: number;
  /** Action buttons (placed in the middle section). */
  children?: ReactNode;
  /** Right-aligned CTA element. */
  trailing?: ReactNode;
  /** Optional class names appended to the root element. */
  className?: string;
}

export function ActionBar({
  selectedCount,
  totalCount,
  children,
  trailing,
  className = '',
}: ActionBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div
      className={[
        'flex',
        'items-center',
        'justify-between',
        'h-10',
        'px-[var(--s-md)]',
        'bg-surface',
        'border-t',
        'border-border',
        className,
      ].join(' ')}
      role="toolbar"
      aria-label={`${selectedCount} of ${totalCount} items selected`}
    >
      {/* Selection info */}
      <div className="flex items-center text-xs text-text-muted">
        <span className="font-medium text-text-primary">
          {selectedCount}
        </span>
        <span> selected of {totalCount}</span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-[var(--s-sm)]">
        {children}
      </div>

      {/* Right-aligned CTA */}
      {trailing && (
        <div className="shrink-0">{trailing}</div>
      )}
    </div>
  );
}
