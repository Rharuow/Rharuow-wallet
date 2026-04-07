import { prisma } from '../../lib/prisma'
import type {
  CreateCostAreaInput,
  UpdateCostAreaInput,
  CreateCostTypeInput,
  UpdateCostTypeInput,
  CreateCostRecurrenceInput,
  UpdateCostRecurrenceInput,
  CreateCostInput,
  UpdateCostInput,
  CostListQuery,
  CostAnalyticsQuery,
} from './costs.schema'
import { calcNextDate } from './costs.recurrence'

// ================================================================
// CostArea
// ================================================================

/** Lista áreas globais + personalizadas do usuário (sem soft-deletadas). */
export async function listAreas(userId: string) {
  return prisma.costArea.findMany({
    where: {
      deletedAt: null,
      OR: [{ userId: null }, { userId }],
    },
    orderBy: { name: 'asc' },
  })
}

export async function createArea(userId: string, data: CreateCostAreaInput) {
  const conflict = await prisma.costArea.findFirst({
    where: { name: data.name, userId, deletedAt: null },
  })
  if (conflict) throw Object.assign(new Error('AREA_NAME_CONFLICT'), { statusCode: 409 })

  return prisma.costArea.create({ data: { name: data.name, userId } })
}

export async function updateArea(userId: string, areaId: string, data: UpdateCostAreaInput) {
  const area = await prisma.costArea.findFirst({
    where: { id: areaId, userId, deletedAt: null },
  })
  if (!area) throw Object.assign(new Error('AREA_NOT_FOUND'), { statusCode: 404 })
  if (area.userId === null)
    throw Object.assign(new Error('GLOBAL_AREA_IMMUTABLE'), { statusCode: 403 })

  const conflict = await prisma.costArea.findFirst({
    where: { name: data.name, userId, deletedAt: null, NOT: { id: areaId } },
  })
  if (conflict) throw Object.assign(new Error('AREA_NAME_CONFLICT'), { statusCode: 409 })

  return prisma.costArea.update({ where: { id: areaId }, data: { name: data.name } })
}

export async function softDeleteArea(userId: string, areaId: string) {
  const area = await prisma.costArea.findFirst({
    where: { id: areaId, userId, deletedAt: null },
  })
  if (!area) throw Object.assign(new Error('AREA_NOT_FOUND'), { statusCode: 404 })

  const now = new Date()
  // Cascateia soft delete para tipos, custos e recorrências
  await prisma.$transaction(async (tx) => {
    const types = await tx.costType.findMany({
      where: { areaId, userId, deletedAt: null },
      select: { id: true },
    })
    const typeIds = types.map((t) => t.id)

    if (typeIds.length > 0) {
      await tx.cost.updateMany({ where: { costTypeId: { in: typeIds }, deletedAt: null }, data: { deletedAt: now } })
      await tx.costRecurrence.updateMany({ where: { costTypeId: { in: typeIds }, deletedAt: null }, data: { deletedAt: now } })
      await tx.costType.updateMany({ where: { id: { in: typeIds } }, data: { deletedAt: now } })
    }

    await tx.costArea.update({ where: { id: areaId }, data: { deletedAt: now } })
  })
}

// ================================================================
// CostType
// ================================================================

export async function listTypes(userId: string, areaId?: string) {
  return prisma.costType.findMany({
    where: {
      userId,
      deletedAt: null,
      ...(areaId ? { areaId } : {}),
    },
    include: { area: { select: { id: true, name: true, userId: true } } },
    orderBy: { name: 'asc' },
  })
}

export async function createType(userId: string, data: CreateCostTypeInput) {
  // A área deve existir e ser visível ao usuário (global ou própria)
  const area = await prisma.costArea.findFirst({
    where: { id: data.areaId, deletedAt: null, OR: [{ userId: null }, { userId }] },
  })
  if (!area) throw Object.assign(new Error('AREA_NOT_FOUND'), { statusCode: 404 })

  const conflict = await prisma.costType.findFirst({
    where: { name: data.name, areaId: data.areaId, userId, deletedAt: null },
  })
  if (conflict) throw Object.assign(new Error('TYPE_NAME_CONFLICT'), { statusCode: 409 })

  return prisma.costType.create({ data: { name: data.name, areaId: data.areaId, userId } })
}

export async function updateType(userId: string, typeId: string, data: UpdateCostTypeInput) {
  const type = await prisma.costType.findFirst({
    where: { id: typeId, userId, deletedAt: null },
  })
  if (!type) throw Object.assign(new Error('TYPE_NOT_FOUND'), { statusCode: 404 })

  const targetAreaId = data.areaId ?? type.areaId

  if (data.name) {
    const conflict = await prisma.costType.findFirst({
      where: { name: data.name, areaId: targetAreaId, userId, deletedAt: null, NOT: { id: typeId } },
    })
    if (conflict) throw Object.assign(new Error('TYPE_NAME_CONFLICT'), { statusCode: 409 })
  }

  return prisma.costType.update({
    where: { id: typeId },
    data: { name: data.name, areaId: data.areaId },
  })
}

