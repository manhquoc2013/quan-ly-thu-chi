import { format, parseISO, isValid, startOfMonth, endOfMonth, subDays, subMonths } from 'date-fns';
import { vi } from 'date-fns/locale';

export function formatDate(date: string | Date, formatStr: string = 'dd/MM/yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return '';
  return format(d, formatStr, { locale: vi });
}

export function formatDateTime(date: string | Date): string {
  return formatDate(date, 'dd/MM/yyyy HH:mm');
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function getMonthRange(date: Date = new Date()): { start: string; end: string } {
  return {
    start: format(startOfMonth(date), 'yyyy-MM-dd'),
    end: format(endOfMonth(date), 'yyyy-MM-dd'),
  };
}

export function getLast7Days(): { start: string; end: string } {
  return {
    start: format(subDays(new Date(), 6), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  };
}

export function getLast30Days(): { start: string; end: string } {
  return {
    start: format(subDays(new Date(), 29), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  };
}

export function getPreviousMonthRange(): { start: string; end: string } {
  const d = subMonths(new Date(), 1);
  return getMonthRange(d);
}

/** Inclusive ISO date-only range check. Empty from/to = open bound. */
export function isDateInRange(date: string | undefined, from: string, to: string): boolean {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function isValidDate(dateStr: string): boolean {
  return isValid(parseISO(dateStr));
}

/** Vietnamese relative time: "2 phút trước", "1 giờ trước", "3 ngày trước", etc. */
export function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return 'vừa xong';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds} giây trước`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} tháng trước`;

  const years = Math.floor(months / 12);
  return `${years} năm trước`;
}
