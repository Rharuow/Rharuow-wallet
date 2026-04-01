import { FastifyInstance, FastifyReply } from 'fastify'
import { authenticate } from '../../plugins/authenticate'
import { checkWalletAccess } from '../../plugins/walletAccess'
import {
  CreateIncomeRecurrenceSchema,
  UpdateIncomeRecurrenceSchema,
  CreateIncomeSchema,
  UpdateIncomeSchema,
  IncomeListQuerySchema,
  IncomeAnalyticsQuerySchema,
} from './incomes.schema'
import {
  listRecurrences,
  createRecurrence,
  updateRecurrence,
  softDeleteRecurrence,
  listIncomes,
  createIncome,
  updateIncome,
  softDeleteIncome,
  analyticsIncomes,
} from './incomes.service'

function handleServiceError(err: unknown, reply: FastifyReply) {
  const e = err as Error & { statusCode?: number }
  const code = e.statusCode ?? 500
  return reply.status(code).send({ error: e.message })
}

export async function incomesRoutes(fastify: FastifyInstance) {
  // ----------------------------------------------------------------
  // IncomeRecurrence
  // ----------------------------------------------------------------

  fastify.get('/recurrences', {
    preHandler: [authenticate, checkWalletAccess('read')],
    schema: {
      tags: ['Incomes'],
      summary: 'Listar regras de recorrência de entradas',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const recurrences = await listRecurrences(request.walletContext!.ownerId)
    return reply.send({ recurrences })
  })

  fastify.post('/recurrences', {
    preHandler: [authenticate, checkWalletAccess('write')],
    schema: {
      tags: ['Incomes'],
      summary: 'Criar regra de recorrência de entrada',
      description: 'Cria a regra e já registra a primeira ocorrência de entrada.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name', 'amount', 'unit', 'interval', 'startDate'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string', maxLength: 255 },
          amount: { type: 'number', minimum: 0.01 },
          unit: { type: 'string', enum: ['DAY', 'WEEK', 'MONTH', 'YEAR'] },
          interval: { type: 'integer', minimum: 1 },
          startDate: { type: 'string', format: 'date-time' },
          maxOccurrences: { type: 'integer', minimum: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const body = CreateIncomeRecurrenceSchema.parse(request.body)
    try {
      const recurrence = await createRecurrence(request.walletContext!.ownerId, body)
      return reply.status(201).send({ recurrence })
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  fastify.patch<{ Params: { id: string } }>('/recurrences/:id', {
    preHandler: [authenticate, checkWalletAccess('write')],
    schema: {
      tags: ['Incomes'],
      summary: 'Atualizar / pausar / retomar recorrência de entrada',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  }, async (request, reply) => {
    const body = UpdateIncomeRecurrenceSchema.parse(request.body)
    try {
      const recurrence = await updateRecurrence(request.walletContext!.ownerId, request.params.id, body)
      return reply.send({ recurrence })
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  fastify.delete<{ Params: { id: string } }>('/recurrences/:id', {
    preHandler: [authenticate, checkWalletAccess('write')],
    schema: {
      tags: ['Incomes'],
      summary: 'Deletar recorrência de entrada (soft delete)',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  }, async (request, reply) => {
    try {
      await softDeleteRecurrence(request.walletContext!.ownerId, request.params.id)
      return reply.status(204).send()
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  // ----------------------------------------------------------------
  // Income
  // ----------------------------------------------------------------

  fastify.get<{ Querystring: Record<string, string> }>('/', {
    preHandler: [authenticate, checkWalletAccess('read')],
    schema: {
      tags: ['Incomes'],
      summary: 'Listar entradas com filtros de data',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          dateFrom: { type: 'string', format: 'date-time' },
          dateTo: { type: 'string', format: 'date-time' },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      },
    },
  }, async (request, reply) => {
    const query = IncomeListQuerySchema.parse(request.query)
    const result = await listIncomes(request.walletContext!.ownerId, query)
    return reply.send(result)
  })

  fastify.post('/', {
    preHandler: [authenticate, checkWalletAccess('write')],
    schema: {
      tags: ['Incomes'],
      summary: 'Registrar entrada avulsa',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name', 'amount', 'date'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string', maxLength: 255 },
          amount: { type: 'number', minimum: 0.01 },
          date: { type: 'string', format: 'date-time' },
        },
      },
    },
  }, async (request, reply) => {
    const body = CreateIncomeSchema.parse(request.body)
    try {
      const income = await createIncome(request.walletContext!.ownerId, body)
      return reply.status(201).send({ income })
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  fastify.patch<{ Params: { id: string } }>('/:id', {
    preHandler: [authenticate, checkWalletAccess('write')],
    schema: {
      tags: ['Incomes'],
      summary: 'Atualizar entrada',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  }, async (request, reply) => {
    const body = UpdateIncomeSchema.parse(request.body)
    try {
      const income = await updateIncome(request.walletContext!.ownerId, request.params.id, body)
      return reply.send({ income })
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  fastify.delete<{ Params: { id: string } }>('/:id', {
    preHandler: [authenticate, checkWalletAccess('write')],
    schema: {
      tags: ['Incomes'],
      summary: 'Deletar entrada (soft delete)',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  }, async (request, reply) => {
    try {
      await softDeleteIncome(request.walletContext!.ownerId, request.params.id)
      return reply.status(204).send()
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  // ----------------------------------------------------------------
  // Analytics
  // ----------------------------------------------------------------

  fastify.get<{ Querystring: { dateFrom: string; dateTo: string } }>('/analytics', {
    preHandler: [authenticate, checkWalletAccess('read')],
    schema: {
      tags: ['Incomes'],
      summary: 'Análise de entradas por período',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        required: ['dateFrom', 'dateTo'],
        properties: {
          dateFrom: { type: 'string', format: 'date-time' },
          dateTo: { type: 'string', format: 'date-time' },
        },
      },
    },
  }, async (request, reply) => {
    const query = IncomeAnalyticsQuerySchema.parse(request.query)
    try {
      const analytics = await analyticsIncomes(request.walletContext!.ownerId, query)
      return reply.send(analytics)
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })
}
