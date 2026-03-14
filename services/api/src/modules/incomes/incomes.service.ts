import { prisma } from '../../lib/prisma'
import type {
  CreateIncomeRecurrenceInput,
  UpdateIncomeRecurrenceInput,
  CreateIncomeInput,
  UpdateIncomeInput,
  IncomeListQuery,
  IncomeAnalyticsQuery,
} from './incomes.schema'
import { calcNextDate } from './incomes.recurrence'

// ================================================================
// IncomeRecurrence
// ================================================================

export async function listRecurrences(userId: string) {
  return prisma.incomeRecurrence.findMany({
    where: { userId, deletedAt: null },
    orderBy: { nextDate: 'asc' },
  })
}

export async function createRecurrence(userId: string, data: CreateIncomeRecurrenceInput) {
  const startDate = new Date(data.startDate)
  const nextDate = calcNextDate(startDate, data.unit, data.interval)

  return prisma.$transaction(async (tx) => {
    const recurrence = await tx.incomeRecurrence.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        amount: data.amount,
        unit: data.unit,
        interval: data.interval,
        startDate,
        nextDate,
        maxOccurrences: data.maxOccurrences ?? null,
        occurrenceCount: 1,
      },
    })

    await tx.income.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        amount: data.amount,
        date: startDate,
        recurrenceId: recurrence.id,
      },
    })

    return recurrence
  })
}

export async function updateRecurrence(
  userId: string,
  recurrenceId: string,
  data: UpdateIncomeRecurrenceInput,
) {
  const rec = await prisma.incomeRecurrence.findFirst({
    where: { id: recurrenceId, userId, deletedAt: null },
  })
  if (!rec) throw Object.assign(new Error('RECURRENCE_NOT_FOUND'), { statusCode: 404 })

  return prisma.incomeRecurrence.update({
    where: { id: recurrenceId },
    data: {
      name: data.name,
      description: data.description,
      amount: data.amount,
      unit: data.unit,
      interval: data.interval,
      maxOccurrences: data.maxOccurrences,
      isActive: data.isActive,
    },
  })
}

export async function softDeleteRecurrence(userId: string, recurrenceId: string) {
  const rec = await prisma.incomeRecurrence.findFirst({
    where: { id: recurrenceId, userId, deletedAt: null },
  })
  if (!rec) throw Object.assign(new Error('RECURRENCE_NOT_FOUND'), { statusCode: 404 })

  return prisma.incomeRecurrence.update({
    where: { id: recurrenceId },
    data: { deletedAt: new Date(), isActive: false },
  })
}

// ================================================================
// Income
// ================================================================

export async function listIncomes(userId: string, query: IncomeListQuery) {
  const { dateFrom, dateTo, page, limit } = query

  const where = {
    userId,
    deletedAt: null as null,
    ...(dateFrom || dateTo
      ? {
          date: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
  }

  const [incomes, total] = await prisma.$transaction([
    prisma.income.findMany({
      where,
      include: { recurrence: { select: { id: true, name: true, unit: true, interval: true } } },
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.income.count({ where }),
  ])

  return { incomes, total, page, limit }
}

export async function createIncome(userId: string, data: CreateIncomeInput) {
  return prisma.income.create({
    data: {
      userId,
      name: data.name,
      description: data.description,
      amount: data.amount,
      date: new Date(data.date),
    },
  })
}

export async function updateIncome(userId: string, incomeId: string, data: UpdateIncomeInput) {
  const income = await prisma.income.findFirst({ where: { id: incomeId, userId, deletedAt: null } })
  if (!income) throw Object.assign(new Error('INCOME_NOT_FOUND'), { statusCode: 404 })

  return prisma.income.update({
    where: { id: incomeId },
    data: {
      name: data.name,
      description: data.description,
      amount: data.amount,
      date: data.date ? new Date(data.date) : undefined,
    },
  })
}

export async function softDeleteIncome(userId: string, incomeId: string) {
  const income = await prisma.income.findFirst({ where: { id: incomeId, userId, deletedAt: null } })
  if (!income) throw Object.assign(new Error('INCOME_NOT_FOUND'), { statusCode: 404 })

  return prisma.income.update({ where: { id: incomeId }, data: { deletedAt: new Date() } })
}

// ================================================================
// Analytics
// ================================================================

export async function analyticsIncomes(userId: string, query: IncomeAnalyticsQuery) {
  const dateFrom = new Date(query.dateFrom)
  const dateTo = new Date(query.dateTo)

  const incomes = await prisma.income.findMany({
    where: {
      userId,
      deletedAt: null,
      date: { gte: dateFrom, lte: dateTo },
    },
    orderBy: { date: 'asc' },
  })

  const total = incomes.reduce((sum, i) => sum + Number(i.amount), 0)
  const count = incomes.length
  const average = count > 0 ? total / count : 0

  // Total por mês (YYYY-MM)
  const byMonthMap = new Map<string, number>()
  for (const i of incomes) {
    const key = i.date.toISOString().slice(0, 7)
    byMonthMap.set(key, (byMonthMap.get(key) ?? 0) + Number(i.amount))
  }
  const byMonth = Array.from(byMonthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total }))

  // Recorrente vs avulso
  const recurring = incomes.filter((i) => i.recurrenceId !== null)
  const oneOff = incomes.filter((i) => i.recurrenceId === null)
  const byType = [
    { type: 'recurring', label: 'Recorrente', total: recurring.reduce((s, i) => s + Number(i.amount), 0), count: recurring.length },
    { type: 'one-off', label: 'Avulso', total: oneOff.reduce((s, i) => s + Number(i.amount), 0), count: oneOff.length },
  ]

  return { summary: { total, count, average }, byMonth, byType }
}
