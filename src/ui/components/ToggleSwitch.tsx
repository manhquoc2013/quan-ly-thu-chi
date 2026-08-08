/** Accessible on/off switch with clear active vs inactive track colors in light & dark. */

interface ToggleSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  'aria-label'?: string;
  disabled?: boolean;
}

export function ToggleSwitch({
  checked,
  onCheckedChange,
  'aria-label': ariaLabel,
  disabled,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-input-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked
          ? 'bg-accent-fg'
          : 'bg-neutral-bg ring-1 ring-inset ring-border',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none inline-block size-4 rounded-full shadow-sm transition-transform',
          checked
            ? 'translate-x-4 bg-white'
            : 'translate-x-0.5 bg-surface',
        ].join(' ')}
      />
    </button>
  );
}
