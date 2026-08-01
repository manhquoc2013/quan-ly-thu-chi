import { format, parseISO, isValid, isAfter, isBefore, startOfMonth, endOfMonth, subDays } from 'date-fns';
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

export function isValidDate(dateStr: string): boolean {
  return isValid(parseISO(dateStr));
}
