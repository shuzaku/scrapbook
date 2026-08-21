import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

export function toMonthKey(date: Date): string {
  return format(date, 'yyyy-MM')
}

export function previousMonthKey(): string {
  return toMonthKey(subMonths(new Date(), 1))
}

export function currentMonthKey(): string {
  return toMonthKey(new Date())
}

export function monthKeyToRange(key: string): { start: Date; end: Date } {
  const date = new Date(`${key}-01T00:00:00Z`)
  return { start: startOfMonth(date), end: endOfMonth(date) }
}

export function monthKeyToLabel(key: string): string {
  const date = new Date(`${key}-01T12:00:00Z`)
  return format(date, 'MMMM yyyy')
}
