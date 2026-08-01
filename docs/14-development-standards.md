# Quy chuẩn phát triển — Quản Lý Tài Chính

> **Phiên bản**: 1.0 · **Ngày**: 2026-08-01 · **Trạng thái**: DRAFT
>
> **Nguyên tắc cốt lõi**: Không dead code, không duplicate code, mọi thứ dùng chung được thì dùng chung.

---

## 1. Tổ chức code — Quy tắc bắt buộc

### 1.1 Nguyên tắc DRY (Don't Repeat Yourself)

```
❌ CẤM:
  - Copy-paste cùng 1 logic sang 2 file
  - Viết lại cùng 1 component với variant chỉ khác màu
  - Cùng 1 validation rule ở 2 nơi
  - Cùng 1 type/interface define 2 lần

✅ PHẢI:
  - Nếu dùng ≥ 2 lần → extract ra shared module
  - Component variant dùng props, không clone file
  - Validation rules → tập trung trong Zod schemas
  - Types → tập trung trong src/models/
```

### 1.2 Nguyên tắc KISS (Keep It Simple)

```
❌ CẤM:
  - Abstraction khi chưa có ≥ 3 use case
  - Utility function chỉ dùng 1 lần (để inline)
  - Over-engineering: code cho tương lai chưa chắc xảy ra
  - useEffect để sync state (dùng selector/derived state)

✅ PHẢI:
  - Viết code cho yêu cầu HIỆN TẠI
  - Chỉ abstract khi pattern lặp ≥ 3 lần
  - Function < 50 dòng, component < 200 dòng
  - State derivation dùng selector, không useEffect
```

### 1.4 Nguyên tắc Clean Code

> Tham khảo: Robert C. Martin — *Clean Code: A Handbook of Agile Software Craftsmanship*

#### 1.4.1 SRP — Single Responsibility Principle

```
❌ CẤM: 1 function/component làm nhiều việc
  - Component vừa fetch data vừa render vừa validate
  - Function vừa format tiền vừa parse ngày vừa log
  - Store action vừa gọi API vừa update state vừa show toast

✅ PHẢI: Mỗi function/component CHỈ 1 trách nhiệm
  - Fetch data → service
  - Validate → Zod schema
  - Format → utils
  - Render → component
  - State → store action (gọi service, nhận kết quả, set state)
```

#### 1.4.2 OCP — Open/Closed Principle

```
❌ CẤM: Sửa code cũ để thêm tính năng mới (gây regression)
  - Thêm variant button bằng cách sửa if/else trong Button
  - Thêm trường form bằng cách sửa trực tiếp ExpenseDialog

✅ PHẢI: Mở rộng qua props/composition, không sửa code gốc
  - Button variant mới → thêm vào buttonPresets, không sửa Button.tsx
  - Trường form mới → thêm vào schema + config array, Dialog auto-render
```

#### 1.4.3 ISP — Interface Segregation Principle

```
❌ CẤM: Component nhận props không dùng đến
  interface PanelProps {
    title: string;
    icon: Icon;
    titleTrailing: ReactNode;
    footer: ReactNode;       // ← Panel KHÔNG có footer → sai
    loading: boolean;        // ← Panel KHÔNG tự loading → sai
  }

✅ PHẢI: Props chỉ chứa những gì component THỰC SỰ dùng
  interface PanelProps {
    title?: string;
    icon?: LucideIcon;
    titleTrailing?: ReactNode;
    style?: 'solid' | 'translucent';
    className?: string;
    children: ReactNode;
  }
```

#### 1.4.4 DIP — Dependency Inversion Principle

```
❌ CẤM: High-level module phụ thuộc trực tiếp vào low-level module
  // Store gọi thẳng googleDrive API
  function addExpense(data) {
    const file = await googleDrive.readJSON('expenses.json');
    await googleDrive.writeJSON('expenses.json', [...file, data]);
  }

✅ PHẢI: Cả hai cùng phụ thuộc vào abstraction (service interface)
  // Store gọi service, service gọi drive
  function addExpense(data) {
    await expenseService.create(data); // Store không biết drive tồn tại
  }
```

#### 1.4.5 Quy tắc đặt tên — Meaningful Names

