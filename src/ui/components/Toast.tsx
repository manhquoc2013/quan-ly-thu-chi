/**
 * Toast — Auto-dismissing notification overlay.
 *
 * Usage:
 *   <Toast message="Save successful" type="success" />
 *   <Toast message="Network error" type="error" duration={5000} />
 */

import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

const TYPE_CONFIG: Record<
  ToastType,
  { bg: string; fg: string; iconLabel: string }
> = {
  success: {
    bg: 'bg-success-bg',
    fg: 'text-success-fg',
    iconLabel: 'Success',
  },
  error: {
    bg: 'bg-danger-bg',
    fg: 'text-danger-fg',
    iconLabel: 'Error',
  },
  warning: {
    bg: 'bg-warning-bg',
    fg: 'text-warning-fg',
    iconLabel: 'Warning',
  },
  info: {
    bg: 'bg-info-bg',
    fg: 'text-info-fg',
    iconLabel: 'Info',
  },
};

export interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onDismiss?: () => void;
}

export function Toast({
  message,
  type = 'info',
  duration = 3000,
  onDismiss,
}: ToastProps) {
  const [visible, setVisible] = useState(true);
  const config = TYPE_CONFIG[type];

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={[
        'fixed',
        'top-4',
        'right-4',
        'z-[1000]',
        'flex',
        'items-center',
        'gap-[var(--s-sm)]',
        'px-lg',
        'py-sm',
        'rounded-panel',
        'shadow-tooltip',
        config.bg,
        config.fg,
        'text-xs',
        'font-medium',
        'transition-all',
        'duration-[var(--d-fast)]',
        'ease-[var(--ease-out)]',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none',
      ].join(' ')}
    >
      {type === 'success' && (
        <span aria-hidden="true">✓</span>
      )}
      {type === 'error' && (
        <span aria-hidden="true">✕</span>
      )}
      {type === 'warning' && (
        <span aria-hidden="true">!</span>
      )}
      {type === 'info' && (
        <span aria-hidden="true">i</span>
      )}
      <span>{message}</span>
    </div>
  );
}