export async function softDeleteType(userId: string, typeId: string) {
  const type = await prisma.costType.findFirst({ where: { id: typeId, userId, deletedAt: null } })
  if (!type) throw Object.assign(new Error('TYPE_NOT_FOUND'), { statusCode: 404 })

  const now = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.cost.updateMany({ where: { costTypeId: typeId, deletedAt: null }, data: { deletedAt: now } })
    await tx.costRecurrence.updateMany({ where: { costTypeId: typeId, deletedAt: null }, data: { deletedAt: now } })
    await tx.costType.update({ where: { id: typeId }, data: { deletedAt: now } })
  })
}

// ================================================================
// CostRecurrence
// ================================================================

export async function listRecurrences(userId: string) {
  return prisma.costRecurrence.findMany({
    where: { userId, deletedAt: null },
    include: { costType: { select: { id: true, name: true, areaId: true } } },
    orderBy: { nextDate: 'asc' },
  })
}

export async function createRecurrence(userId: string, data: CreateCostRecurrenceInput) {
  const type = await prisma.costType.findFirst({
    where: { id: data.costTypeId, userId, deletedAt: null },
  })
  if (!type) throw Object.assign(new Error('TYPE_NOT_FOUND'), { statusCode: 404 })

  const startDate = new Date(data.startDate)
  const nextDate = calcNextDate(startDate, data.unit, data.interval)

  if (data.existingCostId) {
    const existingCost = await prisma.cost.findFirst({
      where: { id: data.existingCostId, userId, deletedAt: null },
    })

    if (!existingCost) {
      throw Object.assign(new Error('COST_NOT_FOUND'), { statusCode: 404 })
    }

    return prisma.$transaction(async (tx) => {
      const recurrence = await tx.costRecurrence.create({
        data: {
          userId,
          costTypeId: data.costTypeId,
          amount: data.amount,
          description: data.description,
          unit: data.unit,
          interval: data.interval,
          startDate,
          nextDate,
          maxOccurrences: data.maxOccurrences ?? null,
          occurrenceCount: 1,
        },
      })

      await tx.cost.update({
        where: { id: data.existingCostId },
        data: {
          costTypeId: data.costTypeId,
          amount: data.amount,
          description: data.description,
          date: startDate,
          recurrenceId: recurrence.id,
        },
      })

      return recurrence
    })
  }

  // Cria a regra e já registra a primeira ocorrência
  return prisma.$transaction(async (tx) => {
    const recurrence = await tx.costRecurrence.create({
      data: {
        userId,
        costTypeId: data.costTypeId,
        amount: data.amount,
        description: data.description,
        unit: data.unit,
        interval: data.interval,
        startDate,
        nextDate,
        maxOccurrences: data.maxOccurrences ?? null,
        occurrenceCount: 1,
      },
    })

    await tx.cost.create({
      data: {
        userId,
        costTypeId: data.costTypeId,
        amount: data.amount,
        description: data.description,
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
  data: UpdateCostRecurrenceInput,
) {
  const rec = await prisma.costRecurrence.findFirst({
    where: { id: recurrenceId, userId, deletedAt: null },
  })
  if (!rec) throw Object.assign(new Error('RECURRENCE_NOT_FOUND'), { statusCode: 404 })

  return prisma.costRecurrence.update({
    where: { id: recurrenceId },
    data: {
      amount: data.amount,
      description: data.description,
      unit: data.unit,
      interval: data.interval,
      maxOccurrences: data.maxOccurrences,
      isActive: data.isActive,
    },
  })
}

export async function softDeleteRecurrence(userId: string, recurrenceId: string) {
  const rec = await prisma.costRecurrence.findFirst({
    where: { id: recurrenceId, userId, deletedAt: null },
  })
  if (!rec) throw Object.assign(new Error('RECURRENCE_NOT_FOUND'), { statusCode: 404 })

  return prisma.costRecurrence.update({
    where: { id: recurrenceId },
    data: { deletedAt: new Date(), isActive: false },
  })
}

// ================================================================
// Cost
// ================================================================

export async function listCosts(userId: string, query: CostListQuery) {
  const { dateFrom, dateTo, areaId, costTypeId, page, limit } = query

  let typeIds: string[] | undefined
  if (areaId) {
    const types = await prisma.costType.findMany({
      where: { areaId, userId, deletedAt: null },
      select: { id: true },
    })
    typeIds = types.map((t) => t.id)
    if (typeIds.length === 0) return { costs: [], total: 0, page, limit }
  }

  const where = {
    userId,
    deletedAt: null as null,
    ...(costTypeId ? { costTypeId } : typeIds ? { costTypeId: { in: typeIds } } : {}),
    ...(dateFrom || dateTo
      ? {
          date: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
  }

  const [costs, total] = await prisma.$transaction([
    prisma.cost.findMany({
      where,
      include: { costType: { select: { id: true, name: true, areaId: true } } },
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.cost.count({ where }),
  ])

  return { costs, total, page, limit }
}

export async function createCost(userId: string, data: CreateCostInput) {
  const type = await prisma.costType.findFirst({
    where: { id: data.costTypeId, userId, deletedAt: null },
  })
  if (!type) throw Object.assign(new Error('TYPE_NOT_FOUND'), { statusCode: 404 })

  return prisma.cost.create({
    data: {
      userId,
      costTypeId: data.costTypeId,
      amount: data.amount,
      description: data.description,
      date: new Date(data.date),
    },
  })
}

export async function updateCost(userId: string, costId: string, data: UpdateCostInput) {
  const cost = await prisma.cost.findFirst({ where: { id: costId, userId, deletedAt: null } })
  if (!cost) throw Object.assign(new Error('COST_NOT_FOUND'), { statusCode: 404 })

  if (data.costTypeId) {
    const type = await prisma.costType.findFirst({
      where: { id: data.costTypeId, userId, deletedAt: null },
    })
    if (!type) throw Object.assign(new Error('TYPE_NOT_FOUND'), { statusCode: 404 })
  }

  if (data.recurrenceId) {
    const recurrence = await prisma.costRecurrence.findFirst({
      where: { id: data.recurrenceId, userId, deletedAt: null },
    })

    if (!recurrence) {
      throw Object.assign(new Error('RECURRENCE_NOT_FOUND'), { statusCode: 404 })
    }
  }

  return prisma.cost.update({
    where: { id: costId },
    data: {
      costTypeId: data.costTypeId,
      amount: data.amount,
      description: data.description,
      date: data.date ? new Date(data.date) : undefined,
      recurrenceId: data.recurrenceId,
    },
  })
}

export async function softDeleteCost(userId: string, costId: string) {
  const cost = await prisma.cost.findFirst({ where: { id: costId, userId, deletedAt: null } })
  if (!cost) throw Object.assign(new Error('COST_NOT_FOUND'), { statusCode: 404 })

  return prisma.cost.update({ where: { id: costId }, data: { deletedAt: new Date() } })
}

// ================================================================
// Analytics
// ================================================================

export async function analyticsCosts(userId: string, query: CostAnalyticsQuery) {
  const dateFrom = new Date(query.dateFrom)
  const dateTo = new Date(query.dateTo)

  // Resolve typeIds when filtering by area (without a specific costTypeId)
  let typeIds: string[] | undefined
  if (query.areaId && !query.costTypeId) {
    const types = await prisma.costType.findMany({
      where: { areaId: query.areaId, userId, deletedAt: null },
      select: { id: true },
    })
    typeIds = types.map((t) => t.id)
    if (typeIds.length === 0) {
      return { summary: { total: 0, count: 0, average: 0 }, byMonth: [], byArea: [], byType: [] }
    }
  }

  const costs = await prisma.cost.findMany({
    where: {
      userId,
      deletedAt: null,
      date: { gte: dateFrom, lte: dateTo },
      ...(query.costTypeId
        ? { costTypeId: query.costTypeId }
        : typeIds
        ? { costTypeId: { in: typeIds } }
        : {}),
    },
    include: {
      costType: {
        select: {
          id: true,
          name: true,
          areaId: true,
          area: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { date: 'asc' },
  })

  // Total geral
  const total = costs.reduce((sum, c) => sum + Number(c.amount), 0)
  const count = costs.length
  const average = count > 0 ? total / count : 0

  // Total por mês (YYYY-MM)
  const byMonthMap = new Map<string, number>()
  for (const c of costs) {
    const key = c.date.toISOString().slice(0, 7) // YYYY-MM
    byMonthMap.set(key, (byMonthMap.get(key) ?? 0) + Number(c.amount))
  }
  const byMonth = Array.from(byMonthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total }))

  // Total por área
  const byAreaMap = new Map<string, { areaId: string; areaName: string; total: number }>()
  for (const c of costs) {
    const { id: areaId, name: areaName } = c.costType.area
    const entry = byAreaMap.get(areaId) ?? { areaId, areaName, total: 0 }
    entry.total += Number(c.amount)
    byAreaMap.set(areaId, entry)
  }
  const byArea = Array.from(byAreaMap.values()).sort((a, b) => b.total - a.total)

  // Total por tipo
  const byTypeMap = new Map<
    string,
    { typeId: string; typeName: string; areaId: string; areaName: string; total: number; count: number }
  >()
  for (const c of costs) {
    const { id: typeId, name: typeName, area } = c.costType
    const entry = byTypeMap.get(typeId) ?? {
      typeId,
      typeName,
      areaId: area.id,
      areaName: area.name,
      total: 0,
      count: 0,
    }
    entry.total += Number(c.amount)
    entry.count += 1
    byTypeMap.set(typeId, entry)
  }
  const byType = Array.from(byTypeMap.values()).sort((a, b) => b.total - a.total)

  return { summary: { total, count, average }, byMonth, byArea, byType }
}
