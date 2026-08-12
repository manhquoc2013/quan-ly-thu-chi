/**
 * FormTextarea — Shim wrapping shadcn Textarea with old styling.
 *
 * Usage (same as before):
 *   <FormTextarea value={form.description} onChange={handleChange('description')} />
 */

import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/utils/cn';

export interface FormTextareaProps
  extends Omit<React.ComponentPropsWithoutRef<'textarea'>, 'className'> {
  className?: string;
  rows?: number;
  dataError?: boolean;
}

export function FormTextarea({
  className,
  rows = 3,
  dataError,
  ...props
}: FormTextareaProps) {
  const isError = (props['aria-invalid'] as boolean) === true || dataError === true;

  return (
    <Textarea
      rows={rows}
      className={cn(
        isError && 'border-danger-fg',
        className,
      )}
      aria-invalid={props['aria-invalid']}
      {...props}
    />
  );
}
