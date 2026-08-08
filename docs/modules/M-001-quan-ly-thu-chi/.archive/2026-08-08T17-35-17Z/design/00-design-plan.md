---
feature-id: null
document: design-plan
last-updated: 2026-08-08
verdict: Pass
waves: 1
---

## Summary

Replace the pastel-blue theme (EFF2F7 bg / 1565C0 accent) with a Navy+Teal palette, replace the top horizontal tab bar with a collapsible vertical sidebar + new top bar, and add a dark mode toggle persisted to localStorage. One frontend developer task — all 11 affected files are UI-only; zero business-logic, store, or service changes. Screens consume CSS variables declared in `src/index.css` @theme block — updating tokens there cascades everywhere.

Key trade-off: CSS-variable–driven theming (zero JS runtime cost for color switching) vs. per-component JS theme objects (more flexible but invasive). CSS variables win because the existing architecture already uses them exclusively (`bg-background`, `text-accent-fg`, etc.), and Tailwind 4's `@custom-variant dark (&:is(.dark *))` is already wired.

---

## System Boundaries

| Service / Module | Responsibility | Owns | Calls | Exposes |
|---|---|---|---|---|
| App shell (`src/App.tsx`) | Dark mode class lifecycle | `.dark` class on `<html>` | localStorage `theme` key | Theme class on documentRoot |
| Layout (`src/ui/Layout.tsx`) | Sidebar + top bar + content area + mobile tabs + FAB + StatusBar | Sidebar collapse state, page title derivation | React Router (`NavLink`), `authStore` (userId, displayName), `uiStore` (toggleFab, fabOpen) | `<Layout />` wrapping `<Outlet />` |
| Theme CSS (`src/index.css`) | Design tokens: colors, typography, spacing, transitions | `@theme` block, `.dark` overrides, `:root` custom properties | None (consumed by Tailwind) | CSS variables consumed by every screen & component |
| Theme JS (`src/ui/theme/tokens.ts`) | JS-accessible color/spacing/type exports for charts & inline styles | `colors`, `spacing`, `radius`, `typography`, `dimens`, `shadows`, `transitions` objects | None | Imported by `DashboardScreen.tsx` (chart colors), `RevenueScreen.tsx`, `StatusBar.tsx` |
| Theme presets (`src/ui/theme/presets.ts`) | Tailwind class strings for button/badge/panel/status variants | `buttonPresets`, `panelPresets`, `badgePresets`, `statusPresets` | None | Imported by component files (buttons, badges) |

**Boundary rule:** Screens (`DashboardScreen`, `ExpenseScreen`, etc.) may reference hardcoded hex colors for chart `fill`/`stroke` props and inline `style` objects. These must be updated to match the new palette but are NOT the theme source of truth — the `@theme` block in `index.css` is canonical.

---

## Integration Model

| Integration | Type | Contract | Notes |
|---|---|---|---|
| Layout → React Router | `<NavLink>` | Same 8 route paths as existing `tabs` array: `/`, `/expense`, `/revenue`, `/customers`, `/products`, `/platforms`, `/report`, `/settings` | No new route paths added; sidebar links mirror current tab routes exactly |
| Layout → authStore | Zustand selector | `useAuthStore(s => s.userId)`, `useAuthStore(s => s.userProfile)` | Read-only — sidebar user avatar + name from `userProfile.displayName` / `userProfile.email` |
| Layout → uiStore | Zustand selector | `useUIStore(s => s.fabOpen)`, `useUIStore(s => s.toggleFab)` | Existing FAB + ChatPanel wiring preserved verbatim |
| App → localStorage | getItem / setItem | Key: `"theme"`, values: `"light"` \| `"dark"` | Read on mount (`useEffect`), applied as `.dark` class toggle on `document.documentElement` |
| CSS → components | Tailwind utility classes | All existing `bg-*`, `text-*`, `border-*` classes remain; new values picked up from updated `@theme` block | Screen-level inline hex colors in chart configs and StatusBar dot must be manually updated |

---

## Data Architecture

### Theme State

| Entity | Storage | Schema | Consistency |
|---|---|---|---|
| Theme preference | `localStorage` key `"theme"` | `"light"` (default) or `"dark"` | Read once on mount; written on every toggle. No sync needed — local-only. |
| Dark mode visual state | CSS `.dark` class on `document.documentElement` | Present/absent | Derived from localStorage on mount; toggled in `App.tsx` useEffect + toggle handler |
| Sidebar collapse state | React `useState<boolean>` in Layout | `true` (expanded, default) | Component-local; resets on page reload. No persistence needed per spec. |

**Dark mode data flow:**
```
mount → read localStorage["theme"] → add/remove .dark on <html>
toggle → flip localStorage["theme"] → add/remove .dark on <html>
CSS .dark { --color-background: #0F172A; ... } → Tailwind utilities resolve new values
```

No Zustand store, no IndexedDB, no API call. Theme is purely a document-level CSS class toggle.

---

## NFR Architecture

