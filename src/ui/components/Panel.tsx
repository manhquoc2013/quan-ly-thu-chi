/**
 * Panel — Content wrapper with optional title bar and style variants.
 *
 * Usage:
 *   <Panel title="Expenses" icon={DollarSign}>
 *     <ExpenseList />
 *   </Panel>
 *   <Panel style="translucent" title="Summary" titleTrailing={<Badge>Active</Badge>}>
 *     <Chart />
 *   </Panel>
 */

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { panelPresets } from '@ui/theme/presets';

export interface PanelProps {
  title?: string;
  icon?: LucideIcon;
  titleTrailing?: ReactNode;
  style?: 'solid' | 'translucent';
  className?: string;
  children: ReactNode;
}

export function Panel({
  title,
  icon: Icon,
  titleTrailing,
  style = 'solid',
  className,
  children,
}: PanelProps) {
  const preset =
    style === 'translucent' ? panelPresets.translucent : panelPresets.solid;

  return (
    <div
      className={[
        preset.className,
        'p-[var(--s-lg)]',
        className ?? '',
      ].join(' ')}
    >
      {(title || titleTrailing) && (
        <div className="flex items-center justify-between mb-[var(--s-sm)]">
          <div className="flex items-center gap-[var(--s-xs)]">
            {Icon && (
              <Icon size={16} className="text-accent-fg" aria-hidden="true" />
            )}
            {title && (
              <h3 className="text-sm font-semibold text-text-secondary">
                {title}
              </h3>
            )}
          </div>
          {titleTrailing}
        </div>
      )}
      {children}
    </div>
  );
}
