/**
 * EmptyState — Centered empty state placeholder with optional action button.
 *
 * Usage:
 *   <EmptyState
 *     icon={DocumentText}
 *     title="No transactions"
 *     description="You have no transactions yet. Add one to get started."
 *     action={{ label: "Add transaction", onClick: handleAdd }}
 *   />
 */

import type { LucideIcon } from 'lucide-react';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: EmptyStateAction;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={[
        'flex',
        'flex-col',
        'items-center',
        'justify-center',
        'py-[var(--s-3xl)]',
        'px-[var(--s-xl)]',
        'text-center',
        'rounded-panel',
        className,
      ].join(' ')}
      role="status"
      aria-label={title}
    >
      {/* Icon */}
      <div
        className={[
          'flex',
          'items-center',
          'justify-center',
          'w-16',
          'h-16',
          'mb-[var(--s-xl)]',
          'rounded-full',
          'bg-neutral-bg',
          'text-text-muted',
        ].join(' ')}
      >
        <Icon className="w-8 h-8" />
      </div>

      {/* Title */}
      <h3
        className={[
          'text-lg',
          'font-semibold',
          'text-text-primary',
          'mb-[var(--s-sm)]',
        ].join(' ')}
      >
        {title}
      </h3>

      {/* Description */}
      <p
        className={[
          'text-sm',
          'text-text-muted',
          'max-w-sm',
          'mb-[var(--s-xl)]',
        ].join(' ')}
      >
        {description}
      </p>

      {/* Action */}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={[
            'inline-flex',
            'items-center',
            'justify-center',
            'px-[var(--s-xl)]',
            'py-[var(--s-sm)]',
            'text-sm',
            'font-medium',
            'h-10',
            'bg-accent-bg',
            'text-accent-fg',
            'border',
            'border-accent-fg/20',
            'rounded-field',
            'hover:bg-accent-bg-hover',
            'transition-colors',
            'cursor-pointer',
            'focus:outline-none',
            'focus:ring-2',
            'focus:ring-input-focus-ring',
          ].join(' ')}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