| NFR | Solution | Target |
|---|---|---|
| CSS transition smoothness | `transition: background-color var(--d-normal) var(--ease-out), color var(--d-normal) var(--ease-out), border-color var(--d-normal) var(--ease-out)` on `*` inside `.dark-aware` root | No visible flash on theme toggle |
| Sidebar collapse animation | `transition: width var(--d-normal) var(--ease-out)` on sidebar container; `overflow: hidden` during collapse | Smooth 200ms width change |
| Mobile responsiveness | Sidebar hidden on `<768px` (`hidden md:flex`); existing bottom tabs preserved verbatim; top bar simplified (no search bar on mobile) | No layout breakage on narrow viewports |
| FAB positioning | Recalculate `bottom` / `right` offsets to account for new sidebar (desktop) and unchanged StatusBar (all sizes) | FAB remains accessible and not covered by sidebar |
| Font size increase | `--font-size-base: 14px` (from 13px); proportionally scale `sm: 13px`, `lg: 15px`, `xl: 18px`, `2xl: 22px` | Readable text across all screens |
| Dark mode completeness | Every `@theme` color token gets a `.dark` override; shadcn `.dark` variables (oklch) already exist and are preserved | No white-flash or unthemed elements in dark mode |

---

## Key Decisions

| Decision | Chosen | Rejected | Rationale |
|---|---|---|---|
| Theme delivery | CSS variables (@theme + .dark block) | JS theme context or per-component useMemo objects (hypothetical — not used) | Existing architecture already CSS-variable–based (`src/index.css:5` `@custom-variant dark`, `src/index.css:7-75` `@theme` block, `src/index.css:167-191` `.dark` block); zero runtime JS cost |
| Sidebar navigation | `<NavLink to={route}>` with className callback | `<button onClick={navigate}>` with manual active tracking | NavLink provides `isActive` for free; same pattern as current `tabClass` function |
| Dark mode init location | `App.tsx` useEffect (run once on mount) | `Layout.tsx` or a separate ThemeProvider component | App.tsx is the earliest React mount point; avoids flicker from Layout-level init |
| Mobile sidebar | Keep existing bottom tabs; no mobile sidebar | Slide-over drawer sidebar on mobile | Bottom tabs are proven UX on mobile; drawer adds gesture/overlay complexity out of Wave 1 scope |
| Screen chart colors | Manual hex update in DashboardScreen + inline styles | Derive from CSS variables via `getComputedStyle` | Recharts `fill`/`stroke` props take hex strings at render time; JS tokens.ts is the bridge |
| Search input | Visual placeholder only ("Tìm kiếm... ⌘K") | Functional global search | Wave 1 scope is navigation chrome; search implementation is Wave 2+ |

---

## Plan

### Requirement-to-Execution Mapping

| Feature area | Scope | Work order | Owner type |
|---|---|---|---|
| FEAT-1: New Design Tokens | index.css @theme block, tokens.ts, presets.ts | WO-ui-redesign-wave1 | frontend |
| FEAT-2: Sidebar Layout | Layout.tsx rewrite | WO-ui-redesign-wave1 | frontend |
| FEAT-3: New Top Bar | Layout.tsx top bar section | WO-ui-redesign-wave1 | frontend |
| FEAT-4: Dark Mode Toggle | App.tsx useEffect + top bar button | WO-ui-redesign-wave1 | frontend |
| Secondary: screen color updates | 6 screen files (hardcoded colors) | WO-ui-redesign-wave1 | frontend |

### Task Breakdown

| Task | Description | Dependency | Owner type | Wave | Parallelizable |
|---|---|---|---|---|---|
| WO-ui-redesign-wave1 | Full Wave 1 UI redesign: theme tokens, sidebar, top bar, dark mode, screen color updates | None | frontend | 1 | — |

### Work Orders

#### WO-ui-redesign-wave1

- **goal:** All 11 source files updated: new Navy+Teal theme in CSS + JS tokens, vertical collapsible sidebar replacing top tab bar, new 56px top bar with search/dark-mode/bell, dark mode toggle persisted to localStorage, and secondary screen color updates. All 8 routes navigable via sidebar. `bun run typecheck` and `bun run build` pass with zero errors.
- **assignee-role:** engineering-frontend-developer
- **complexity:** novel
- **files:**
  - `src/index.css:1-253` — replace `@theme` block with Navy+Teal tokens, add `.dark` overrides for all custom color tokens, increase font sizes, add transition utilities
  - `src/ui/theme/tokens.ts:1-180` — update `colors` object (all surface/text/accent/semantic/sidebar/chart entries) to Navy+Teal palette; add `dark` mirror object
  - `src/ui/theme/presets.ts:1-27` — update class strings (button/badge/panel presets reference color tokens by Tailwind utility name — these resolve automatically from updated `@theme` block; verify no hardcoded hex)
  - `src/ui/Layout.tsx:1-269` — major rewrite: sidebar (vertical, collapsible, 240px/64px) + top bar (56px) + content area; preserve mobile bottom tabs, FAB, ChatPanel, StatusBar, sync/clock/bootstrap logic
  - `src/App.tsx:1-78` — add `useEffect` on mount: read localStorage `"theme"`, apply `.dark` class; add a `toggleTheme` function passed down or lifted; wrap in a minimal theme context or prop-drill
  - `src/ui/components/StatusBar.tsx:1-89` — update `statusConfig` dot colors (`dotColor` hex values) to Navy+Teal palette
  - `src/ui/screens/dashboard/DashboardScreen.tsx:1-432` — update chart `fill`/`stroke` hex values and Tooltip `contentStyle` to new palette
  - `src/ui/screens/expense/ExpenseScreen.tsx:1-140` — verify no hardcoded colors (all use CSS utility classes → auto-resolve)
  - `src/ui/screens/revenue/RevenueScreen.tsx:1-250` — verify no hardcoded colors; update any inline style colors
  - `src/ui/screens/report/ReportScreen.tsx:1-110` — verify no hardcoded colors
  - `src/ui/screens/settings/SettingsScreen.tsx:1-700` — verify no hardcoded colors beyond what exists; SettingsScreen is large but already uses CSS utility classes

