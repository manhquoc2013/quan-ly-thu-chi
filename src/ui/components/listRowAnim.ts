import type { CSSProperties } from 'react';

/** Staggered enter animation for list/table rows. */
export function listRowStyle(index: number): CSSProperties {
  return { ['--row-i' as string]: index } as CSSProperties;
}

export const LIST_ROW_ANIM = 'animate-list-row';
