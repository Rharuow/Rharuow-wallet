import { NotificationType } from '@prisma/client'
import fastifyWebsocket = require('@fastify/websocket')
import { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../plugins/authenticate'
import { NotificationIdParamsSchema, NotificationsQuerySchema } from './notifications.schema'
import { registerNotificationsSocket } from './notifications-realtime'
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

const NotificationsSocketQuerySchema = z.object({
  token: z.string().min(1),
})

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
          type: { type: 'string', enum: Object.values(NotificationType) },
          status: { type: 'string', enum: ['all', 'read', 'unread'] },
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

  fastify.get('/ws-token', {
    preHandler: authenticate,
    schema: {
      tags: ['Notifications'],
      summary: 'Emitir token de curta duração para websocket de notificações',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const token = await reply.jwtSign(
      {
        sub: request.user.sub,
        email: request.user.email,
        role: request.user.role,
        purpose: 'notifications-ws',
      },
      { expiresIn: '15m' },
    )

    return reply.send({ token, expiresInSeconds: 900 })
  })

  fastify.get('/ws', { websocket: true }, async (connection: fastifyWebsocket.SocketStream, request) => {
    try {
      const query = NotificationsSocketQuerySchema.parse(request.query)
      const payload = await fastify.jwt.verify<{
        sub: string
        purpose?: string
      }>(query.token)

      if (payload.purpose !== 'notifications-ws' || !payload.sub) {
        connection.socket.close(1008, 'Unauthorized')
        return
      }

      registerNotificationsSocket(payload.sub, connection.socket)
    } catch {
      connection.socket.close(1008, 'Unauthorized')
    }
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
      request.log.error({ err, requestId: request.id, userId: request.user.sub, notificationId: params.id }, 'notifications.mark_read_failed')
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
      request.log.error({ err, requestId: request.id, userId: request.user.sub, notificationId: params.id }, 'notifications.delete_failed')
      return handleServiceError(err, reply)
    }
  })
}