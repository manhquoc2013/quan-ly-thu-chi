// src/ui/components/DatePicker.tsx
// Native <input type="date"> wrapper styled to match the design theme.

import type { ChangeEvent, JSX } from 'react';

export interface DatePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  min?: string;
  max?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'DD/MM/YYYY',
  className = '',
  min,
  max,
}: DatePickerProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.value);
  };

  return (
    <input
      type="date"
      value={value ?? ''}
      onChange={handleChange}
      placeholder={placeholder}
      min={min}
      max={max}
      aria-label={placeholder}
      className={
        `inline-flex items-center h-7 px-3 text-xs ` +
        'bg-input-bg ' +
        'border border-input-border rounded-field ' +
        'text-text-primary ' +
        'focus:outline-none focus:ring-2 focus:ring-input-focus-ring ' +
        'transition-colors duration-[var(--d-fast)] ' +
        'hover:border-input-focus-ring ' +
        'disabled:bg-input-disabled-bg disabled:text-text-disabled disabled:cursor-not-allowed ' +
        `[&::-webkit-calendar-picker-indicator]:cursor-pointer ` +
        className
      }
    />
  );
}
