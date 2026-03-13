import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { ZodError } from 'zod'

import { authRoutes } from './modules/auth/auth.routes'
import { usersRoutes } from './modules/users/users.routes'
import { portfolioRoutes } from './modules/portfolio/portfolio.routes'
import { rolesRoutes } from './modules/roles/roles.routes'
import { fiisRoutes } from './modules/fiis/fiis.routes'
import { stocksRoutes } from './modules/stocks/stocks.routes'
import { costsRoutes } from './modules/costs/costs.routes'
import { marketRoutes } from './modules/market/market.routes'
import { seed } from './lib/seed'

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET env var is required')
}

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
})

async function bootstrap() {
  // --- Plugins de segurança ---
  await server.register(helmet)
  await server.register(cors, {
    origin: process.env.CORS_ORIGIN ?? '*',
    credentials: true,
  })

  // --- JWT ---
  await server.register(jwt, {
    secret: process.env.JWT_SECRET!,
  })

  // --- Swagger ---
  await server.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'Rharuow Wallet API',
        description: 'Documentação da API do Rharuow Wallet',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://localhost:${process.env.PORT ?? 3001}`,
          description: 'Servidor local',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      tags: [
        { name: 'Auth', description: 'Autenticação' },
        { name: 'Users', description: 'Gerenciamento de usuários' },
        { name: 'Roles', description: 'Gerenciamento de roles' },
        { name: 'Portfolio', description: 'Portfólio do usuário' },
        { name: 'FIIs', description: 'Fundos de Investimento Imobiliário (dados via Fundamentus)' },
        { name: 'Stocks', description: 'Ações da B3 (dados via Fundamentus)' },
        { name: 'Costs', description: 'Gestão de custos domésticos' },
        { name: 'Market', description: 'Visão geral do mercado (USD, EUR, BTC, Ibovespa)' },
      ],
    },
  })

  await server.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
  })

  // --- Rotas ---
  await server.register(authRoutes, { prefix: '/v1/auth' })
  await server.register(usersRoutes, { prefix: '/v1/users' })
  await server.register(portfolioRoutes, { prefix: '/v1/portfolio' })
  await server.register(rolesRoutes, { prefix: '/v1/roles' })
  await server.register(fiisRoutes, { prefix: '/v1' })
  await server.register(stocksRoutes, { prefix: '/v1' })
  await server.register(costsRoutes, { prefix: '/v1/costs' })
  await server.register(marketRoutes, { prefix: '/v1' })

  // --- Health check ---
  server.get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Health check',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    async () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
    }),
  )

  // --- Handler global de erros ---
  server.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply
        .status(400)
        .send({ error: 'VALIDATION_ERROR', details: error.errors })
    }

    const statusCode = (error as { statusCode?: number }).statusCode ?? 500
    server.log.error(error)

    return reply.status(statusCode).send({
      error: error.message ?? 'Internal Server Error',
    })
  })

  const port = Number(process.env.PORT ?? 3001)
  await server.listen({ port, host: '0.0.0.0' })
  server.log.info(`Server running on port ${port}`)
  server.log.info(`Swagger docs available at http://localhost:${port}/docs`)

  // --- Seed: Root role + usuário default ---
  await seed(server.log)
}

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
