// src/ui/components/ImagePreview.tsx
// Lightbox overlay for viewing images (e.g. invoice photos).
// Click backdrop or press Escape to close.

import { useEffect, useCallback } from 'react';

export interface ImagePreviewProps {
  src: string;
  alt: string;
  open: boolean;
  onClose: () => void;
  className?: string;
}

export function ImagePreview({ src, alt, open, onClose, className = '' }: ImagePreviewProps) {
  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Escape key → close
  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={handleBackdropClick}
      className={[
        'fixed inset-0 z-50 flex items-center justify-center',
        'bg-black/80 transition-opacity',
        className,
      ].join(' ')}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="Close preview"
        className={
          'absolute -top-[var(--s-xl)] -right-[var(--s-xl)] z-10 flex items-center justify-center ' +
          'w-8 h-8 rounded-full ' +
          'bg-surface border border-border ' +
          'text-text-muted hover:text-text-primary hover:bg-surface-hover ' +
          'transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-input-focus-ring'
        }
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Image */}
      <img
        src={src}
        alt={alt}
        className={[
          'max-w-[90vw] max-h-[90vh] object-contain',
          'rounded-dialog',
          'shadow-dialog drag-none',
        ].join(' ')}
        draggable={false}
      />
    </div>
  );
}
