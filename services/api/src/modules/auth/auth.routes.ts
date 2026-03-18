import { FastifyInstance } from 'fastify'
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from './auth.schema'
import { loginUser, registerUser, verifyEmail, forgotPassword, resetPassword } from './auth.service'

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
          required: ['email', 'password'],
          properties: {
            name: { type: 'string', minLength: 2 },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            roleId: { type: 'string', description: 'ID da role (opcional, padrão: User)' },
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
                  plan: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string', enum: ['FREE', 'PREMIUM'] },
                    },
                  },
                  planExpiresAt: { type: 'string', format: 'date-time', nullable: true },
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

  /**
   * GET /v1/auth/verify-email?token=xxx
   * Confirma o e-mail e ativa a conta do usuário.
   */
  fastify.get(
    '/verify-email',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Verificar e-mail',
        description: 'Ativa a conta do usuário a partir do token enviado por e-mail.',
        querystring: {
          type: 'object',
          required: ['token'],
          properties: {
            token: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { token } = request.query as { token: string }
      await verifyEmail(token)
      return reply.send({ message: 'E-mail confirmado. Você já pode fazer login.' })
    },
  )

  /**
   * POST /v1/auth/forgot-password
   * Envia e-mail de redefinição de senha.
   */
  fastify.post(
    '/forgot-password',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Solicitar redefinição de senha',
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const body = forgotPasswordSchema.parse(request.body)
      await forgotPassword(body)
      // Always return 200 to avoid e-mail enumeration
      return reply.send({ message: 'Se este e-mail estiver cadastrado, você receberá as instruções em breve.' })
    },
  )

  /**
   * POST /v1/auth/reset-password
   * Redefine a senha a partir do token recebido por e-mail.
   */
  fastify.post(
    '/reset-password',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Redefinir senha',
        body: {
          type: 'object',
          required: ['token', 'password'],
          properties: {
            token: { type: 'string' },
            password: { type: 'string', minLength: 8 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const body = resetPasswordSchema.parse(request.body)
        await resetPassword(body)
        return reply.send({ message: 'Senha redefinida com sucesso. Você já pode fazer login.' })
      } catch (err) {
        const e = err as Error & { statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    },
  )
}

