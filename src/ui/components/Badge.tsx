/**
 * Badge — Small label for status, category, or meta information.
 *
 * Usage:
 *   <Badge variant="success">Paid</Badge>
 *   <Badge variant="warning" dot>Pending</Badge>
 *   <Badge variant="error" size="md">Cancelled</Badge>
 */

import type { ReactNode } from 'react';
import { badgePresets } from '@ui/theme/presets';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'neutral' | 'accent';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
}

export function Badge({
  children,
  variant = 'neutral',
  size = 'sm',
  dot,
  className,
}: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex',
        'items-center',
        'gap-1',
        size === 'sm' ? 'px-sm py-px text-xs' : 'px-md py-1 text-sm',
        'font-medium',
        'rounded-badge',
        badgePresets[variant],
        className ?? '',
      ].join(' ')}
    >
      {dot && (
        <span
          className="size-1.5 shrink-0 rounded-full bg-current"
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
