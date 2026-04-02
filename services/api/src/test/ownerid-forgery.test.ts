import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import {
  authHeaders,
  cleanupTestData,
  createCostFixtures,
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

test('ownerid-forgery.spec: usuário sem acesso recebe 403 ao forjar ownerId', async () => {
  const owner = await createTestUser({ name: 'Owner' })
  const attacker = await createTestUser({ name: 'Attacker' })
  await createCostFixtures(owner.id)

  const response = await server.inject({
    method: 'GET',
    url: '/v1/costs',
    headers: {
      ...authHeaders(server, attacker),
      'x-wallet-owner': owner.id,
    },
  })

  assert.equal(response.statusCode, 403)
  assert.deepEqual(parseJson(response), { error: 'ACCESS_DENIED' })
})