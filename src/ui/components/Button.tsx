/**
 * Button — Reusable action button with variants, icon, and loading states.
 *
 * Usage:
 *   <Button variant="run" icon={Plus}>Save</Button>
 *   <Button variant="danger" disabled>Delete</Button>
 *   <Button variant="accent" busy>Loading...</Button>
 */

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { buttonPresets } from '@ui/theme/presets';

export type ButtonVariant = 'run' | 'danger' | 'neutral' | 'accent';

export interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  icon?: LucideIcon;
  disabled?: boolean;
  busy?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Button({
  children,
  variant = 'neutral',
  icon: Icon,
  disabled,
  busy,
  onClick,
  className,
}: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={[
        'inline-flex',
        'items-center',
        'cursor-pointer',
        'gap-[var(--s-xs)]',
        'px-[var(--s-md)]',
        'py-[var(--s-xs)]',
        'text-xs',
        'font-medium',
        'rounded-field',
        'transition-all',
        'duration-[var(--d-fast)]',
        'ease-[var(--ease-out)]',
        'disabled:opacity-50',
        'disabled:cursor-not-allowed',
        buttonPresets[variant].className,
        className ?? '',
      ].join(' ')}
    >
      {busy ? (
        <span
          className="animate-spin size-3.5 border-2 border-current border-t-transparent rounded-full"
          aria-hidden="true"
        />
      ) : Icon ? (
        <Icon size={14} aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}
