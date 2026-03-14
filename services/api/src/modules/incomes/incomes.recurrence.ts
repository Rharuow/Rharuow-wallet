import type { RecurrenceUnit } from './incomes.schema'

export function calcNextDate(from: Date, unit: RecurrenceUnit, interval: number): Date {
  const next = new Date(from)
  switch (unit) {
    case 'DAY':
      next.setDate(next.getDate() + interval)
      break
    case 'WEEK':
      next.setDate(next.getDate() + interval * 7)
      break
    case 'MONTH':
      next.setMonth(next.getMonth() + interval)
      break
    case 'YEAR':
      next.setFullYear(next.getFullYear() + interval)
      break
  }
  return next
}
