import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { authenticate } from '../../plugins/authenticate'
import {
  createCheckoutSession,
  cancelSubscription,
  getPaymentStatus,
  handleWebhook,
  activateFromSession,
} from './payments.service'
import { checkoutSchema } from './payments.schema'

export async function paymentsRoutes(fastify: FastifyInstance) {
  // POST /v1/payments/checkout — cria sessão de pagamento
  fastify.post(
    '/payments/checkout',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = request.user as { sub: string }
      const body = checkoutSchema.parse(request.body)
      const result = await createCheckoutSession(userId, body.priceId)
      return reply.send(result)
    },
  )

  // POST /v1/payments/cancel — cancela assinatura
  fastify.post(
    '/payments/cancel',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = request.user as { sub: string }
      const result = await cancelSubscription(userId)
      return reply.send(result)
    },
  )

  // GET /v1/payments/status — status do plano atual
  fastify.get(
    '/payments/status',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = request.user as { sub: string }
      const result = await getPaymentStatus(userId)
      return reply.send(result)
    },
  )

  // POST /v1/payments/webhook — recebe eventos do Stripe
  fastify.post(
    '/payments/webhook',
    {},
    async (request: FastifyRequest, reply: FastifyReply) => {
      const signature = request.headers['stripe-signature']
      if (!signature || typeof signature !== 'string') {
        return reply.status(400).send({ error: 'Missing stripe-signature header' })
      }

      const rawBody = (request as FastifyRequest & { rawBody?: Buffer }).rawBody
      if (!rawBody) {
        return reply.status(400).send({ error: 'Raw body not available' })
      }

      await handleWebhook(rawBody, signature)
      return reply.send({ received: true })
    },
  )

  // POST /v1/payments/activate — ativa plano após checkout (fallback sem webhook)
  fastify.post(
    '/payments/activate',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = request.user as { sub: string }
      const { sessionId } = request.body as { sessionId: string }
      if (!sessionId) {
        return reply.status(400).send({ error: 'sessionId é obrigatório' })
      }
      const result = await activateFromSession(userId, sessionId)
      return reply.send(result)
    },
  )
}
