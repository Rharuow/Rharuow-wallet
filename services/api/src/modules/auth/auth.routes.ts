import { FastifyInstance } from 'fastify'
import { loginSchema, registerSchema } from './auth.schema'
import { loginUser, registerUser } from './auth.service'

export async function authRoutes(fastify: FastifyInstance) {
  /**
   * POST /v1/auth/register
   * Cadastra um novo usuário.
   */
  fastify.post(
    '/register',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Registrar usuário',
        description: 'Cadastra um novo usuário. Requer roleId válido.',
        body: {
          type: 'object',
          required: ['email', 'password', 'roleId'],
          properties: {
            name: { type: 'string', minLength: 2 },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            roleId: { type: 'string', description: 'ID da role do usuário' },
          },
        },
        response: {
          201: {
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
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = registerSchema.parse(request.body)
      const user = await registerUser(body)
      return reply.status(201).send({ user })
    },
  )

  /**
   * POST /v1/auth/login
   * Autentica o usuário e retorna um JWT (7 dias).
   */
  fastify.post(
    '/login',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Login',
        description: 'Autentica o usuário e retorna um JWT válido por 7 dias.',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              token: { type: 'string' },
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
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = loginSchema.parse(request.body)
      const user = await loginUser(body)
      const token = fastify.jwt.sign(
        { sub: user.id, email: user.email, role: user.role?.name ?? '' },
        { expiresIn: '7d' },
      )
      return reply.send({ token, user })
    },
  )
}

