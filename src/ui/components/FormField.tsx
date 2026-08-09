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
import { FieldErrorTip, useAutoErrorTipKey } from './FieldErrorTip';

export interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  /** Optional tip re-show key (e.g. from useFieldErrorTips). */
  errorTipKey?: number;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  required,
  error,
  errorTipKey,
  children,
  className,
}: FormFieldProps) {
  const autoKey = useAutoErrorTipKey(error);
  const tipKey = errorTipKey ?? autoKey;

  return (
    <div className={className}>
      <Label className="block text-xs font-medium text-text-secondary mb-1.5">
        {label}
        {required && <span className="text-danger-fg">{' '}*</span>}
      </Label>
      {children}
      <FieldErrorTip message={error} showKey={tipKey} />
    </div>
  );
}
