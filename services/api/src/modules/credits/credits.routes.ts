import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { authenticate } from '../../plugins/authenticate'
import { createCreditTopupCheckoutSession } from '../payments/payments.service'
import { getCreditBalance, listCreditLedger } from './credits.service'
import { createCreditTopupSchema, creditLedgerQuerySchema } from './credits.schema'

function serializeBalance(balance: Awaited<ReturnType<typeof getCreditBalance>>) {
  return {
    id: balance.id,
    userId: balance.userId,
    balance: balance.balance.toString(),
    createdAt: balance.createdAt,
    updatedAt: balance.updatedAt,
  }
}

function serializeLedgerEntry(entry: Awaited<ReturnType<typeof listCreditLedger>>[number]) {
  return {
    id: entry.id,
    userId: entry.userId,
    topupOrderId: entry.topupOrderId,
    kind: entry.kind,
    amount: entry.amount.toString(),
    balanceAfter: entry.balanceAfter.toString(),
    description: entry.description,
    metadata: entry.metadata,
    createdAt: entry.createdAt,
  }
}

export async function creditsRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/topups',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { sub: userId } = request.user as { sub: string }
        const body = createCreditTopupSchema.parse(request.body)
        const result = await createCreditTopupCheckoutSession(userId, body.amount)

        request.log.info({
          requestId: request.id,
          userId,
          action: 'credits.topup.create',
          amount: body.amount,
          orderId: result.order.id,
        }, 'credit topup checkout created')

        return reply.status(201).send({
          orderId: result.order.id,
          amount: result.order.amount.toString(),
          status: result.order.status,
          checkoutSessionId: result.checkoutSessionId,
          checkoutUrl: result.checkoutUrl,
        })
      } catch (error) {
        const { sub: userId } = request.user as { sub: string }
        request.log.error({
          err: error,
          requestId: request.id,
          userId,
          action: 'credits.topup.create',
        }, 'credit topup checkout failed')
        throw error
      }
    },
  )

  fastify.get(
    '/balance',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { sub: userId } = request.user as { sub: string }
        const balance = await getCreditBalance(userId)

        request.log.info({
          requestId: request.id,
          userId,
          action: 'credits.balance.get',
        }, 'credit balance fetched')

        return reply.send({ balance: serializeBalance(balance) })
      } catch (error) {
        const { sub: userId } = request.user as { sub: string }
        request.log.error({
          err: error,
          requestId: request.id,
          userId,
          action: 'credits.balance.get',
        }, 'credit balance fetch failed')
        throw error
      }
    },
  )

  fastify.get(
    '/ledger',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { sub: userId } = request.user as { sub: string }
        const query = creditLedgerQuerySchema.parse(request.query)
        const entries = await listCreditLedger(userId)
        const slicedEntries = query.limit ? entries.slice(0, query.limit) : entries

        request.log.info({
          requestId: request.id,
          userId,
          action: 'credits.ledger.get',
          limit: query.limit ?? null,
          total: entries.length,
        }, 'credit ledger fetched')

        return reply.send({
          entries: slicedEntries.map(serializeLedgerEntry),
          total: entries.length,
        })
      } catch (error) {
        const { sub: userId } = request.user as { sub: string }
        request.log.error({
          err: error,
          requestId: request.id,
          userId,
          action: 'credits.ledger.get',
        }, 'credit ledger fetch failed')
        throw error
      }
    },
  )
}