/**
 * TableHScroll — horizontal scroll isolated to the table only.
 *
 * Contract (do not break):
 * - Parent chain must keep `min-w-0` so width is capped by the content column.
 * - App `main` must use `overflow-x: clip` so overflow-y:auto never opens page-level X scroll.
 * - Only THIS element scrolls horizontally; inner content uses minWidth to trigger overflow.
 */
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface TableHScrollProps {
  children: ReactNode;
  /** Minimum content width (px) before horizontal scroll appears. */
  minWidth: number;
  className?: string;
  innerClassName?: string;
}

export function TableHScroll({
  children,
  minWidth,
  className,
  innerClassName,
}: TableHScrollProps) {
  const innerStyle: CSSProperties = {
    width: '100%',
    minWidth,
  };

  return (
    <div
      className={cn(
        'w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain',
        className,
      )}
      data-table-hscroll
    >
      <div className={cn('w-full', innerClassName)} style={innerStyle}>
        {children}
      </div>
    </div>
  );
}
