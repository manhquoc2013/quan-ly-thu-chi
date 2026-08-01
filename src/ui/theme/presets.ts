// src/ui/theme/presets.ts
// Style presets dùng với Tailwind class — tương tự FeControlTokens

export const buttonPresets = {
  run: { className: 'bg-run-bg hover:bg-run-bg-hover text-run-fg' },
  danger: { className: 'bg-danger-fg hover:bg-danger-fg-hover text-white' },
  neutral: { className: 'bg-neutral-bg hover:bg-neutral-bg-hover text-neutral-fg' },
  accent: { className: 'bg-accent-bg hover:bg-accent-bg-hover text-accent-fg' },
} as const;

export const panelPresets = {
  solid: { className: 'bg-surface border border-border rounded-panel' },
  translucent: { className: 'bg-surface/80 backdrop-blur-sm border border-border-subtle rounded-panel' },
} as const;

export const badgePresets = {
  success: 'bg-badge-online-bg text-badge-online-fg',
  warning: 'bg-badge-warning-bg text-badge-warning-fg',
  error: 'bg-badge-error-bg text-badge-error-fg',
  neutral: 'bg-badge-offline-bg text-badge-offline-fg',
  accent: 'bg-accent-bg text-accent-fg',
} as const;

export const statusPresets = {
  paid: badgePresets.success, pending: badgePresets.warning, cancelled: badgePresets.error,
  completed: badgePresets.success, processing: badgePresets.accent, new: badgePresets.neutral,
} as const;