```
❌ CẤM:
  - Tên 1 ký tự: e, d, r, x, i, j
  - Tên viết tắt: btn, tbl, frm, amt, desc
  - Tên không mô tả: data, item, obj, result, temp, handleClick
  - Tên sai ngữ cảnh: expenses trong revenueStore
  - Tên boolean không prefix: loading (→ isLoading), visible (→ isVisible)

✅ PHẢI:
  - Biến: descriptiveNoun — expenses, selectedExpense, isLoading
  - Hàm: verb + noun — formatVND, parseVND, getExpenses
  - Boolean: is/has/should + adjective — isOpen, hasError, shouldSync
  - Component: domain + type — ExpenseDialog, RevenueGrid
  - Store: domain + Store — expenseStore, revenueStore
  - Handler: handle + event — handleSubmit, handleDelete, handleClose
  - Số lượng khác biệt rõ ràng: expenseCount vs expenseList (không expenses1, expenses2)
```

#### 1.4.6 Quy tắc hàm — Small & Do One Thing

```
❌ CẤM:
  - Hàm > 30 dòng (quá dài, khó đọc)
  - Hàm > 3 tham số (khó nhớ thứ tự)
  - Hàm có > 3 mức indent (quá nhiều if/loop lồng nhau)
  - Hàm vừa query vừa mutate (side effect lẫn với pure logic)
  - Hàm có boolean flag để đổi behavior (tách thành 2 hàm riêng)

✅ PHẢI:
  - Mỗi hàm ≤ 30 dòng
  - Mỗi hàm ≤ 3 tham số (nếu nhiều hơn → dùng object)
  - Mỗi hàm ≤ 3 mức indent (nếu vượt → extract hàm con)
  - Command/Query separation: hàm hoặc trả về data, hoặc thay đổi state — không cả 2
  - Early return: if (!valid) return; — thay vì if (valid) { ... dài }
```

#### 1.4.7 Quy tắc Comment

```
❌ CẤM:
  - Comment giải thích code tệ (sửa code, đừng comment)
    // Lặp qua mảng expenses
    for (const e of expenses) { ... }
  - Comment code (dùng git history)
    // TODO: fix later
    // const oldVersion = ...
  - Comment sai sự thật (comment nói A, code làm B)
  - Comment quá nhiều (code phải tự giải thích được)

✅ CHỈ comment khi:
  - Giải thích TẠI SAO, không phải CÁI GÌ
    // Phải dùng Set thay vì array vì lookup O(1) cho 10K records
  - Cảnh báo hậu quả
    // ⚠️ Hàm này mutate input array — đừng truyền state trực tiếp
  - TODO có ticket number
    // TODO(PROJ-123): Thêm cache invalidation khi có webhook
  - Legal/copyright
    // Copyright 2026 ETC. MIT License.
```

#### 1.4.8 Error Handling

```
❌ CẤM:
  - Return null thay vì throw error (người gọi không biết lỗi)
  - Nuốt error: try { ... } catch {} im lặng
  - Throw string: throw "lỗi" (mất stack trace)
  - Check error bằng string message: if (e.message.includes('timeout'))

✅ PHẢI:
  - Throw Error object: throw new Error('Mô tả lỗi cụ thể')
  - Xử lý error ở đúng tầng: service throw → store catch → UI hiển thị
  - Custom error class cho business error
    class QuotaExhaustedError extends Error {
      constructor() { super('Hết quota Gemini'); this.name = 'QuotaExhaustedError'; }
    }
  - Log error đầy đủ: console.error('Failed to sync', { error: e, context })
  - Toast thân thiện với user, console.error chi tiết cho dev
```

#### 1.4.9 Testing

```
✅ Mỗi service phải có test:
  - expenseService: test create, update, delete, validation
  - revenueService: test create order, status transitions
  - aiRouter: test provider selection theo complexity + quota
  - googleDrive: test readJSON, writeJSON với mock
  
✅ Mỗi store phải có test:
  - Test action gọi đúng service
  - Test state update sau action
  - Test selector trả về đúng giá trị

✅ Mỗi shared component phải có test:
  - Button: render từng variant, click handler, disabled state
  - Dialog: open/close, confirm/cancel callback
  - Badge: render từng variant

✅ Test phải:
  - 1 test = 1 hành vi (không test nhiều thứ trong 1 test)
  - AAA pattern: Arrange → Act → Assert
  - Tên test mô tả hành vi: "should format 1000000 to 1.000.000 ₫"
  - Mock external dependencies, không gọi API thật
  - Chạy được CI, không phụ thuộc thứ tự test
```

