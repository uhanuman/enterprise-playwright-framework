import { format, addDays, addMonths } from 'date-fns';

export type DateFormat = 'yyyy-MM-dd' | 'dd-MM-yyyy' | 'ISO';

export function getDateOffset(days: number, dateFormat: DateFormat = 'yyyy-MM-dd', fromDate = new Date()): string {
  const date = addDays(fromDate, days);
  return formatDate(date, dateFormat);
}

export function formatDate(date: Date, dateFormat: DateFormat): string {
  switch (dateFormat) {
    case 'dd-MM-yyyy':
      return format(date, 'dd-MM-yyyy');
    case 'ISO':
      return date.toISOString();
    default:
      return format(date, 'yyyy-MM-dd');
  }
}

export function parseDateExpression(expression: string, fromDate = new Date()): string {
  // {{DATE:yyyy-MM-dd:+7}} or {{DATE:yyyy-MM-dd:-7}}
  const match = expression.match(/^\{\{DATE:([^:]+):([+-]?\d+)\}\}$/);
  if (!match) return expression;
  const [, fmt, offsetStr] = match;
  const offset = Number(offsetStr);
  const date = addDays(fromDate, offset);
  return formatDate(date, (fmt as DateFormat) || 'yyyy-MM-dd');
}

export function getNextMonth(fromDate = new Date()): string {
  return formatDate(addMonths(fromDate, 1), 'yyyy-MM-dd');
}

export function getNextSixMonths(fromDate = new Date()): string {
  return formatDate(addMonths(fromDate, 6), 'yyyy-MM-dd');
}
