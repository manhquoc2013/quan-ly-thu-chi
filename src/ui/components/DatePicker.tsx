/**
 * DatePicker — Popover calendar with icon aligned to the right.
 * Value format: ISO date-only `YYYY-MM-DD`. Display: `DD/MM/YYYY`.
 */

import { useMemo, useState } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface DatePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

function parseDateValue(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = parseISO(value);
  return isValid(d) ? d : undefined;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'DD/MM/YYYY',
  className = '',
  min,
  max,
  disabled,
  'aria-label': ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseDateValue(value), [value]);
  const minDate = useMemo(() => parseDateValue(min), [min]);
  const maxDate = useMemo(() => parseDateValue(max), [max]);

  const display = selected ? format(selected, 'dd/MM/yyyy') : '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel ?? placeholder}
          className={cn(
            'inline-flex w-full items-center justify-between gap-2',
            'h-9 px-3 text-xs',
            'bg-input-bg border border-input-border rounded-field',
            'text-text-primary',
            'hover:border-input-focus-ring transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-input-focus-ring',
            'disabled:bg-input-disabled-bg disabled:text-text-disabled disabled:cursor-not-allowed',
            !display && 'text-text-muted',
            className,
          )}
        >
          <span className="truncate text-left flex-1 min-w-0">
            {display || placeholder}
          </span>
          <CalendarIcon
            size={14}
            className="shrink-0 text-text-muted"
            aria-hidden
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="z-[100] w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (!date) return;
            onChange?.(format(date, 'yyyy-MM-dd'));
            setOpen(false);
          }}
          disabled={(date) => {
            if (minDate && date < minDate) return true;
            if (maxDate && date > maxDate) return true;
            return false;
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
