/**
 * StatusBar — Bottom status strip showing sync state.
 *
 * Usage:
 *   <StatusBar syncStatus="synced" lastSync="2 min ago" />
 *
 * Renders a colored dot + status text + optional last-sync timestamp.
 * Uses CSS variables for all colors.
 */

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'offline';

export interface StatusBarProps {
  /** Current synchronization state. */
  syncStatus: SyncStatus;
  /** Optional human-readable last-sync time (e.g. "2 min ago"). */
  lastSync?: string;
  /** Optional class names appended to the root element. */
  className?: string;
}

const statusConfig: Record<
  SyncStatus,
  { label: string; dotColor: string }
> = {
  synced: {
   label: 'Synced',
    dotColor: 'var(--color-success-fg)',
 },
 syncing: {
   label: 'Syncing…',
    dotColor: 'var(--color-accent-fg)',
 },
 error: {
   label: 'Sync error',
    dotColor: 'var(--color-danger-fg)',
 },
 offline: {
   label: 'Offline',
    dotColor: 'var(--color-text-muted)',
  },
};

export function StatusBar({
  syncStatus,
  lastSync,
  className = '',
}: StatusBarProps) {
  const config = statusConfig[syncStatus];

  return (
    <div
      className={[
        'flex',
        'items-center',
        'gap-[var(--s-sm)]',
        'h-8',
        'px-[var(--s-md)]',
        'bg-surface',
        'border-t',
        'border-border',
        'text-xs',
        'text-text-muted',
        className,
      ].join(' ')}
      role="status"
      aria-live="polite"
      aria-label={`Sync status: ${config.label}`}
    >
      {/* Colored indicator dot */}
      <span
        className="inline-block size-1.5 rounded-full shrink-0"
        style={{ backgroundColor: config.dotColor }}
        aria-hidden="true"
      />
      {/* Status label */}
      <span>{config.label}</span>
      {/* Optional last-sync time */}
      {lastSync && (
        <span className="text-text-disabled">
          · {lastSync}
        </span>
      )}
    </div>
  );
}
