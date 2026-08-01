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