#### 1.4.10 Refactoring

```
🔴 KHI NÀO refactor:
  - Thấy code lặp ≥ 3 lần → extract
  - Hàm > 30 dòng → tách
  - Component > 200 dòng → tách
  - Tên không mô tả đúng → rename
  - Comment giải thích code → extract thành hàm có tên rõ ràng
  - Nested if > 3 mức → early return hoặc guard clause

🔴 QUY TẮC refactor:
  - Refactor theo từng bước nhỏ, test sau mỗi bước
  - KHÔNG refactor + thêm tính năng trong cùng 1 commit
  - Commit refactor riêng: "refactor: extract formatVND utility"
  - Sau refactor, behavior KHÔNG đổi → test cũ vẫn pass
```

#### 1.4.11 Clean Code Checklist

Trước mỗi commit, tự hỏi:

- [ ] Tên biến/hàm/component có mô tả đúng không?
- [ ] Hàm này có ≤ 30 dòng và chỉ làm 1 việc không?
- [ ] Có code nào lặp ≥ 3 lần cần extract không?
- [ ] Comment có giải thích "tại sao" chứ không phải "cái gì"?
- [ ] Có error bị nuốt (empty catch) không?
- [ ] Có thể bỏ bớt if/else bằng early return không?
- [ ] Props có chứa field component không dùng không?
- [ ] Có hardcode value nào đáng lẽ phải là constant không?
- [ ] Test có cover hành vi chính không?
- [ ] Code có thể đọc hiểu mà không cần comment không?

### 2.1 Quy tắc phân cấp

```
src/
├── models/          # ⚠️ CHỈ type definitions — KHÔNG code logic
│   ├── expense.ts
│   ├── revenue.ts
│   ├── customer.ts
│   └── report.ts
│
├── utils/           # ⚠️ CHỈ pure functions — KHÔNG side effects, KHÔNG React
│   ├── currency.ts  # formatVND, parseVND
│   ├── date.ts      # formatDate, getDateRange...
│   ├── image.ts     # compressImage, toBase64...
│   ├── id.ts        # generateId, generateOrderCode
│   └── cn.ts        # classNames helper
│
├── services/        # ⚠️ Business logic + external API — KHÔNG UI, KHÔNG React hooks
│   ├── googleDrive.ts
│   ├── expenseService.ts
│   ├── revenueService.ts
│   ├── customerService.ts
│   ├── reportService.ts
│   ├── aiRouter.ts
│   ├── geminiService.ts
│   ├── webLLM.ts
│   └── cacheManager.ts
│
├── store/           # ⚠️ Zustand stores — KHÔNG gọi API trực tiếp, KHÔNG UI
│   ├── expenseStore.ts
│   ├── revenueStore.ts
│   ├── customerStore.ts
│   ├── reportStore.ts
│   ├── uiStore.ts
│   └── authStore.ts
│
├── hooks/           # ⚠️ React hooks dùng chung — KHÔNG business logic
│   ├── useDebounce.ts
│   ├── useKeyboard.ts
│   ├── useIntersectionObserver.ts
│   └── useMediaQuery.ts
│
├── ui/
│   ├── theme/       # ⚠️ Design tokens — KHÔNG components
│   │   ├── tokens.css
│   │   ├── utilities.css
│   │   ├── tokens.ts
│   │   ├── presets.ts
│   │   └── index.ts
│   │
│   ├── components/  # ⚠️ Components DÙNG CHUNG — KHÔNG business logic riêng
│   │   ├── Button.tsx
│   │   ├── Panel.tsx
│   │   ├── Dialog.tsx
│   │   ├── Toolbar.tsx
│   │   ├── ActionBar.tsx
│   │   ├── GridCell.tsx
│   │   ├── Badge.tsx
│   │   ├── Toast.tsx
│   │   ├── StatusBar.tsx
│   │   ├── SegmentedControl.tsx
│   │   ├── Dropdown.tsx
│   │   ├── DatePicker.tsx
│   │   ├── ImagePreview.tsx
│   │   ├── EmptyState.tsx
│   │   ├── Skeleton.tsx
│   │   └── index.ts        # ⚠️ Barrel export — CHỈ export public API
│   │
│   └── screens/     # ⚠️ Page-level — ĐƯỢC PHÉP business logic
│       ├── expense/
│       │   ├── ExpenseScreen.tsx
│       │   ├── ExpenseGrid.tsx
│       │   ├── ExpenseRowCard.tsx
│       │   └── ExpenseDialog.tsx
│       ├── revenue/
│       │   ├── RevenueScreen.tsx
│       │   ├── RevenueGrid.tsx
│       │   ├── OrderRowCard.tsx
│       │   └── OrderDialog.tsx
│       ├── report/
│       │   ├── ReportScreen.tsx
│       │   ├── ExpenseReport.tsx
│       │   ├── RevenueReport.tsx
│       │   └── ProfitReport.tsx
│       ├── ai/
│       │   ├── AIChatScreen.tsx
│       │   ├── ChatPanel.tsx
│       │   └── DataEntryHelper.tsx
│       └── settings/
│           └── SettingsScreen.tsx
│
├── Layout.tsx       # App shell
├── App.tsx          # Router
└── main.tsx         # Entry point
```

