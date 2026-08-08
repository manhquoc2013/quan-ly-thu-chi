// src/ui/theme/tokens.ts
// Design tokens for JS use (charts, inline styles, canvas, etc.)
// Navy + Teal theme — matches src/index.css @theme block

export const colors = {
  // Surface
  background:       '#F8FAFC',
  surface:          '#FFFFFF',
  surfaceHover:     '#F1F5F9',
  surfaceActive:    '#E2E8F0',
  border:           '#CBD5E1',
  borderSubtle:     '#E0E3E8',
  borderFocus:      '#0D9488',

  // Text
  textPrimary:      '#0F172A',
  textSecondary:    '#334155',
  textMuted:        '#64748B',
  textDisabled:     '#94A3B8',
  textInverse:      '#FFFFFF',

  // Accent — Teal
  accentBg:         '#CCFBF1',
  accentBgHover:    '#99F6E4',
  accentFg:         '#0D9488',
  accentFgHover:    '#0F766E',

  // Secondary
  secondaryBg:      '#CCFBF1',
  secondaryFg:      '#0F766E',

  // Neutral
  neutralBg:        '#F1F5F9',
  neutralBgHover:   '#E2E8F0',
  neutralFg:        '#334155',

  // Semantic
  success:  { bg: '#ECFDF5', fg: '#065F46', badge: '#D1FAE5' },
  warning:  { bg: '#FFFBEB', fg: '#92400E' },
  danger:   { bg: '#FEF2F2', fg: '#DC2626', hover: '#B91C1C' },
  info:     { bg: '#E0F2FE', fg: '#1E3A8A', banner: '#EFF6FF' },

  // Button variants
  run:        { bg: '#0D9488', fg: '#FFFFFF', hover: '#0F766E' },
  cancel:     { bg: '#F59E0B', fg: '#FFFFFF' },
  disconnect: { bg: '#DC2626', fg: '#FFFFFF' },
  neutral:    { bg: '#F1F5F9', fg: '#334155', hover: '#E2E8F0' },
  accent:     { bg: '#CCFBF1', fg: '#0D9488' },

  // Grid
  grid: {
    headerBg:    '#F1F5F9',
    headerFg:    '#334155',
    rowEven:     '#FFFFFF',
    rowOdd:      '#F8FAFC',
    rowHover:    '#F1F5F9',
    rowSelected: '#CCFBF1',
    divider:     '#E2E8F0',
    statusOk:    '#15803D',
    statusFail:  '#DC2626',
    statusNeutral: '#64748B',
  },

  // Charts — warmer tones
  chart: [
    '#0D9488', '#8B5CF6', '#F59E0B', '#EC4899',
    '#3B82F6', '#10B981', '#F97316', '#6366F1',
  ],
  chartGrid: '#CBD5E1',

  // Sidebar
  sidebar: {
    bg: '#0F172A',
    fg: '#CBD5E1',
    activeBg: '#0D9488',
    activeFg: '#FFFFFF',
  },

  // Badges
  badge: {
    online:  { bg: '#D1FAE5', fg: '#065F46' },
    offline: { bg: '#E2E8F0', fg: '#64748B' },
    warning: { bg: '#FEF3C7', fg: '#92400E' },
    error:   { bg: '#FEE2E2', fg: '#DC2626' },
  },

  // Expense categories
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
  field:  6,
  panel:  8,
  dialog: 10,
  badge:  12,
  full:   9999,
} as const;

export const typography = {
  fontFamily: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },
  fontSize: {
    xs:   12,
    sm:   13,
    base: 14,
    lg:   15,
    xl:   17,
    '2xl': 22,
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
  sidebarWidth: 240,
  sidebarCollapsedWidth: 64,
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
