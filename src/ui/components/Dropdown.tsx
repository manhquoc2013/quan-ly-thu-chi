/**
 * Dropdown — searchable combobox (cmdk + popover).
 * Options are passed dynamically; search filters by label.
 */

import { useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface DropdownProps {
  options: DropdownOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  /** Allow clearing selection (shows X). Default true for filter-style; set false for required fields. */
  clearable?: boolean;
  disabled?: boolean;
  'aria-label'?: string;
}

/** Build options from a label map (e.g. EXPENSE_CATEGORY_LABELS). */
export function optionsFromLabels(
  labels: Record<string, string>,
  extra?: DropdownOption[],
): DropdownOption[] {
  const fromMap = Object.entries(labels).map(([value, label]) => ({ value, label }));
  return extra ? [...extra, ...fromMap] : fromMap;
}

export function Dropdown({
  options,
  value,
  onChange,
  placeholder = 'Chọn...',
  searchPlaceholder = 'Tìm kiếm...',
  emptyText = 'Không thấy kết quả',
  className,
  clearable = false,
  disabled,
  'aria-label': ariaLabel,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel ?? placeholder}
          disabled={disabled}
          className={cn(
            'inline-flex w-full min-w-0 items-center justify-between gap-2',
            'h-9 px-3 text-xs',
            'bg-input-bg border border-input-border rounded-field',
            'text-text-primary',
            'hover:border-input-focus-ring transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-input-focus-ring',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            !selected && 'text-text-muted',
            className,
          )}
        >
          <span className="truncate text-left flex-1 min-w-0">
            {selected?.label ?? placeholder}
          </span>
          <span className="flex items-center gap-0.5 shrink-0">
            {clearable && value !== undefined && value !== '' && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Xóa chọn"
                className="p-0.5 rounded hover:bg-surface-hover text-text-muted"
                onClick={(e) => {
                  e.preventDefault();
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
              >
                <X size={12} />
              </span>
            )}
            <ChevronDown
              size={14}
              className={cn('text-text-muted transition-transform', open && 'rotate-180')}
            />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[100] w-[var(--radix-popover-trigger-width)] min-w-[200px] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-9 text-xs" />
          <CommandList>
            <CommandEmpty className="py-4 text-xs">{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value || '__empty__'}
                  value={`${opt.label} ${opt.value}`}
                  disabled={opt.disabled}
                  onSelect={() => {
                    onChange?.(opt.value);
                    setOpen(false);
                  }}
                  className="text-xs"
                >
                  <Check
                    size={12}
                    className={cn(
                      'shrink-0',
                      value === opt.value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="truncate">{opt.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