### 2.2 Quy tắc file

| Quy tắc | Mô tả |
|:---|:---|
| **1 file = 1 component** | Không define 2 component trong 1 file (trừ private helper) |
| **1 file = 1 store** | Mỗi Zustand store 1 file riêng |
| **1 file = 1 service** | Mỗi service 1 file riêng |
| **1 file = 1 model** | Mỗi entity 1 file type |
| **index.ts barrel** | Mỗi thư mục components có `index.ts` export public API |

---

## 3. Component Library — Quy chuẩn dùng chung

### 3.1 Shared Components (src/ui/components/)

Đây là các component **bắt buộc dùng chung** — không màn hình nào được tự viết lại:

| Component | Mô tả | Props quyết định variant |
|:---|:---|:---|
| **Button** | Tất cả nút bấm | `variant`: run / danger / neutral / accent |
| **Panel** | Tất cả card container | `style`: solid / translucent |
| **Dialog** | Tất cả modal | `type`: form / confirm / alert |
| **Toolbar** | Tất cả top action bar | `start` + `end` slots |
| **ActionBar** | Tất cả bottom action bar | `start` + `end` slots |
| **Badge** | Tất cả status indicator | `variant`: success / warning / error / neutral / accent |
| **Toast** | Tất cả notification | `type`: success / error / warning / info |
| **StatusBar** | Bottom status strip | `syncStatus`: synced / syncing / error / offline |
| **GridCell** | Tất cả ô bảng | `editable`: true/false |
| **Dropdown** | Tất cả select/combobox | `searchable`: true/false |
| **DatePicker** | Tất cả input ngày | `range`: true/false |
| **ImagePreview** | Tất cả xem ảnh | `images`: single/array |
| **EmptyState** | Tất cả trạng thái rỗng | `icon` + `title` + `action` props |
| **Skeleton** | Tất cả loading placeholder | `variant`: text / card / table-row |
| **SegmentedControl** | Tất cả tab switcher | `segments`: array |

### 3.2 Quy tắc dùng component

```tsx
// ❌ SAI — Tự viết button riêng trong screen
function ExpenseScreen() {
  return <button className="bg-blue-600 text-white px-3 py-1 rounded">Thêm</button>;
}

// ✅ ĐÚNG — Dùng shared Button
import { Button } from '@/ui/components';
function ExpenseScreen() {
  return <Button variant="run" icon={Plus}>Thêm</Button>;
}
```

### 3.3 Barrel Export Pattern

```typescript
// src/ui/components/index.ts
// CHỈ export những gì là public API
// KHÔNG export internal helpers, sub-components, types nội bộ

export { Button } from './Button';
export { Panel } from './Panel';
export { Dialog, ConfirmDialog, AlertDialog } from './Dialog';
export { Toolbar } from './Toolbar';
export { ActionBar } from './ActionBar';
export { Badge } from './Badge';
export { Toast, ToastContainer } from './Toast';
export { StatusBar } from './StatusBar';
export { GridCell } from './GridCell';
export { Dropdown } from './Dropdown';
export { DatePicker } from './DatePicker';
export { ImagePreview } from './ImagePreview';
export { EmptyState } from './EmptyState';
export { Skeleton } from './Skeleton';
export { SegmentedControl } from './SegmentedControl';

// Types
export type { ButtonVariant } from './Button';
export type { BadgeVariant } from './Badge';
```

