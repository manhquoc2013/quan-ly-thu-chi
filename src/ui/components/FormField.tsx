/**
 * FormField — Shim wrapping shadcn Form pattern with the old API.
 *
 * Usage (same as before):
 *   <FormField label="Mô tả" required error={errors.description}>
 *     <FormInput ... />
 *   </FormField>
 */

import { Label } from '@/components/ui/label';
import type { ReactNode } from 'react';

export interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function FormField({ label, required, error, children, className }: FormFieldProps) {
  return (
    <div className={className}>
      <Label className="block text-xs font-medium text-text-secondary mb-1.5">
        {label}
        {required && <span className="text-danger-fg">{' '}*</span>}
      </Label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-danger-fg">{error}</p>
      )}
    </div>
  );
}
