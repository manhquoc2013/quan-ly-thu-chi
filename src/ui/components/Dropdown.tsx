// src/ui/components/Dropdown.tsx
// Select / combobox with searchable input, clear button, and keyboard nav.

import { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronDown, X, Search, Check } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { JSX } from 'react';

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownProps {
  options: DropdownOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  maxHeight?: number;
}

/* ─── Component ─── */

export function Dropdown({
  options,
  value,
  onChange,
  placeholder = 'Chọn...',
  className,
  maxHeight = 280,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Filtered options by query
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase()),
  );

  const selected = options.find((o) => o.value === value);

  // Open → focus search
  useEffect(() => {
    if (open) {
      searchRef.current?.focus();
    }
  }, [open]);

  // Close on outside click, but keep open if click is inside search input
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target)
      ) {
        if (containerRef.current.contains(target)) return;
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = useCallback(
    (opt: DropdownOption) => {
      onChange?.(opt.value);
      setOpen(false);
      setQuery('');
    },
    [onChange],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
        return;
      }
      if (!open) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setOpen(true);
        }
        return;
      }
      // dropdown open — arrow keys + Enter
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const _listEl = containerRef.current?.querySelector('[data-option]');
        const allOpts = containerRef.current?.querySelectorAll('[data-option]');
        if (!allOpts?.length) return;
        const arr = Array.from(allOpts);
        const active = arr.find(
          (el) => el.classList.contains('dropdown-active'),
        );
        const idx = active ? arr.indexOf(active) : -1;
        const next =
          e.key === 'ArrowDown'
            ? (idx + 1) % arr.length
            : (idx - 1 + arr.length) % arr.length;
        arr.forEach((el) => el.classList.remove('dropdown-active'));
        arr[next]!.classList.add('dropdown-active');
        arr[next]!.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (e.key === 'Enter') {
        // If no active option, select the first visible filtered option
        const activeEl = containerRef.current?.querySelector(
          '[data-option].dropdown-active',
        );
        if (activeEl) {
          const optVal = activeEl.getAttribute('data-value');
          if (optVal) {
            const opt = options.find((o) => o.value === optVal);
            if (opt) handleSelect(opt);
          }
        } else if (filtered.length > 0) {
          handleSelect(filtered[0]!);
        }
      }
    },
    [open, options, handleSelect, filtered],
  );

  const dropdownPanelHeight = maxHeight - 40; // subtract search input area

  return (
    <div
      ref={containerRef}
      className={cn('relative inline-block', className)}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger button */}
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls="dropdown-options"
        aria-label="Select option"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) setQuery('');
        }}
        className={cn(
          'inline-flex items-center justify-between w-full min-w-[200px]',
          'h-7 px-3 text-xs',
          'bg-input-bg border border-input-border rounded-field',
          'text-text-primary',
          'hover:border-input-focus-ring transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-input-focus-ring',
          open && 'border-input-focus-ring ring-2 ring-input-focus-ring',
        )}
      >
        <span className="text-ellipsis overflow-hidden whitespace-nowrap flex-1 text-left pr-2">
          {selected?.label ?? placeholder}
        </span>
        {value ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange?.('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onChange?.('');
              }
            }}
            className="shrink-0 p-0.5 hover:bg-surface-hover rounded cursor-pointer"
            aria-label="Clear selection"
          >
            <X size={12} className="text-text-muted" />
          </span>
        ) : (
          <ChevronDown
            size={14}
            className={cn(
              'shrink-0 text-text-muted transition-transform',
              open && 'rotate-180',
            )}
          />
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          id="dropdown-options"
          className={cn(
            'absolute z-50 left-0 mt-1 w-full min-w-[200px]',
            'bg-surface',
            'border border-border',
            'rounded-field',
            'shadow-dropdown',
            'scrollbar-thin',
          )}
          style={{ maxHeight }}
          role="listbox"
        >
          {/* Search input always visible */}
          <div className="relative p-1.5 border-b border-border">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm kiếm..."
              className={cn(
                'w-full h-7 pl-6 pr-2.5 text-xs',
                'bg-input-bg',
                'border border-input-border rounded-field',
                'text-text-primary placeholder-input-placeholder',
                'focus:outline-none focus:ring-2 focus:ring-input-focus-ring',
              )}
              aria-label="Tìm kiếm"
            />
          </div>

          {/* Options list */}
          <div
            className="py-0.5 overflow-y-auto"
            style={{ maxHeight: dropdownPanelHeight }}
          >
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-text-muted">
                Không thấy kết quả
              </div>
            ) : (
              filtered.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    data-option
                    data-value={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={0}
                    onClick={() => handleSelect(opt)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSelect(opt);
                    }}
                    onFocus={(event: React.FocusEvent) => {
                      const siblings =
                        containerRef.current?.querySelectorAll('[data-option]');
                      siblings?.forEach((el) =>
                        el.classList.remove('dropdown-active'),
                      );
                      (event.currentTarget as HTMLElement).classList.add(
                        'dropdown-active',
                      );
                    }}
                    className={cn(
                      'flex items-center justify-between px-3 py-1.5 cursor-pointer text-xs',
                      'transition-colors duration-[var(--d-fast)]',
                      'focus:outline-none',
                      isSelected
                        ? 'bg-accent-bg text-accent-fg font-semibold'
                        : 'text-text-primary hover:bg-surface-hover',
                    )}
                  >
                    <span className="flex-1 truncate">{opt.label}</span>
                    {isSelected && (
                      <Check size={12} className="text-accent-fg shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
