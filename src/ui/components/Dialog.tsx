/**
 * Dialog — Modal overlay rendered via createPortal.
 *
 * Usage:
 *   <Dialog open={isOpen} onClose={() => setIsOpen(false)} title="Settings">
 *     <Form />
 *   </Dialog>
 *   <ConfirmDialog
 *     open={showConfirm}
 *     message="Are you sure?"
 *     onCancel={() => setShowConfirm(false)}
 *     onConfirm={() => handleConfirm()}
 *   />
 *   <AlertDialog
 *     open={showAlert}
 *     message="An error occurred."
 *     onConfirm={() => setShowAlert(false)}
 *   />
 */

import { type ReactNode, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { dimens } from '@ui/theme/tokens';

// ─── Dialog ───────────────────────────────────────────────

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  width?: number;
  children: ReactNode;
  footer?: ReactNode;
}

export function Dialog({ open, onClose, title, width = 560, children, footer }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const handleBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  const dialogStyle: React.CSSProperties = {
    maxWidth: `${width}px`,
  };

  const content = (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-[var(--d-fast)]" />
      <div
        ref={panelRef}
        className={[
          'relative',
          'z-10',
          'bg-surface',
          'rounded-dialog',
          'shadow-dialog',
          'ring-1',
          'ring-black/5',
          'flex',
          'flex-col',
          'w-full',
          'max-h-[85vh]',
          'animate-dialog-in',
        ].join(' ')}
        style={dialogStyle}
      >
        {title && (
          <div
            className={[
              'flex',
              'items-center',
              'justify-between',
              'px-[var(--s-xl)]',
              'py-[var(--s-lg)]',
              'border-b',
              'border-border',
            ].join(' ')}
          >
            <h2
              className={[
                'text-base',
                'font-semibold',
                'text-text-primary',
              ].join(' ')}
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className={[
                'text-text-muted',
                'hover:text-text-primary',
                'transition-colors',
                'duration-[var(--d-fast)]',
                'text-lg',
                'leading-none',
                'cursor-pointer',
              ].join(' ')}
              aria-label="Close dialog"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div
          className={[
          'flex-1',
          'overflow-y-auto',
          'px-[var(--s-xl)]',
          'py-[var(--s-lg)]',
        ].join(' ')}
        >
          {children}
        </div>
        {footer && (
          <div
            className={[
              'flex',
              'items-center',
              'justify-end',
              'gap-[var(--s-sm)]',
              'px-[var(--s-xl)]',
              'py-[var(--s-md)]',
              'border-t',
              'border-border',
            ].join(' ')}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

// ─── ConfirmDialog ────────────────────────────────────────

export interface ConfirmDialogProps {
  open: boolean;
  message: string;
  title?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'run' | 'danger';
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  message,
  title = 'Confirm',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'run',
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const footer = (
    <>
      <button
        type="button"
        onClick={onCancel}
        className={[
          'inline-flex',
          'items-center',
          'gap-[var(--s-xs)]',
          'px-[var(--s-md)]',
          'py-[var(--s-xs)]',
          'text-xs',
          'font-medium',
          'rounded-field',
          'transition-all',
          'duration-[var(--d-fast)]',
          'ease-[var(--ease-out)]',
          'bg-neutral-bg',
          'hover:bg-neutral-bg-hover',
          'text-neutral-fg',
          'disabled:opacity-50',
          'disabled:cursor-not-allowed',
        ].join(' ')}
      >
        {cancelText}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        className={[
          'inline-flex',
          'items-center',
          'gap-[var(--s-xs)]',
          'px-[var(--s-md)]',
          'py-[var(--s-xs)]',
          'text-xs',
          'font-medium',
          'rounded-field',
          'transition-all',
          'duration-[var(--d-fast)]',
          'ease-[var(--ease-out)]',
          variant === 'danger'
            ? 'bg-danger-fg hover:bg-danger-fg-hover text-white'
            : 'bg-run-bg hover:bg-run-bg-hover text-run-fg',
          'disabled:opacity-50',
          'disabled:cursor-not-allowed',
        ].join(' ')}
      >
        {confirmText}
      </button>
    </>
  );

  return (
    <Dialog open={open} onClose={onCancel} title={title} footer={footer}>
      <p className="text-sm text-text-primary">{message}</p>
    </Dialog>
  );
}

// ─── AlertDialog ──────────────────────────────────────────

export interface AlertDialogProps {
  open: boolean;
  message: string;
  title?: string;
  okText?: string;
  onConfirm: () => void;
}

export function AlertDialog({
  open,
  message,
  title = 'Alert',
  okText = 'OK',
  onConfirm,
}: AlertDialogProps) {
  const footer = (
    <button
      type="button"
      onClick={onConfirm}
      className={[
        'inline-flex',
        'items-center',
        'gap-[var(--s-xs)]',
        'px-[var(--s-md)]',
        'py-[var(--s-xs)]',
        'text-xs',
        'font-medium',
        'rounded-field',
        'transition-all',
        'duration-[var(--d-fast)]',
        'ease-[var(--ease-out)]',
        'bg-run-bg',
        'hover:bg-run-bg-hover',
        'text-run-fg',
        'disabled:opacity-50',
        'disabled:cursor-not-allowed',
      ].join(' ')}
    >
      {okText}
    </button>
  );

  return (
    <Dialog open={open} onClose={onConfirm} title={title} footer={footer}>
      <p className="text-sm text-text-primary">{message}</p>
    </Dialog>
  );
}
