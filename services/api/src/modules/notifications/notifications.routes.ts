import { FastifyInstance, FastifyReply } from 'fastify'
import { authenticate } from '../../plugins/authenticate'
import { NotificationIdParamsSchema, NotificationsQuerySchema } from './notifications.schema'
import {
  deleteNotification,
  getUnreadNotificationsCount,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from './notifications.service'

function handleServiceError(err: unknown, reply: FastifyReply) {
  const error = err as Error & { statusCode?: number }
  return reply.status(error.statusCode ?? 500).send({ error: error.message })
}

export async function notificationsRoutes(fastify: FastifyInstance) {
  fastify.get('/', {
    preHandler: authenticate,
    schema: {
      tags: ['Notifications'],
      summary: 'Listar notificações do usuário autenticado',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50 },
          unreadOnly: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const query = NotificationsQuerySchema.parse(request.query)
    const result = await listNotifications(request.user.sub, query)
    return reply.send(result)
  })

  fastify.get('/unread-count', {
    preHandler: authenticate,
    schema: {
      tags: ['Notifications'],
      summary: 'Contagem de notificações não lidas',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const unreadCount = await getUnreadNotificationsCount(request.user.sub)
    return reply.send({ unreadCount })
  })

  fastify.patch<{ Params: { id: string } }>('/:id/read', {
    preHandler: authenticate,
    schema: {
      tags: ['Notifications'],
      summary: 'Marcar notificação como lida',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const params = NotificationIdParamsSchema.parse(request.params)
    try {
      const notification = await markNotificationAsRead(request.user.sub, params.id)
      return reply.send({ notification })
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  fastify.post('/read-all', {
    preHandler: authenticate,
    schema: {
      tags: ['Notifications'],
      summary: 'Marcar todas as notificações como lidas',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const result = await markAllNotificationsAsRead(request.user.sub)
    return reply.send(result)
  })

  fastify.delete<{ Params: { id: string } }>('/:id', {
    preHandler: authenticate,
    schema: {
      tags: ['Notifications'],
      summary: 'Excluir notificação',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const params = NotificationIdParamsSchema.parse(request.params)
    try {
      await deleteNotification(request.user.sub, params.id)
      return reply.status(204).send()
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })
}