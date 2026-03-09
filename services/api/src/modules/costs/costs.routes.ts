import { FastifyInstance, FastifyReply } from 'fastify'
import { authenticate } from '../../plugins/authenticate'
import {
  CreateCostAreaSchema,
  UpdateCostAreaSchema,
  CreateCostTypeSchema,
  UpdateCostTypeSchema,
  CreateCostRecurrenceSchema,
  UpdateCostRecurrenceSchema,
  CreateCostSchema,
  UpdateCostSchema,
  CostListQuerySchema,
  CostAnalyticsQuerySchema,
} from './costs.schema'
import {
  listAreas,
  createArea,
  updateArea,
  softDeleteArea,
  listTypes,
  createType,
  updateType,
  softDeleteType,
  listRecurrences,
  createRecurrence,
  updateRecurrence,
  softDeleteRecurrence,
  listCosts,
  createCost,
  updateCost,
  softDeleteCost,
  analyticsCosts,
} from './costs.service'

function handleServiceError(err: unknown, reply: FastifyReply) {
  const e = err as Error & { statusCode?: number }
  const code = e.statusCode ?? 500
  return reply.status(code).send({ error: e.message })
}

export async function costsRoutes(fastify: FastifyInstance) {
  // ----------------------------------------------------------------
  // CostArea
  // ----------------------------------------------------------------

  fastify.get('/areas', {
    preHandler: authenticate,
    schema: {
      tags: ['Costs'],
      summary: 'Listar áreas de custo (globais + personalizadas)',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const areas = await listAreas(request.user.sub)
    return reply.send({ areas })
  })

  fastify.post('/areas', {
    preHandler: authenticate,
    schema: {
      tags: ['Costs'],
      summary: 'Criar área de custo personalizada',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string', minLength: 1, maxLength: 80 } },
      },
    },
  }, async (request, reply) => {
    const body = CreateCostAreaSchema.parse(request.body)
    try {
      const area = await createArea(request.user.sub, body)
      return reply.status(201).send({ area })
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  fastify.patch<{ Params: { id: string } }>('/areas/:id', {
    preHandler: authenticate,
    schema: {
      tags: ['Costs'],
      summary: 'Atualizar área de custo personalizada',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string', minLength: 1, maxLength: 80 } },
      },
    },
  }, async (request, reply) => {
    const body = UpdateCostAreaSchema.parse(request.body)
    try {
      const area = await updateArea(request.user.sub, request.params.id, body)
      return reply.send({ area })
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  fastify.delete<{ Params: { id: string } }>('/areas/:id', {
    preHandler: authenticate,
    schema: {
      tags: ['Costs'],
      summary: 'Deletar área de custo personalizada (soft delete)',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  }, async (request, reply) => {
    try {
      await softDeleteArea(request.user.sub, request.params.id)
      return reply.status(204).send()
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  // ----------------------------------------------------------------
  // CostType
  // ----------------------------------------------------------------

  fastify.get<{ Querystring: { areaId?: string } }>('/types', {
    preHandler: authenticate,
    schema: {
      tags: ['Costs'],
      summary: 'Listar tipos de custo do usuário',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: { areaId: { type: 'string', description: 'Filtrar por área' } },
      },
    },
  }, async (request, reply) => {
    const types = await listTypes(request.user.sub, request.query.areaId)
    return reply.send({ types })
  })

  fastify.post('/types', {
    preHandler: authenticate,
    schema: {
      tags: ['Costs'],
      summary: 'Criar tipo de custo',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name', 'areaId'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 80 },
          areaId: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const body = CreateCostTypeSchema.parse(request.body)
    try {
      const type = await createType(request.user.sub, body)
      return reply.status(201).send({ type })
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  fastify.patch<{ Params: { id: string } }>('/types/:id', {
    preHandler: authenticate,
    schema: {
      tags: ['Costs'],
      summary: 'Atualizar tipo de custo',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  }, async (request, reply) => {
    const body = UpdateCostTypeSchema.parse(request.body)
    try {
      const type = await updateType(request.user.sub, request.params.id, body)
      return reply.send({ type })
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  fastify.delete<{ Params: { id: string } }>('/types/:id', {
    preHandler: authenticate,
    schema: {
      tags: ['Costs'],
      summary: 'Deletar tipo de custo (soft delete — cascateia para custos e recorrências)',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  }, async (request, reply) => {
    try {
      await softDeleteType(request.user.sub, request.params.id)
      return reply.status(204).send()
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  // ----------------------------------------------------------------
  // CostRecurrence
  // ----------------------------------------------------------------

  fastify.get('/recurrences', {
    preHandler: authenticate,
    schema: {
      tags: ['Costs'],
      summary: 'Listar regras de recorrência do usuário',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const recurrences = await listRecurrences(request.user.sub)
    return reply.send({ recurrences })
  })

  fastify.post('/recurrences', {
    preHandler: authenticate,
    schema: {
      tags: ['Costs'],
      summary: 'Criar regra de recorrência',
      description: 'Cria a regra e já registra a primeira ocorrência de custo.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['costTypeId', 'amount', 'unit', 'interval', 'startDate'],
        properties: {
          costTypeId: { type: 'string' },
          amount: { type: 'number', minimum: 0.01 },
          description: { type: 'string', maxLength: 255 },
          unit: { type: 'string', enum: ['DAY', 'WEEK', 'MONTH', 'YEAR'] },
          interval: { type: 'integer', minimum: 1 },
          startDate: { type: 'string', format: 'date-time' },
          maxOccurrences: { type: 'integer', minimum: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const body = CreateCostRecurrenceSchema.parse(request.body)
    try {
      const recurrence = await createRecurrence(request.user.sub, body)
      return reply.status(201).send({ recurrence })
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  fastify.patch<{ Params: { id: string } }>('/recurrences/:id', {
    preHandler: authenticate,
    schema: {
      tags: ['Costs'],
      summary: 'Atualizar / pausar / retomar recorrência',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  }, async (request, reply) => {
    const body = UpdateCostRecurrenceSchema.parse(request.body)
    try {
      const recurrence = await updateRecurrence(request.user.sub, request.params.id, body)
      return reply.send({ recurrence })
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  fastify.delete<{ Params: { id: string } }>('/recurrences/:id', {
    preHandler: authenticate,
    schema: {
      tags: ['Costs'],
      summary: 'Deletar recorrência (soft delete)',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  }, async (request, reply) => {
    try {
      await softDeleteRecurrence(request.user.sub, request.params.id)
      return reply.status(204).send()
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  // ----------------------------------------------------------------
  // Cost
  // ----------------------------------------------------------------

  fastify.get<{ Querystring: Record<string, string> }>('/', {
    preHandler: authenticate,
    schema: {
      tags: ['Costs'],
      summary: 'Listar custos com filtros de data, área e tipo',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          dateFrom: { type: 'string', format: 'date-time', description: 'Data inicial (ISO 8601)' },
          dateTo: { type: 'string', format: 'date-time', description: 'Data final (ISO 8601)' },
          areaId: { type: 'string', description: 'Filtrar por área' },
          costTypeId: { type: 'string', description: 'Filtrar por tipo' },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      },
    },
  }, async (request, reply) => {
    const query = CostListQuerySchema.parse(request.query)
    const result = await listCosts(request.user.sub, query)
    return reply.send(result)
  })

  fastify.post('/', {
    preHandler: authenticate,
    schema: {
      tags: ['Costs'],
      summary: 'Registrar custo avulso',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['costTypeId', 'amount', 'date'],
        properties: {
          costTypeId: { type: 'string' },
          amount: { type: 'number', minimum: 0.01 },
          description: { type: 'string', maxLength: 255 },
          date: { type: 'string', format: 'date-time' },
        },
      },
    },
  }, async (request, reply) => {
    const body = CreateCostSchema.parse(request.body)
    try {
      const cost = await createCost(request.user.sub, body)
      return reply.status(201).send({ cost })
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  fastify.patch<{ Params: { id: string } }>('/:id', {
    preHandler: authenticate,
    schema: {
      tags: ['Costs'],
      summary: 'Atualizar custo',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  }, async (request, reply) => {
    const body = UpdateCostSchema.parse(request.body)
    try {
      const cost = await updateCost(request.user.sub, request.params.id, body)
      return reply.send({ cost })
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  fastify.delete<{ Params: { id: string } }>('/:id', {
    preHandler: authenticate,
    schema: {
      tags: ['Costs'],
      summary: 'Deletar custo (soft delete)',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  }, async (request, reply) => {
    try {
      await softDeleteCost(request.user.sub, request.params.id)
      return reply.status(204).send()
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  // ----------------------------------------------------------------
  // Analytics
  // ----------------------------------------------------------------

  fastify.get<{ Querystring: { dateFrom: string; dateTo: string; areaId?: string; costTypeId?: string } }>('/analytics', {
    preHandler: authenticate,
    schema: {
      tags: ['Costs'],
      summary: 'Análise de custos por período',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        required: ['dateFrom', 'dateTo'],
        properties: {
          dateFrom: { type: 'string', format: 'date-time' },
          dateTo: { type: 'string', format: 'date-time' },
          areaId: { type: 'string', description: 'Filtrar por área' },
          costTypeId: { type: 'string', description: 'Filtrar por tipo de custo' },
        },
      },
    },
  }, async (request, reply) => {
    const query = CostAnalyticsQuerySchema.parse(request.query)
    try {
      const analytics = await analyticsCosts(request.user.sub, query)
      return reply.send(analytics)
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })
}
