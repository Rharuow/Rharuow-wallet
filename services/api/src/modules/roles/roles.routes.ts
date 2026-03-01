import { FastifyInstance } from 'fastify'
import { authenticate } from '../../plugins/authenticate'
import { createRoleSchema, updateRoleSchema } from './roles.schema'
import {
  createRole,
  deleteRole,
  getRoleById,
  listRoles,
  updateRole,
} from './roles.service'

export async function rolesRoutes(fastify: FastifyInstance) {
  /**
   * POST /v1/roles
   * Cria uma nova role.
   */
  fastify.post(
    '/',
    {
      preHandler: authenticate,
      schema: {
        tags: ['Roles'],
        summary: 'Criar role',
        description: 'Cria uma nova role no sistema.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 2, description: 'Nome da role' },
          },
        },
        response: {
          201: {
            description: 'Role criada com sucesso',
            type: 'object',
            properties: {
              role: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
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
      const body = createRoleSchema.parse(request.body)
      const role = await createRole(body)
      return reply.status(201).send({ role })
    },
  )

  /**
   * GET /v1/roles
   * Lista todas as roles.
   */
  fastify.get(
    '/',
    {
      preHandler: authenticate,
      schema: {
        tags: ['Roles'],
        summary: 'Listar roles',
        description: 'Retorna todas as roles cadastradas.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              roles: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    _count: {
                      type: 'object',
                      properties: { users: { type: 'number' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const roles = await listRoles()
      return reply.send({ roles })
    },
  )

  /**
   * GET /v1/roles/:id
   * Retorna uma role por ID.
   */
  fastify.get(
    '/:id',
    {
      preHandler: authenticate,
      schema: {
        tags: ['Roles'],
        summary: 'Buscar role por ID',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              role: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' },
                  _count: {
                    type: 'object',
                    properties: { users: { type: 'number' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const role = await getRoleById(id)
      if (!role) return reply.status(404).send({ error: 'ROLE_NOT_FOUND' })
      return reply.send({ role })
    },
  )

  /**
   * PATCH /v1/roles/:id
   * Atualiza uma role.
   */
  fastify.patch(
    '/:id',
    {
      preHandler: authenticate,
      schema: {
        tags: ['Roles'],
        summary: 'Atualizar role',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 2 },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = updateRoleSchema.parse(request.body)
      const role = await updateRole(id, body)
      return reply.send({ role })
    },
  )

  /**
   * DELETE /v1/roles/:id
   * Remove uma role (somente se não há usuários associados).
   */
  fastify.delete(
    '/:id',
    {
      preHandler: authenticate,
      schema: {
        tags: ['Roles'],
        summary: 'Remover role',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
        },
        response: { 204: { type: 'null', description: 'Sem conteúdo' } },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await deleteRole(id)
      return reply.status(204).send()
    },
  )
}