---

## 4. Shared Code — Quy chuẩn DRY

### 4.1 Utils (pure functions, zero dependencies)

```typescript
// src/utils/currency.ts
// ⚠️ Function này được import bởi: ExpenseDialog, OrderDialog, ExpenseGrid, RevenueGrid, ReportScreen...
// → PHẢI dùng chung, không được copy

const VND_FORMATTER = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatVND(amount: number): string {
  return VND_FORMATTER.format(amount);
}

export function parseVND(input: string): number {
  return Number(input.replace(/[^0-9]/g, ''));
}

// src/utils/date.ts
export function formatDate(iso: string): string { /* DD/MM/YYYY */ }
export function getDateRange(preset: 'month' | 'quarter' | 'year'): DateRange { /* ... */ }
export function getMonthLabel(month: string): string { /* "2026-07" → "Tháng 7/2026" */ }

// src/utils/id.ts
export function generateId(): string { return crypto.randomUUID(); }
export function generateOrderCode(date: string, index: number): string { /* DH-YYYYMMDD-NNN */ }

// src/utils/cn.ts
export { clsx as cn } from 'clsx'; // Re-export cho consistency
```

### 4.2 Validation Schemas (Zod — tập trung)

```typescript
// src/models/expense.ts — KHÔNG chỉ types, CÒN validation
import { z } from 'zod';

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  office: 'Văn phòng phẩm',
  rent: 'Thuê mặt bằng',
  // ...
};

export const expenseSchema = z.object({
  date: z.string().min(1, 'Vui lòng chọn ngày'),
  category: z.enum([...EXPENSE_CATEGORIES]),
  amount: z.number().positive('Số tiền phải > 0').max(999_999_999_999),
  description: z.string().min(5, 'Mô tả ít nhất 5 ký tự').max(500),
  // ...
});

export type Expense = z.infer<typeof expenseSchema>;
```

### 4.3 Hooks (shared React logic)

```typescript
// src/hooks/useDebounce.ts
// Dùng trong: ExpenseScreen search, RevenueScreen search, SettingsScreen...
export function useDebounce<T>(value: T, delay: number = 300): T { /* ... */ }

// src/hooks/useKeyboard.ts
// Dùng trong: Dialog (Escape), ExpenseDialog (Ctrl+S), toàn app...
export function useKeyboard(key: string, handler: () => void, modifiers?: Modifiers): void { /* ... */ }

// src/hooks/useIntersectionObserver.ts
// Dùng trong: ExpenseGrid (virtual scroll), ImagePreview (lazy load)...
export function useIntersectionObserver(ref: RefObject<Element>, callback: (visible: boolean) => void): void { /* ... */ }
```

---

## 5. Quy tắc Import

