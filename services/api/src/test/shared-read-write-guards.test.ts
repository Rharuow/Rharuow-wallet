import assert from 'node:assert/strict'
import { PlanType } from '@prisma/client'
import { after, before, beforeEach, test } from 'node:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import {
  authHeaders,
  cleanupTestData,
  createAcceptedInvite,
  createCostFixtures,
  createIncomeFixture,
  createTestServer,
  createTestUser,
  finalizeTestProcess,
  parseJson,
} from './testUtils'

let server: FastifyInstance

before(async () => {
  server = await createTestServer()
})

beforeEach(async () => {
  await cleanupTestData()
})

after(async () => {
  await finalizeTestProcess(server)
})

test('shared-read-write-guards.spec: convidado FREE pode ler e não pode escrever', async () => {
  const owner = await createTestUser({ name: 'Owner', plan: PlanType.PREMIUM })
  const guest = await createTestUser({ name: 'Guest', plan: PlanType.FREE })
  const { type } = await createCostFixtures(owner.id)
  await createIncomeFixture(owner.id)
  await createAcceptedInvite(server, owner, guest)

  const getCosts = await server.inject({
    method: 'GET',
    url: '/v1/costs',
    headers: {
      ...authHeaders(server, guest),
      'x-wallet-owner': owner.id,
    },
  })
  assert.equal(getCosts.statusCode, 200)
  const costPayload = parseJson<{ costs: Array<unknown> }>(getCosts)
  assert.equal(costPayload.costs.length, 1)

  const getIncomes = await server.inject({
    method: 'GET',
    url: '/v1/incomes',
    headers: {
      ...authHeaders(server, guest),
      'x-wallet-owner': owner.id,
    },
  })
  assert.equal(getIncomes.statusCode, 200)

  const createCost = await server.inject({
    method: 'POST',
    url: '/v1/costs',
    headers: {
      ...authHeaders(server, guest),
      'x-wallet-owner': owner.id,
    },
    payload: {
      costTypeId: type.id,
      amount: 50,
      date: '2026-03-24T00:00:00.000Z',
    },
  })
  assert.equal(createCost.statusCode, 403)
  assert.deepEqual(parseJson(createCost), { error: 'ACCESS_DENIED' })

  const createIncome = await server.inject({
    method: 'POST',
    url: '/v1/incomes',
    headers: {
      ...authHeaders(server, guest),
      'x-wallet-owner': owner.id,
    },
    payload: {
      name: 'Nova entrada',
      amount: 70,
      date: '2026-03-24T00:00:00.000Z',
    },
  })
  assert.equal(createIncome.statusCode, 403)
  assert.deepEqual(parseJson(createIncome), { error: 'ACCESS_DENIED' })
})

test('shared-read-write-guards.spec: convidado PREMIUM pode escrever', async () => {
  const owner = await createTestUser({ name: 'Owner', plan: PlanType.PREMIUM })
  const guest = await createTestUser({ name: 'Guest', plan: PlanType.PREMIUM })
  const { type } = await createCostFixtures(owner.id)
  await createAcceptedInvite(server, owner, guest)

  const createCost = await server.inject({
    method: 'POST',
    url: '/v1/costs',
    headers: {
      ...authHeaders(server, guest),
      'x-wallet-owner': owner.id,
    },
    payload: {
      costTypeId: type.id,
      amount: 80,
      date: '2026-03-24T00:00:00.000Z',
    },
  })
  assert.equal(createCost.statusCode, 201)

  const createIncome = await server.inject({
    method: 'POST',
    url: '/v1/incomes',
    headers: {
      ...authHeaders(server, guest),
      'x-wallet-owner': owner.id,
    },
    payload: {
      name: 'Entrada premium',
      amount: 99,
      date: '2026-03-24T00:00:00.000Z',
    },
  })
  assert.equal(createIncome.statusCode, 201)
})