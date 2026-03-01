import { FastifyInstance } from 'fastify'
import { authenticate } from '../../plugins/authenticate'
import { updateUserSchema } from './users.schema'
import { getUserById, updateUser } from './users.service'

export async function usersRoutes(fastify: FastifyInstance) {
  /**
   * GET /v1/users/me
   * Retorna o perfil do usuário autenticado.
   */
  fastify.get(
    '/me',
    {
      preHandler: authenticate,
      schema: {
        tags: ['Users'],
        summary: 'Perfil do usuário autenticado',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  role: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                    },
                  },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await getUserById(request.user.sub)
      if (!user) {
        return reply.status(404).send({ error: 'USER_NOT_FOUND' })
      }
      return reply.send({ user })
    },
  )

  /**
   * PATCH /v1/users/me
   * Atualiza o perfil do usuário autenticado.
   */
  fastify.patch(
    '/me',
    {
      preHandler: authenticate,
      schema: {
        tags: ['Users'],
        summary: 'Atualizar perfil',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 2 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  role: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                    },
                  },
                  updatedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = updateUserSchema.parse(request.body)
      const user = await updateUser(request.user.sub, body)
      return reply.send({ user })
    },
  )
}

