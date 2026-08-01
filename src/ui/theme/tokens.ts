// src/ui/theme/tokens.ts
// Port từ FeColors + FeSpacing + FeDimens của fe-simulator
// Dùng khi cần giá trị trong JS (chart config, inline styles, canvas...)

export const colors = {
  // Surface
  background:       '#EFF2F7',
  surface:          '#FAFBFC',
  surfaceHover:     '#F1F5F9',
  surfaceActive:    '#E2E8F0',
  border:           '#CBD5E1',
  borderSubtle:     '#E0E3E8',
  borderFocus:      '#1565C0',

  // Text
  textPrimary:      '#333333',
  textSecondary:    '#475569',
  textMuted:        '#64748B',
  textDisabled:     '#94A3B8',
  textInverse:      '#FFFFFF',

  // Accent
  accentBg:         '#E3F2FD',
  accentBgHover:    '#BBDEFB',
  accentFg:         '#1565C0',
  accentFgHover:    '#0D47A1',

  // Secondary
  secondaryBg:      '#E0F2F1',
  secondaryFg:      '#0F766E',

  // Neutral
  neutralBg:        '#ECEFF1',
  neutralBgHover:   '#CFD8DC',
  neutralFg:        '#37474F',

  // Semantic
  success:  { bg: '#ECFDF5', fg: '#065F46', badge: '#D1FAE5' },
  warning:  { bg: '#FEF3C7', fg: '#92400E' },
  danger:   { bg: '#FFEBEE', fg: '#C62828', hover: '#B71C1C' },
  info:     { bg: '#E0F2FE', fg: '#1E3A8A', banner: '#EFF6FF' },

  // Button variants
  run:        { bg: '#1565C0', fg: '#FFFFFF', hover: '#0D47A1' },
  cancel:     { bg: '#F57C00', fg: '#FFFFFF' },
  disconnect: { bg: '#C62828', fg: '#FFFFFF' },
  neutral:    { bg: '#ECEFF1', fg: '#37474F', hover: '#CFD8DC' },
  accent:     { bg: '#E3F2FD', fg: '#1565C0' },

  // Grid
  grid: {
    headerBg:    '#F1F5F9',
    headerFg:    '#334155',
    rowEven:     '#FFFFFF',
    rowOdd:      '#FAFBFC',
    rowHover:    '#F1F5F9',
    rowSelected: '#E3F2FD',
    divider:     '#E2E8F0',
    statusOk:    '#15803D',
    statusFail:  '#B91C1C',
    statusNeutral: '#64748B',
  },

  // Charts
  chart: [
    '#2563EB', '#7C3AED', '#16A34A', '#D97706',
    '#EC4899', '#14B8A6', '#F97316', '#8B5CF6',
  ],
  chartGrid: '#CBD5E1',

  // Sidebar
  sidebar: {
    bg: '#1E293B',
    fg: '#CBD5E1',
    activeBg: '#334155',
    activeFg: '#FFFFFF',
  },

  // Badges
  badge: {
    online:  { bg: '#D1FAE5', fg: '#065F46' },
    offline: { bg: '#E2E8F0', fg: '#64748B' },
    warning: { bg: '#FEF3C7', fg: '#92400E' },
    error:   { bg: '#FEE2E2', fg: '#B91C1C' },
  },

  // Expense categories (mapped to FR-EXP-006)
  category: {
    office:         '#3B82F6',
    rent:           '#8B5CF6',
    utilities:      '#F59E0B',
    salary:         '#10B981',
    marketing:      '#EC4899',
    supplies:       '#6366F1',
    transportation: '#14B8A6',
    maintenance:    '#F97316',
    tax:            '#EF4444',
    other:          '#6B7280',
  },
} as const;

export const spacing = {
  xs:  4,
  sm:  6,
  md:  8,
  lg:  12,
  xl:  16,
  '2xl': 24,
  '3xl': 32,
} as const;

export const radius = {
  field:  4,
  panel:  6,
  dialog: 8,
  badge:  12,
  full:   9999,
} as const;

export const typography = {
  fontFamily: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },
  fontSize: {
    xs:   11,
    sm:   12,
    base: 13,
    lg:   14,
    xl:   16,
    '2xl': 20,
  },
  fontWeight: {
    normal:   400,
    medium:   500,
    semibold: 600,
    bold:     700,
  },
  lineHeight: {
    xs:   '16px',
    sm:   '18px',
    base: '20px',
    lg:   '22px',
    xl:   '24px',
    '2xl': '28px',
  },
} as const;

export const dimens = {
  formControlHeight: 28,
  fieldLabelLineHeight: 14,
  fieldLabelGap: 2,
  iconSize: 16,
  buttonIconSize: 15,
  checkboxSize: 18,
  badgeRadius: 12,
  dialogWidth: 500,
  dialogElevation: 12,
  pickListMaxHeight: 280,
  chartDefaultHeight: 180,
  sidebarWidth: 220,
  sidebarCollapsedWidth: 56,
  headerHeight: 48,
  statusBarHeight: 32,
  gridRowHeight: 48,
  toolbarHeight: 40,
} as const;

export const shadows = {
  dialog:   '0 8px 30px rgba(0, 0, 0, 0.12)',
  dropdown: '0 4px 12px rgba(0, 0, 0, 0.1)',
  tooltip:  '0 2px 8px rgba(0, 0, 0, 0.15)',
} as const;

export const transitions = {
  fast:   '150ms',
  normal: '200ms',
  slow:   '300ms',
  ease:   'cubic-bezier(0.16, 1, 0.3, 1)',
} as const;
