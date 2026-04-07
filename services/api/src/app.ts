import 'dotenv/config'
import Fastify, { FastifyRequest } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import websocket from '@fastify/websocket'
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
import { incomesRoutes } from './modules/incomes/incomes.routes'
import { marketRoutes } from './modules/market/market.routes'
import { paymentsRoutes } from './modules/payments/payments.routes'
import { aiRoutes } from './modules/ai/ai.routes'
import { walletSharingRoutes } from './modules/wallet-sharing/wallet-sharing.routes'
import { notificationsRoutes } from './modules/notifications/notifications.routes'
import { creditsRoutes } from './modules/credits/credits.routes'
import { reportsRoutes } from './modules/reports/reports.routes'

export async function buildServer() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET env var is required')
  }

  const server = Fastify({
    logger:
      process.env.NODE_ENV === 'test'
        ? false
        : {
            level: process.env.LOG_LEVEL ?? 'info',
          },
  })

  console.log(`REPORT_AUTO_WEB_SEARCH_ENABLED = ${process.env.REPORT_AUTO_WEB_SEARCH_ENABLED}`);
  

  server.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body, done) => {
      ;(req as FastifyRequest & { rawBody?: Buffer }).rawBody = body as Buffer
      try {
        const bodyStr = (body as Buffer).toString().trim()
        done(null, bodyStr ? JSON.parse(bodyStr) : {})
      } catch (e) {
        done(e as Error, undefined)
      }
    },
  )

  await server.register(helmet)
  await server.register(cors, {
    origin: process.env.CORS_ORIGIN ?? '*',
    credentials: true,
  })

  await server.register(jwt, {
    secret: process.env.JWT_SECRET!,
  })

  await server.register(websocket)

  if (process.env.NODE_ENV !== 'test') {
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
          { name: 'Incomes', description: 'Gestão de entradas (receitas)' },
          { name: 'Market', description: 'Visão geral do mercado (USD, EUR, BTC, Ibovespa)' },
          { name: 'Payments', description: 'Pagamento e assinaturas' },
          { name: 'Credits', description: 'Carteira de creditos e recargas' },
          { name: 'Reports', description: 'Relatórios on-demand e acesso temporário' },
          { name: 'AI', description: 'Insights financeiros com Inteligência Artificial' },
          { name: 'Wallet Sharing', description: 'Compartilhamento de carteira' },
          { name: 'Notifications', description: 'Notificações in-app' },
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
  }

  await server.register(authRoutes, { prefix: '/v1/auth' })
  await server.register(usersRoutes, { prefix: '/v1/users' })
  await server.register(portfolioRoutes, { prefix: '/v1/portfolio' })
  await server.register(rolesRoutes, { prefix: '/v1/roles' })
  await server.register(fiisRoutes, { prefix: '/v1' })
  await server.register(stocksRoutes, { prefix: '/v1' })
  await server.register(costsRoutes, { prefix: '/v1/costs' })
  await server.register(incomesRoutes, { prefix: '/v1/incomes' })
  await server.register(marketRoutes, { prefix: '/v1' })
  await server.register(paymentsRoutes, { prefix: '/v1' })
  await server.register(creditsRoutes, { prefix: '/v1/credits' })
  await server.register(reportsRoutes, { prefix: '/v1/reports' })
  await server.register(aiRoutes, { prefix: '/v1/ai' })
  await server.register(walletSharingRoutes, { prefix: '/v1/wallet' })
  await server.register(notificationsRoutes, { prefix: '/v1/notifications' })

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

  server.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', details: error.errors })
    }

    const statusCode = (error as { statusCode?: number }).statusCode ?? 500
    server.log.error(error)

    return reply.status(statusCode).send({
      error: error.message ?? 'Internal Server Error',
    })
  })

  return server
}