### 5.1 Path Aliases (bắt buộc)

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@ui/*": ["./src/ui/*"],
      "@components/*": ["./src/ui/components/*"],
      "@screens/*": ["./src/ui/screens/*"],
      "@store/*": ["./src/store/*"],
      "@services/*": ["./src/services/*"],
      "@models/*": ["./src/models/*"],
      "@utils/*": ["./src/utils/*"],
      "@hooks/*": ["./src/hooks/*"],
    }
  }
}
```

### 5.2 Quy tắc Import Order

```typescript
// 1. React & core libs
import { useState, useCallback } from 'react';
import { useStore } from 'zustand';

// 2. External libs
import { Plus, Trash2 } from 'lucide-react';
import { z } from 'zod';

// 3. Internal — shared
import { Button, Panel, Dialog } from '@components';
import { formatVND } from '@utils/currency';
import { expenseSchema } from '@models/expense';

// 4. Internal — local
import { ExpenseRowCard } from './ExpenseRowCard';

// 5. Styles
import './ExpenseScreen.css'; // NẾU CÓ — ưu tiên Tailwind
```

### 5.3 Quy tắc Export

```typescript
// ❌ SAI — Default export
export default function Button() { ... }

// ✅ ĐÚNG — Named export
export function Button() { ... }

// Lý do: named export → auto-import chính xác, dễ refactor, dễ tree-shake
```

---

## 6. Quy tắc đặt tên

### 6.1 Files & Folders

| Loại | Quy tắc | Ví dụ |
|:---|:---|:---|
| **Component file** | PascalCase | `ExpenseDialog.tsx` |
| **Hook file** | camelCase, prefix `use` | `useDebounce.ts` |
| **Store file** | camelCase, suffix `Store` | `expenseStore.ts` |
| **Service file** | camelCase, suffix `Service` hoặc mô tả | `expenseService.ts`, `googleDrive.ts` |
| **Model file** | camelCase, tên entity | `expense.ts` |
| **Utility file** | camelCase | `currency.ts` |
| **Folder** | kebab-case hoặc tên ngắn | `expense/`, `ui/` |

### 6.2 Variables & Functions

| Loại | Quy tắc | Ví dụ |
|:---|:---|:---|
| **Component** | PascalCase | `ExpenseDialog` |
| **Hook** | camelCase, prefix `use` | `useExpenseStore` |
| **Function** | camelCase, verb-first | `formatVND`, `parseVND`, `getExpenses` |
| **Event handler** | camelCase, prefix `handle` | `handleSubmit`, `handleDelete` |
| **Boolean** | camelCase, prefix `is`/`has`/`should` | `isLoading`, `hasError`, `shouldSync` |
| **Constant** | UPPER_SNAKE_CASE | `MAX_FILE_SIZE`, `API_BASE_URL` |
| **Type/Interface** | PascalCase | `Expense`, `ButtonProps` |
| **Enum value** | camelCase (string union) | `type: 'cash' \| 'bank_transfer'` |

---

## 7. Quy tắc Component

### 7.1 Cấu trúc file component

```tsx
// src/ui/components/Button.tsx
import { type ReactNode } from 'react';        // 1. React imports
import type { LucideIcon } from 'lucide-react'; // 2. External type imports
import { cn } from '@utils/cn';                 // 3. Internal imports
import { buttonPresets } from '@ui/theme';       // 4. Theme imports

// 5. Types
export type ButtonVariant = 'run' | 'danger' | 'neutral' | 'accent';

interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  icon?: LucideIcon;
  disabled?: boolean;
  busy?: boolean;
  onClick?: () => void;
  className?: string;
}

// 6. Component
export function Button({
  children,
  variant = 'neutral',
  icon: Icon,
  disabled,
  busy,
  onClick,
  className,
}: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className={cn(buttonPresets[variant].className, className)}
    >
      {busy ? <Spinner /> : Icon && <Icon size={15} />}
      {children}
    </button>
  );
}
```

### 7.2 Component Size Limit

| Loại | Max dòng | Xử lý nếu vượt |
|:---|:---|:---|
| Shared component | 100 | Tách ra sub-component hoặc custom hook |
| Screen component | 200 | Tách ra component con |
| Dialog/Form | 200 | Tách field group ra component riêng |
| Hook | 50 | Tách logic ra utility function |

---

## 8. Quy tắc Store (Zustand)

### 8.1 Pattern thống nhất

```typescript
// src/store/expenseStore.ts
import { create } from 'zustand';
import { type Expense } from '@models/expense';
import { expenseService } from '@services/expenseService';

interface ExpenseState {
  // ─── Data ───
  records: Expense[];
  isLoading: boolean;
  error: string | null;

  // ─── UI State ───
  filters: ExpenseFilters;
  selection: Set<string>;
  searchQuery: string;
  sortField: 'date' | 'amount';
  sortDirection: 'asc' | 'desc';

  // ─── Actions ───
  loadExpenses: () => Promise<void>;
  addExpense: (data: CreateExpenseDTO) => Promise<void>;
  updateExpense: (id: string, data: Partial<Expense>) => Promise<void>;
  deleteExpenses: (ids: string[]) => Promise<void>;
  setFilter: (filter: Partial<ExpenseFilters>) => void;
  setSearch: (query: string) => void;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
}

export const useExpenseStore = create<ExpenseState>((set, get) => ({
  // ...implementation
}));

// ─── Selectors (ngoài store để dễ tree-shake) ───
export const selectFilteredExpenses = (state: ExpenseState) => { /* ... */ };
export const selectTotalAmount = (state: ExpenseState) => { /* ... */ };
export const selectSelectedIds = (state: ExpenseState) => { /* ... */ };
```

### 8.2 Quy tắc Store

| Quy tắc | Mô tả |
|:---|:---|
| **Không gọi API trong set()** | API call → service → store.set() |
| **Không derived state trong store** | Dùng selector bên ngoài |
| **Không lưu computed value** | Chỉ lưu raw data, tính toán ở selector |
| **Selection dùng Set** | Không dùng `selected: boolean` trên từng record |
| **Error per action** | `error` là string \| null, không phải object phức tạp |

---

## 9. Code Quality Enforcement

### 9.1 ESLint Rules (bắt buộc)

```javascript
// eslint.config.js
export default [
  {
    rules: {
      // ─── Dead code prevention ───
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      'no-unused-expressions': 'error',
      'no-unreachable': 'error',

      // ─── Duplicate prevention ───
      'no-duplicate-imports': 'error',
      'no-duplicate-case': 'error',

      // ─── Code quality ───
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
      'no-implicit-coercion': 'error',

      // ─── React specific ───
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-key': ['error', { checkFragmentShorthand: true }],
      'react/no-array-index-key': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // ─── Import rules ───
      'import/no-duplicates': 'error',
      'import/no-unused-modules': 'error',
      'import/no-cycle': 'error',
      'import/order': ['error', {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
      }],

      // ─── Complexity limits ───
      'complexity': ['warn', 15],             // Max cyclomatic complexity
      'max-lines': ['warn', { max: 200 }],    // Max lines per file
      'max-depth': ['warn', 3],               // Max nesting depth
      'max-params': ['warn', 4],              // Max function params
    },
  },
];
```

### 9.2 Pre-commit Hook

```json
// package.json
{
  "scripts": {
    "lint": "eslint src/ --ext .ts,.tsx --max-warnings 0",
    "lint:fix": "eslint src/ --ext .ts,.tsx --fix",
    "format": "prettier --write 'src/**/*.{ts,tsx,css}'",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --coverage",
    "validate": "npm run lint && npm run typecheck && npm run test"
  },
  "simple-git-hooks": {
    "pre-commit": "npm run lint && npm run typecheck",
    "pre-push": "npm run validate"
  }
}
```

### 9.3 CI Checks (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run lint        # ⚠️ Fail nếu có warning
      - run: npm run typecheck   # ⚠️ Fail nếu type error
      - run: npm run test        # ⚠️ Fail nếu test fail hoặc coverage < 60%
```

