/**
 * List pagination controls — page size, range label, prev/next + page numbers.
 */
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PAGE_SIZE_OPTIONS, type PageSize } from '@/services/listQuery';
import { cn } from '@/utils/cn';

export interface PaginationBarProps {
  page: number;
  pageSize: PageSize;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
  disabled?: boolean;
  className?: string;
}

function buildPageList(page: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  if (page <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (page >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
    pages.add(totalPages - 3);
  }
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | 'ellipsis')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('ellipsis');
    out.push(p);
    prev = p;
  }
  return out;
}

export function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  disabled = false,
  className,
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);
  const pages = buildPageList(safePage, totalPages);

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-border bg-surface text-xs text-text-muted',
        className,
      )}
      role="navigation"
      aria-label="Phân trang"
    >
      <div className="flex items-center gap-2">
        <span>
          Hiển thị {from}-{to} / {total}
        </span>
        <label className="flex items-center gap-1">
          <span className="sr-only">Số dòng mỗi trang</span>
          <select
            className="h-7 rounded-field border border-input-border bg-input-bg px-1.5 text-xs"
            value={pageSize}
            disabled={disabled}
            onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
            aria-label="Số dòng mỗi trang"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}/trang
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={disabled || safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Trang trước"
        >
          <ChevronLeft size={14} />
        </Button>
        {pages.map((p, idx) =>
          p === 'ellipsis' ? (
            <span key={`e-${idx}`} className="px-1.5 text-text-disabled">
              …
            </span>
          ) : (
            <Button
              key={p}
              type="button"
              variant={p === safePage ? 'default' : 'ghost'}
              size="xs"
              disabled={disabled}
              className="min-w-7 px-1.5"
              onClick={() => onPageChange(p)}
              aria-label={`Trang ${p}`}
              aria-current={p === safePage ? 'page' : undefined}
            >
              {p}
            </Button>
          ),
        )}
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={disabled || safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Trang sau"
        >
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}