- **contracts:**

  **Canonical theme tokens** — `design/00-design-plan.md#data-architecture` (theme state) and `design/00-design-plan.md#key-decisions` (CSS-variable approach).

  **`src/index.css` — `@theme` block TO-BE:**

  Replace the entire `@theme { ... }` block (lines 7-75) with:

  ```css
  @theme {
    /* ── Surface palette ─────────────────────────────── */
    --color-background: #F8FAFC;
    --color-surface: #FFFFFF;
    --color-surface-hover: #F1F5F9;
    --color-surface-active: #E2E8F0;
    --color-border: #E2E8F0;
    --color-border-subtle: #E2E8F0;
    --color-border-focus: #0D9488;

    /* ── Text ────────────────────────────────────────── */
    --color-text-primary: #0F172A;
    --color-text-secondary: #475569;
    --color-text-muted: #64748B;
    --color-text-disabled: #94A3B8;
    --color-text-inverse: #FFFFFF;

    /* ── Accent (Teal) ────────────────────────────────── */
    --color-accent-bg: #CCFBF1;
    --color-accent-bg-hover: #99F6E4;
    --color-accent-fg: #0D9488;
    --color-accent-fg-hover: #0F766E;

    /* ── Semantic ─────────────────────────────────────── */
    --color-success-bg: #ECFDF5;
    --color-success-bg-badge: #D1FAE5;
    --color-success-fg: #065F46;
    --color-warning-bg: #FEF3C7;
    --color-warning-fg: #92400E;
    --color-danger-bg: #FEE2E2;
    --color-danger-fg: #DC2626;
    --color-danger-fg-hover: #B91C1C;

    /* ── Input ────────────────────────────────────────── */
    --color-input-bg: #FFFFFF;
    --color-input-border: #CBD5E1;
    --color-input-focus-ring: #0D9488;
    --color-input-placeholder: #94A3B8;
    --color-input-disabled-bg: #F1F5F9;

    /* ── Tooltip ──────────────────────────────────────── */
    --color-tooltip-bg: #1E293B;
    --color-tooltip-fg: #F8FAFC;

    /* ── Neutral ──────────────────────────────────────── */
    --color-neutral-bg: #F1F5F9;
    --color-neutral-bg-hover: #E2E8F0;
    --color-neutral-fg: #334155;

    /* ── Button: run (primary CTA) ────────────────────── */
    --color-run-bg: #0D9488;
    --color-run-bg-hover: #0F766E;
    --color-run-fg: #FFFFFF;

    /* ── Info ─────────────────────────────────────────── */
    --color-info-bg: #E0F2FE;
    --color-info-fg: #1E3A8A;
    --color-info-banner: #EFF6FF;

    /* ── Grid ─────────────────────────────────────────── */
    --color-grid-header-bg: #F1F5F9;
    --color-grid-header-fg: #334155;
    --color-grid-row-even: #FFFFFF;
    --color-grid-row-odd: #F8FAFC;
    --color-grid-row-hover: #F1F5F9;
    --color-grid-row-selected: #CCFBF1;

    /* ── Badges ────────────────────────────────────────── */
    --color-badge-online-bg: #D1FAE5;
    --color-badge-online-fg: #065F46;
    --color-badge-offline-bg: #E2E8F0;
    --color-badge-offline-fg: #64748B;
    --color-badge-warning-bg: #FEF3C7;
    --color-badge-warning-fg: #92400E;
    --color-badge-error-bg: #FEE2E2;
    --color-badge-error-fg: #B91C1C;

    /* ── Scrollbar ────────────────────────────────────── */
    --color-scrollbar-thumb: #94A3B8;
    --color-scrollbar-track: transparent;

    /* ── Radius ───────────────────────────────────────── */
    --radius-field: 6px;
    --radius-panel: 8px;
    --radius-dialog: 12px;
    --radius-badge: 12px;
    --radius-full: 9999px;

    /* ── Font sizes (bumped: base 14px) ──────────────── */
    --font-size-xs: 11px;
    --font-size-sm: 13px;
    --font-size-base: 14px;
    --font-size-lg: 15px;
    --font-size-xl: 18px;
    --font-size-2xl: 22px;

    /* ── Shadows ──────────────────────────────────────── */
    --shadow-dialog: 0 8px 30px rgba(0, 0, 0, 0.12);
    --shadow-dropdown: 0 4px 12px rgba(0, 0, 0, 0.1);
    --shadow-tooltip: 0 2px 8px rgba(0, 0, 0, 0.15);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    --animate-dialog-in: dialog-in var(--d-normal) var(--ease-out) forwards;
  }
  ```

  **`src/index.css` — `.dark` block additions** (insert after the existing shadcn `.dark { ... }` block at lines 167-191):

  ```css
  .dark {
    /* ── Custom theme tokens — dark overrides ─────────── */
    --color-background: #0F172A;
    --color-surface: #1E293B;
    --color-surface-hover: #334155;
    --color-surface-active: #475569;
    --color-border: #334155;
    --color-border-subtle: #1E293B;
    --color-border-focus: #0D9488;

    --color-text-primary: #F1F5F9;
    --color-text-secondary: #94A3B8;
    --color-text-muted: #64748B;
    --color-text-disabled: #475569;
    --color-text-inverse: #0F172A;

    --color-accent-bg: #134E4A;
    --color-accent-bg-hover: #115E59;
    --color-accent-fg: #2DD4BF;
    --color-accent-fg-hover: #5EEAD4;

    --color-success-bg: #064E3B;
    --color-success-bg-badge: #065F46;
    --color-success-fg: #6EE7B7;
    --color-warning-bg: #78350F;
    --color-warning-fg: #FCD34D;
    --color-danger-bg: #7F1D1D;
    --color-danger-fg: #FCA5A5;
    --color-danger-fg-hover: #F87171;

    --color-input-bg: #1E293B;
    --color-input-border: #475569;
    --color-input-focus-ring: #0D9488;
    --color-input-placeholder: #64748B;
    --color-input-disabled-bg: #334155;

    --color-tooltip-bg: #F1F5F9;
    --color-tooltip-fg: #0F172A;

    --color-neutral-bg: #334155;
    --color-neutral-bg-hover: #475569;
    --color-neutral-fg: #CBD5E1;

    --color-run-bg: #0D9488;
    --color-run-bg-hover: #0F766E;
    --color-run-fg: #FFFFFF;

    --color-info-bg: #1E3A8A;
    --color-info-fg: #93C5FD;
    --color-info-banner: #172554;

    --color-grid-header-bg: #1E293B;
    --color-grid-header-fg: #CBD5E1;
    --color-grid-row-even: #1E293B;
    --color-grid-row-odd: #0F172A;
    --color-grid-row-hover: #334155;
    --color-grid-row-selected: #134E4A;

    --color-badge-online-bg: #065F46;
    --color-badge-online-fg: #6EE7B7;
    --color-badge-offline-bg: #475569;
    --color-badge-offline-fg: #94A3B8;
    --color-badge-warning-bg: #78350F;
    --color-badge-warning-fg: #FCD34D;
    --color-badge-error-bg: #7F1D1D;
    --color-badge-error-fg: #FCA5A5;

    --color-scrollbar-thumb: #475569;
    --color-scrollbar-track: transparent;
  }
  ```

  **Add smooth color transitions** — insert after the `@theme inline { ... }` block at line ~203, inside the base layer or as a standalone rule:

  ```css
  html {
    transition: background-color var(--d-normal) var(--ease-out),
                color var(--d-normal) var(--ease-out);
  }
  html *, html *::before, html *::after {
    transition: background-color var(--d-normal) var(--ease-out),
                color var(--d-fast) var(--ease-out),
                border-color var(--d-normal) var(--ease-out);
  }
  ```

  **`src/ui/theme/tokens.ts` — `colors` object TO-BE:**

  Replace the existing `colors` export with new hex values matching the CSS `@theme` light-mode tokens above. Add a `colorsDark` export for JS consumers that need dark-mode–aware values (charts, StatusBar dot):

  ```ts
  export const colors = {
    background:       '#F8FAFC',
    surface:          '#FFFFFF',
    surfaceHover:     '#F1F5F9',
    surfaceActive:    '#E2E8F0',
    border:           '#E2E8F0',
    borderSubtle:     '#E2E8F0',
    borderFocus:      '#0D9488',

    textPrimary:      '#0F172A',
    textSecondary:    '#475569',
    textMuted:        '#64748B',
    textDisabled:     '#94A3B8',
    textInverse:      '#FFFFFF',

    accentBg:         '#CCFBF1',
    accentBgHover:    '#99F6E4',
    accentFg:         '#0D9488',
    accentFgHover:    '#0F766E',

    secondaryBg:      '#F0FDFA',
    secondaryFg:      '#0F766E',

    neutralBg:        '#F1F5F9',
    neutralBgHover:   '#E2E8F0',
    neutralFg:        '#334155',

    success:  { bg: '#ECFDF5', fg: '#065F46', badge: '#D1FAE5' },
    warning:  { bg: '#FEF3C7', fg: '#92400E' },
    danger:   { bg: '#FEE2E2', fg: '#DC2626', hover: '#B91C1C' },
    info:     { bg: '#E0F2FE', fg: '#1E3A8A', banner: '#EFF6FF' },

    run:        { bg: '#0D9488', fg: '#FFFFFF', hover: '#0F766E' },
    cancel:     { bg: '#F59E0B', fg: '#FFFFFF' },
    disconnect: { bg: '#DC2626', fg: '#FFFFFF' },
    neutral:    { bg: '#F1F5F9', fg: '#334155', hover: '#E2E8F0' },
    accent:     { bg: '#CCFBF1', fg: '#0D9488' },

    grid: {
      headerBg:    '#F1F5F9',
      headerFg:    '#334155',
      rowEven:     '#FFFFFF',
      rowOdd:      '#F8FAFC',
      rowHover:    '#F1F5F9',
      rowSelected: '#CCFBF1',
      divider:     '#E2E8F0',
      statusOk:    '#059669',
      statusFail:  '#DC2626',
      statusNeutral: '#64748B',
    },

    chart: [
      '#0D9488', '#6366F1', '#F59E0B', '#EC4899',
      '#14B8A6', '#8B5CF6', '#F97316', '#3B82F6',
    ],
    chartGrid: '#E2E8F0',

    sidebar: {
      bg: '#1E293B',
      fg: '#CBD5E1',
      activeBg: '#0D9488',
      activeFg: '#FFFFFF',
      hoverBg: '#334155',
    },

    badge: {
      online:  { bg: '#D1FAE5', fg: '#065F46' },
      offline: { bg: '#E2E8F0', fg: '#64748B' },
      warning: { bg: '#FEF3C7', fg: '#92400E' },
      error:   { bg: '#FEE2E2', fg: '#B91C1C' },
    },

    category: {
      office:         '#0D9488',
      rent:           '#8B5CF6',
      utilities:      '#F59E0B',
      salary:         '#059669',
      marketing:      '#EC4899',
      supplies:       '#6366F1',
      transportation: '#14B8A6',
      maintenance:    '#F97316',
      tax:            '#DC2626',
      other:          '#64748B',
    },
  } as const;
  ```

  Also update `typography.fontSize.base` from `13` to `14`, and scale other sizes accordingly: `sm: 13, lg: 15, xl: 18, '2xl': 22`. Update `dimens.sidebarWidth` to `240` and `dimens.sidebarCollapsedWidth` to `64`. Update `dimens.headerHeight` to `56`.

  **`src/ui/Layout.tsx` — TO-BE structure:**

  ```tsx
  import { useEffect, useState } from 'react';
  import type { ReactNode } from 'react';
  import { Outlet, NavLink, useLocation } from 'react-router-dom';
  import {
    LayoutDashboard, Receipt, Coins, BarChart3, Settings,
    Bot, Users, Package, Store, Menu, X, Sun, Moon, Bell, Search
  } from 'lucide-react';
  import { useUIStore } from '@store/uiStore';
  import { useAuthStore } from '@/store/authStore';
  import { ChatPanel } from '@screens/ai/ChatPanel';
  import { MascotOverlay } from '@/ui/components/MascotOverlay';
  import { bootstrapAppData } from '@/services/bootstrap';
  import { webLLM } from '@/services/webLLM';
  import { kiloService } from '@/services/kiloService';
  import { pendingCount } from '@/services/syncOutbox';
  import { flushOutbox } from '@/services/syncEngine';

  const menuItems = [
    { label: 'Tổng quan',  route: '/',           tab: 'dashboard'  as const, icon: LayoutDashboard },
    { label: 'Chi phí',    route: '/expense',     tab: 'expense'    as const, icon: Receipt          },
    { label: 'Doanh thu',  route: '/revenue',     tab: 'revenue'    as const, icon: Coins            },
    { label: 'Khách',      route: '/customers',   tab: 'customers'  as const, icon: Users            },
    { label: 'SP',         route: '/products',    tab: 'products'   as const, icon: Package          },
    { label: 'Kênh',       route: '/platforms',   tab: 'platforms'  as const, icon: Store            },
    { label: 'Báo cáo',    route: '/report',      tab: 'report'     as const, icon: BarChart3         },
    { label: 'Cài đặt',    route: '/settings',    tab: 'settings'   as const, icon: Settings          },
  ];

  const mobileTabIcons: Record<string, ReactNode> = {
    dashboard:  <LayoutDashboard size={18} />,
    expense:    <Receipt size={18} />,
    revenue:    <Coins size={18} />,
    customers:  <Users size={18} />,
    products:   <Package size={18} />,
    platforms:  <Store size={18} />,
    report:     <BarChart3 size={18} />,
    settings:   <Settings size={18} />,
  };

  export function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const location = useLocation();
    const fabOpen = useUIStore((s) => s.fabOpen);
    const toggleFab = useUIStore((s) => s.toggleFab);
    const userId = useAuthStore((s) => s.userId);
    const userProfile = useAuthStore((s) => s.userProfile);
    const [clock, setClock] = useState('');
    const [syncState, setSyncState] = useState<'synced' | 'syncing' | 'offline' | 'pending'>('synced');
    const [pending, setPending] = useState(0);
    const [dataReady, setDataReady] = useState(false);
    const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

    // Theme toggle — syncs with App.tsx localStorage + class
    const toggleTheme = () => {
      const next = !dark;
      setDark(next);
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem('theme', next ? 'dark' : 'light');
    };

    // Find active page title from menuItems
    const activeItem = menuItems.find((m) => {
      if (m.route === '/') return location.pathname === '/';
      return location.pathname.startsWith(m.route);
    });
    const pageTitle = activeItem?.label ?? '';

    // (preserve ALL existing useEffect hooks for bootstrap, sync, clock, webLLM, kiloService — lines 77-145 of current Layout.tsx verbatim)

    const sidebarW = sidebarOpen ? 240 : 64;

    return (
      <div className="flex h-screen bg-background min-w-0 overflow-hidden">
        {/* ── Sidebar (desktop only) ─────────────────── */}
        <aside
          className="hidden md:flex flex-col shrink-0 overflow-hidden border-r border-border"
          style={{
            width: sidebarW,
            minWidth: sidebarW,
            background: '#1E293B', // sidebar always dark — matches preview design
            transition: 'width var(--d-normal) var(--ease-out)',
          }}
        >
          {/* Logo */}
          <div className="flex items-center gap-[var(--s-sm)] px-4 h-14 border-b border-[#334155] shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                 style={{ background: 'linear-gradient(135deg, #0D9488, #14B8A6)' }}>
              T
            </div>
            {sidebarOpen && (
              <span className="text-[#F1F5F9] font-bold text-sm whitespace-nowrap">Thu Chi</span>
            )}
          </div>

          {/* Menu */}
          <nav className="flex-1 overflow-y-auto p-2 scrollbar-thin">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.route}
                  to={item.route}
                  end={item.route === '/'}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-[var(--s-sm)] rounded-lg mb-0.5 transition-colors duration-[var(--d-fast)]',
                      sidebarOpen ? 'px-3 py-2' : 'justify-center p-2',
                      isActive
                        ? 'text-white'
                        : 'text-[#CBD5E1] hover:bg-[#334155]',
                    ].join(' ')
                  }
                  style={({ isActive }) =>
                    isActive ? { background: '#0D9488' } : undefined
                  }
                >
                  <Icon size={18} className="shrink-0" />
                  {sidebarOpen && <span className="flex-1 text-left text-[13px] font-medium whitespace-nowrap">{item.label}</span>}
                </NavLink>
              );
            })}
          </nav>

          {/* User */}
          <div className="p-3 border-t border-[#334155] flex items-center gap-[var(--s-sm)] shrink-0">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0"
                 style={{ background: 'linear-gradient(135deg, #0D9488, #F59E0B)' }}>
              {userProfile?.displayName?.charAt(0)?.toUpperCase() ?? 'U'}
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <p className="text-[#F1F5F9] text-xs font-medium truncate">{userProfile?.displayName ?? 'Người dùng'}</p>
                <p className="text-[#94A3B8] text-[10px] truncate">{userProfile?.email ?? ''}</p>
              </div>
            )}
          </div>
        </aside>

        {/* ── Main content area ──────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* ── Top Bar ───────────────────────────────── */}
          <header className="shrink-0 flex items-center gap-3 px-4 h-14 bg-surface border-b border-border z-20">
            {/* Sidebar toggle (desktop) */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden md:flex text-text-secondary hover:text-text-primary p-1 rounded-md transition-colors"
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            {/* Page title + greeting */}
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-text-primary truncate">{pageTitle}</h1>
              <p className="text-[11px] text-text-muted truncate">
                Xin chào, {userProfile?.displayName ?? 'bạn'} 👋
              </p>
            </div>

            {/* Search (desktop only placeholder) */}
            <div className="hidden md:flex items-center gap-1 bg-background border border-border rounded-lg px-[var(--s-sm)] py-1">
              <Search size={14} className="text-text-muted" />
              <span className="text-xs text-text-muted">Tìm kiếm... ⌘K</span>
            </div>

            {/* Dark mode toggle */}
            <button
              onClick={toggleTheme}
              className="text-text-secondary hover:text-text-primary p-1.5 rounded-md transition-colors"
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Notification bell */}
            <button className="text-text-secondary hover:text-text-primary p-1.5 rounded-md transition-colors relative"
                    aria-label="Notifications">
              <Bell size={16} />
              <span className="absolute top-1 right-1 w-[7px] h-[7px] rounded-full bg-[#DC2626] border-2 border-surface" />
            </button>
          </header>

          {/* ── Content Area ──────────────────────────── */}
          <main className="flex-1 overflow-y-auto min-h-0">
            <div className="max-w-6xl mx-auto w-full p-[var(--s-md)] md:p-[var(--s-xl)] min-w-0 pb-[calc(var(--dimens-fabClearance)+0.5rem)]">
              <Outlet />
            </div>
          </main>

          {/* ── Mobile Bottom Tabs ────────────────────── */}
          <nav className="md:hidden flex items-center justify-around h-14 bg-surface border-t border-border px-1 shrink-0"
               aria-label="Primary tabs (mobile)">
            {menuItems.map((item) => {
              const IconEl = mobileTabIcons[item.tab];
              return (
                <NavLink
                  key={item.route}
                  to={item.route}
                  end={item.route === '/'}
                  className={({ isActive }) =>
                    [
                      'flex flex-col items-center gap-0.5 flex-1 py-1 text-[10px] font-medium transition-colors duration-[var(--d-fast)]',
                      isActive ? 'text-accent-fg' : 'text-text-muted',
                    ].join(' ')
                  }
                >
                  {IconEl}
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* ── Bottom Status Bar ──────────────────────── */}
          <div className="flex items-center justify-between px-[var(--s-md)] h-[var(--dimens-statusBarHeight)] bg-surface border-t border-border text-[10px] text-text-muted shrink-0 pb-[env(safe-area-inset-bottom,0px)]">
            <span>© 2026 Quản Lý Tài Chính</span>
            <span>v1.1.0</span>
          </div>
        </div>

        {/* ── FAB — AI Chat Toggle ────────────────────── */}
        <button
          type="button"
          onClick={toggleFab}
          className="fixed z-40 flex items-center justify-center size-12 text-2xl rounded-full shadow-xl bg-[#0D9488] hover:bg-[#0F766E] text-white transition-all duration-[var(--d-fast)] hover:scale-110 bottom-[calc(var(--dimens-statusBarHeight)+3.5rem+0.75rem)] right-4 md:bottom-[calc(var(--dimens-statusBarHeight)+0.75rem)] md:right-6"
          aria-label="Toggle AI chat"
        >
          <span className="absolute inset-[-4px] rounded-full border-2 border-[#0D9488] opacity-0 animate-[fabPulse_2s_infinite]" />
          <Bot size={20} />
        </button>

        {/* ── AI Chat Panel ──────────────────────────── */}
        {fabOpen && <ChatPanel />}

        {/* ── Mascot Overlay ──────────────────────────── */}
        <MascotOverlay />
      </div>
    );
  }
  ```

  **Key Layout contract details:**
  - Sidebar: always `#1E293B` background (dark navy, consistent with preview design `redesign-preview.json`). Not theme-reactive — sidebar stays dark in both modes.
  - Top bar: `bg-surface` + `border-b border-border` — theme-reactive via CSS variables.
  - Mobile bottom tabs: preserve existing structure EXACTLY — same `NavLink` pattern, same `mobileTabClass` styling, just update the tab list source to `menuItems`.
  - FAB: hardcoded teal (#0D9488) to match sidebar accent — visually pop in both modes.
  - All existing `useEffect` hooks (bootstrap, WebLLM, Kilo, clock, sync) preserved verbatim from current Layout.tsx.
  - `bootstrapAppData`, `webLLM.setDisabled`, `kiloService.setEnabled/configure`, `pendingCount`, `flushOutbox` — ALL imports and usages preserved.

  **`src/App.tsx` — dark mode init:**

  Add this `useEffect` INSIDE the `App` function component, BEFORE the `return`:

  ```tsx
  // Dark mode init — read persisted preference on mount
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (stored === 'light') {
      document.documentElement.classList.remove('dark');
    }
    // If no stored preference, respect OS preference (optional — default light)
  }, []);
  ```

  This is the ONLY change to App.tsx. All other App.tsx content (BrowserRouter, AuthProvider, Suspense, Routes, Toaster) stays exactly as-is.

  **Secondary screen updates:**

  Each screen file needs a targeted audit for hardcoded colors — update hex values to match the new Navy+Teal palette:

  - **`src/ui/components/StatusBar.tsx` line 25-42** — `statusConfig` object: update `dotColor` values:
    - `synced: '#059669'` (new success green), `syncing: '#0D9488'` (teal), `error: '#DC2626'` (red), `offline: '#64748B'` (muted)
  - **`src/ui/screens/dashboard/DashboardScreen.tsx`** — hardcoded chart colors:
    - Lines 198-199: BarChart `fill="#059669"` → `fill="#0D9488"` (thu, teal), `fill="#DC2626"` → `fill="#F59E0B"` (chi, amber)
    - Lines 197: CartesianGrid `stroke="#E0E3E8"` → `stroke="#E2E8F0"`
    - Lines 193: YAxis `fill="#64748B"` — likely fine (muted text color stays similar)
    - Lines 203-211: Tooltip `contentStyle`: update `background`, `border`, `color`, `boxShadow` to new tokens
  - **`src/ui/screens/expense/ExpenseScreen.tsx`** — uses CSS utility classes exclusively → auto-resolves from updated @theme block; NO manual changes needed
  - **`src/ui/screens/revenue/RevenueScreen.tsx`** — uses CSS utility classes; verify no inline hex colors beyond what already exists
  - **`src/ui/screens/report/ReportScreen.tsx`** — uses CSS utility classes exclusively → auto-resolves
  - **`src/ui/screens/settings/SettingsScreen.tsx`** — uses CSS utility classes + shadcn components → auto-resolves from updated @theme block

- **conventions:**
  - **CSS is canonical.** All theme changes flow from `src/index.css` @theme block. The JS tokens (`tokens.ts`) and presets (`presets.ts`) are DERIVED copies for JS consumers (charts, inline styles). When colors differ between CSS and JS tokens, the CSS is the source of truth.
  - **Preserve all existing logic.** The Layout.tsx rewrite MUST carry forward every existing `useEffect` hook (bootstrap, WebLLM, Kilo, clock, sync) verbatim. No logic may be dropped or refactored — this is a presentation-only change.
  - **Sidebar uses `NavLink` with `isActive` callback.** The sidebar active state is derived from React Router's `NavLink` className/isActive callback — no manual `useLocation` matching needed for individual items (though `useLocation` is still imported for pageTitle derivation).
  - **Sidebar background is fixed `#1E293B`**, not theme-reactive. This matches the preview design where the sidebar is always dark navy, contrasting against the main content area which changes light/dark.
  - **FAB color is fixed `#0D9488` (teal).** Matches sidebar accent — visually consistent in both modes.
  - **Tailwind 4 `@custom-variant dark (&:is(.dark *))`** is already wired at `src/index.css:5` and resolves automatically from the `.dark` class on `<html>`. No additional Tailwind config needed.
  - **Do NOT import or create a ThemeProvider.** The dark mode mechanic is: App.tsx reads localStorage + sets class, Layout.tsx toggle button flips it. No React context needed — this is the simplest path.
  - **All existing route paths, store selectors, and service calls are preserved exactly.** The Layout rewrite changes ONLY the presentation structure (sidebar + top bar replacing top nav), not the data wiring.

- **acceptance:**
  - Sidebar navigation: all 8 routes accessible and active-state highlighted
  - Dark mode toggle: switches themes correctly, persisted to localStorage, survives page reload
  - Mobile bottom tabs: still work on <768px screens, all 8 tabs navigable
  - Sidebar collapse/expand: smooth 200ms transition on desktop
  - All existing screens render without visual breakage
  - FAB + ChatPanel still functional
  - StatusBar still visible at bottom
  - Sync/clock/bootstrap logic still running

- **verify:**
  - `cd /Users/tranquoc/Developer/quan-ly-thu-chi && npx tsc --noEmit -p tsconfig.json`
  - `cd /Users/tranquoc/Developer/quan-ly-thu-chi && npx vite build`

- **done-when:** `tsc --noEmit` exits 0, `vite build` succeeds, manual visual check: sidebar navigates all 8 routes, dark mode toggles and persists, mobile bottom tabs work, sidebar collapses/expands smoothly.

---

### Execution Sequence

```
Wave 1 ── WO-ui-redesign-wave1 (frontend, single developer)
```

Single-wave, single-developer execution. All 11 files are in the same `src/ui/` and `src/` directories with no cross-module dependencies. File editing order within the task:

1. **`src/index.css`** first — establishes the new theme tokens; all other files consume these
2. **`src/ui/theme/tokens.ts`** + **`src/ui/theme/presets.ts`** — JS token mirrors
3. **`src/App.tsx`** — dark mode init (independent of Layout rewrite)
4. **`src/ui/Layout.tsx`** — rewrite with sidebar + top bar (consumes new theme)
5. **Secondary screens** (StatusBar, DashboardScreen, etc.) — hardcoded color updates

The developer edits all files in one session, then runs verification commands once.

---

### Implementation Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Screen visual breakage from hardcoded hex colors not caught by CSS variable cascade | Medium | DashboardScreen chart colors, StatusBar dot colors, and any `style={{ color: '#...' }}` patterns are explicitly listed in the WO contracts. Developer must grep for `#` in screen files and update. |
| Mobile bottom tabs space constraint with 8 items | Low | Current mobile tabs already show 8 items successfully (screenshots confirm). Labels are abbreviated (2-4 chars). Icon size bumped from 14px to 18px for clarity. |
| Sidebar collapse transition jank on content reflow | Low | `overflow: hidden` on sidebar container; content area uses `flex: 1` which naturally fills remaining space during width transition. CSS transition on `width` only (composited property). |
| Existing `.dark` shadcn block conflict with new custom-property dark overrides | Low | Current `.dark` block only touches oklch-based shadcn variables. New custom-property overrides go in the SAME `.dark` block, following the existing pattern. No conflict. |
| FAB clearance with new sidebar width | Low | FAB is `fixed` positioned; sidebar pushes the content area's `max-w-6xl` container. FAB `right` and `bottom` values unchanged. Confirm visually. |
| `presets.ts` button/badge class strings reference old token names | Low | `presets.ts` uses Tailwind utility names like `bg-accent-bg`, `text-accent-fg` — these resolve from the `@theme` block. Since the token NAMES stay the same (only VALUES change), presets auto-update. Verify no hardcoded hex in presets. |
| Lost logic during Layout.tsx rewrite | High | The WO contract explicitly states ALL existing `useEffect` hooks must be preserved verbatim. Developer MUST open the current Layout.tsx alongside the new one and confirm every hook is carried forward before claiming done. |

---

### Developer Guidance

- **Open the current `src/ui/Layout.tsx:77-145`** — these lines contain the 5 `useEffect` hooks (bootstrap, WebLLM, Kilo, clock, sync). Copy them ENTIRELY into the new Layout, preserving every line, dependency, and cleanup function. This is the single highest-risk step — a missing hook silently breaks sync or AI.
- **`src/index.css` @theme token NAMES must stay exactly the same** — `--color-background`, `--color-accent-fg`, etc. Only VALUES change. Renaming a token breaks every `bg-background` / `text-accent-fg` utility across the entire app.
- **The `.dark` block in `index.css` already exists** for shadcn (oklch variables). Add your new custom-property overrides INSIDE the same `.dark { ... }` block, below the existing shadcn entries. Do not create a second `.dark` block — CSS specificity will be unpredictable.
- **Sidebar active state uses `style` prop, not className** — the NavLink `className` callback cannot override `background` reliably when `isActive` returns true (Tailwind generates static utilities). Use `style={({ isActive }) => isActive ? { background: '#0D9488' } : undefined}` for the active background.
- **Mobile bottom tabs use `mobileTabIcons` with `size={18}`** (up from 14 in desktop sidebar). Keep the existing `mobileTabClass` style (flex-col, items-center, text-[10px]) — it already works well.
- **Chart color update in DashboardScreen** — files to check: `DashboardScreen.tsx:197-210` (BarChart fill/stroke/tooltip), any `style={{ color: ... }}` patterns. Grep for `#` in `src/ui/screens/**/*.tsx` and update to new palette values.
- **Test dark mode with `localStorage.setItem('theme', 'dark')` in browser console** before implementing the toggle — verify the `.dark` CSS block resolves correctly before wiring the button.

---

### Migration / Rollout / Rollback Notes

| Scenario | Action |
|---|---|
| **New install** | Theme defaults to light; dark mode off. User toggles via top bar button. |
| **Existing user upgrade** | App loads with light theme (no `"theme"` key in localStorage). No visual regression — just new colors. |
| **Rollback** | Revert `src/index.css`, `src/ui/theme/tokens.ts`, `src/ui/Layout.tsx`, `src/App.tsx` to git HEAD^ versions. No data, store, or service changes — pure CSS/JSX rollback. |
| **Dark mode toggle broken** | Fallback: user can add/remove `.dark` class manually in devtools. Fix is isolated to App.tsx useEffect + Layout.tsx toggle handler. |

---

### Open Execution Questions

None — all design decisions are resolved above. The brief is comprehensive: exact hex values for every token, layout dimensions, interaction patterns, and the preview design (`redesign-preview.json`) provides a pixel-accurate reference.

---

### Execution Readiness Verdict

**Pass.** Design is coherent with existing CSS-variable architecture; all 11 files mapped to one work order with precise contracts and exact code anchors; no blocked dependencies; no service/store/model changes; dark mode mechanic is a simple localStorage + CSS class toggle; sidebar uses the same React Router NavLink pattern as the current top tabs.
