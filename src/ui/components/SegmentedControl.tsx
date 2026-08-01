/**
 * SegmentedControl — Horizontal segmented tab switcher.
 *
 * Usage:
 *   <SegmentedControl
 *     options={[
 *       { value: 'income', label: 'Income' },
 *       { value: 'expense', label: 'Expense' },
 *       { value: 'balance', label: 'Balance' },
 *     ]}
 *     value="income"
 *     onChange={(v) => setValue(v)}
 *   />
 */

import type { JSX, ReactNode } from 'react';

export interface SegmentedControlOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  /** Available segment options. */
  options: SegmentedControlOption[];
  /** Currently selected value. */
  value: string;
  /** Called when a segment is clicked. */
  onChange: (value: string) => void;
  /** Optional class names appended to the root element. */
  className?: string;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  className = '',
}: SegmentedControlProps) {
  return (
    <div
      className={[
        'flex',
        'items-center',
        'gap-0',
        'rounded-panel',
        'bg-border-subtle',
        'p-[2px]',
        className,
      ].join(' ')}
      role="radiogroup"
      aria-label="Segmented control"
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={[
              'flex',
              'items-center',
              'px-[var(--s-md)]',
              'py-1',
              'text-xs',
              'font-medium',
              'rounded-[calc(6px-2px)]',
              'transition-colors',
              'duration-[var(--d-fast)]',
              'ease-[var(--ease-out)]',
              isActive
                ? 'bg-accent-bg text-accent-fg'
                : 'text-text-muted hover:bg-surface-hover',
            ].join(' ')}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
