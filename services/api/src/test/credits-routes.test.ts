import assert from 'node:assert/strict'
import { Prisma } from '@prisma/client'
import { after, beforeEach, test } from 'node:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import {
  createCreditTopupOrder,
  markCreditTopupOrderPaid,
} from '../modules/credits/credits.service'
import {
  authHeaders,
  cleanupTestData,
  createTestServer,
  createTestUser,
  finalizeTestProcess,
  parseJson,
} from './testUtils'

let server: FastifyInstance

beforeEach(async () => {
  await cleanupTestData()
  server = await createTestServer()
})

after(async () => {
  await finalizeTestProcess(server)
})

test('credits-routes.spec: retorna saldo e extrato do usuario autenticado', async () => {
  const user = await createTestUser({ name: 'Credits Route User' })

  const order = await createCreditTopupOrder({
    userId: user.id,
    amount: 7,
    stripeCheckoutSessionId: 'cs_test_credits_route',
  })
  await markCreditTopupOrderPaid({
    orderId: order.id,
    stripePaymentIntentId: 'pi_test_credits_route',
  })

  const balanceResponse = await server.inject({
    method: 'GET',
    url: '/v1/credits/balance',
    headers: authHeaders(server, user),
  })

  assert.equal(balanceResponse.statusCode, 200)
  const balancePayload = parseJson<{ balance: { balance: string } }>(balanceResponse)
  assert.equal(balancePayload.balance.balance, '7')

  const ledgerResponse = await server.inject({
    method: 'GET',
    url: '/v1/credits/ledger?limit=10',
    headers: authHeaders(server, user),
  })

  assert.equal(ledgerResponse.statusCode, 200)
  const ledgerPayload = parseJson<{
    total: number
    entries: Array<{ amount: string; balanceAfter: string }>
  }>(ledgerResponse)

  assert.equal(ledgerPayload.total, 1)
  assert.equal(ledgerPayload.entries.length, 1)
  assert.equal(new Prisma.Decimal(ledgerPayload.entries[0].amount).toFixed(2), '7.00')
  assert.equal(new Prisma.Decimal(ledgerPayload.entries[0].balanceAfter).toFixed(2), '7.00')
})