---

## 10. Quy trình Review Code

### 10.1 Checklist trước khi commit

- [ ] Không ESLint warning/error
- [ ] Không TypeScript error
- [ ] Không `console.log` (trừ `console.warn`/`console.error`)
- [ ] Không comment code (xóa hẳn, git history giữ)
- [ ] Không import không dùng
- [ ] Không file rác (`.bak`, `.old`, `test-*.tsx`)
- [ ] Component mới: đã kiểm tra không trùng với shared component?
- [ ] Function mới: đã kiểm tra không có trong utils?
- [ ] Đã chạy test (nếu sửa logic)

### 10.2 Dead Code Detection

```bash
# Tìm file không được import bởi ai
npx unimported

# Tìm export không dùng trong cùng file
npx ts-prune

# Tìm dependency không dùng
npx depcheck
```

---

## 11. Tóm tắt

| Quy tắc | Mô tả |
|:---|:---|
| **1 file = 1 thing** | Không nhồi nhét |
| **DRY tuyệt đối** | Dùng ≥ 2 lần → extract |
| **Shared components first** | Luôn kiểm tra `@components` trước khi viết mới |
| **Named exports only** | Không default export |
| **Zod cho validation** | Schema = type + validation, 1 nơi duy nhất |
| **Selector cho derived state** | Không lưu computed value trong store |
| **ESLint max-warnings = 0** | Warning = lỗi, không được merge |
| **Xóa code không dùng ngay** | Git history giữ, không cần comment code |
| **Test coverage ≥ 60%** | CI sẽ fail nếu thấp hơn |
