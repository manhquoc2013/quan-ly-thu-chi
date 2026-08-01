// src/ui/components/GridCell.tsx
// Table cell with read and inline-edit modes.
// Double-click to enter edit. Enter / blur to commit. Escape to cancel.

import { useState, useRef, type KeyboardEvent, type FocusEvent } from 'react';

export interface GridCellProps {
  value: string;
  displayValue?: string;
  editable?: boolean;
  onChange?: (value: string) => void;
  type?: 'text' | 'number';
  className?: string;
}

export function GridCell({
  value,
  displayValue = value,
  editable = false,
  onChange,
  type = 'text',
  className = '',
}: GridCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  if (editing && !editable) {
    setEditing(false);
  }

  const startEdit = () => {
    if (!editable) return;
    setDraft(value);
    setEditing(true);
  };

  const commit = () => {
    if (draft !== value) {
      onChange?.(draft);
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(_e: FocusEvent<HTMLInputElement>) => {
          setTimeout(commit, 0);
        }}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
        autoFocus
        className={[
          'px-[var(--s-md)]',
          'py-[var(--s-sm)]',
          'text-sm',
          'h-8',
          'bg-input-bg',
          'border',
          'border-input-focus-ring',
          'rounded-field',
          'text-text-primary',
          'text-ellipsis',
          'overflow-hidden',
          'focus:outline-none',
          'focus:ring-2',
          'focus:ring-input-focus-ring',
          'w-full',
        ].join(' ')}
        aria-label="Edit value"
      />
    );
  }

  return (
    <div
      className={[
        'px-[var(--s-md)]',
        'py-[var(--s-sm)]',
        'text-sm',
        'text-text-primary',
        'text-ellipsis',
        'overflow-hidden',
        'whitespace-nowrap',
        editable ? 'cursor-pointer hover:bg-surface-hover' : '',
        className,
      ].join(' ')}
      onClick={editable ? startEdit : undefined}
      title={value}
      role={editable ? 'button' : undefined}
      tabIndex={editable ? 0 : undefined}
      onKeyDown={
        editable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') startEdit();
            }
          : undefined
      }
      aria-label={editable ? 'Edit cell' : undefined}
    >
      {displayValue || <span className="text-text-muted">—</span>}
    </div>
  );
}
