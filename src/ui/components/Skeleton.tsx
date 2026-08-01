/**
 * Skeleton — Animated loading skeleton placeholder.
 *
 * Usage:
 *   <Skeleton variant="text" />
 *   <Skeleton variant="rect" width="200px" height="120px" />
 *   <Skeleton variant="circle" />
 */

import type { CSSProperties, ComponentType, JSX } from 'react';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
  as?: ComponentType<{ className?: string; style?: CSSProperties }> | keyof JSX.IntrinsicElements;
}

export function Skeleton({
  width,
  height,
  className = '',
  variant = 'text',
  as: Component = 'div',
}: SkeletonProps) {
  const style: CSSProperties = {};

  if (width !== undefined) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height !== undefined) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <Component
      className={[
        'skeleton-placeholder',
        'inline-block',
        'bg-neutral-bg',
        'animate-pulse',
        variant === 'circle'
          ? 'rounded-full'
          : 'rounded-field',
        className,
      ].join(' ')}
      style={style}
      aria-hidden="true"
      role="presentation"
    />
  );
}
