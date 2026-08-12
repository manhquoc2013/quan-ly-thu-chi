/**
 * FormInput — Shim wrapping shadcn Input with old styling.
 *
 * Usage (same as before):
 *   <FormInput value={form.amount} onChange={handleChange('amount')} />
 */

import { Input } from '@/components/ui/input';
import { cn } from '@/utils/cn';

export interface FormInputProps
  extends Omit<React.ComponentPropsWithoutRef<'input'>, 'className'> {
  className?: string;
  dataError?: boolean;
}

export function FormInput({
  className,
  dataError,
  ...props
}: FormInputProps) {
  const isError = (props['aria-invalid'] as boolean) === true || dataError === true;

  return (
    <Input
      className={cn(
        'h-9',
        isError && 'border-danger-fg',
        className,
      )}
      aria-invalid={props['aria-invalid']}
      {...props}
    />
  );
}
