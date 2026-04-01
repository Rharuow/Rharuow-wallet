import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import {
  cleanupTestData,
  createAcceptedInvite,
  createTestServer,
  createTestUser,
  authHeaders,
  finalizeTestProcess,
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

test('invite-revoke.spec: dono revoga acesso e chamada é idempotente', async () => {
  const owner = await createTestUser({ name: 'Owner' })
  const guest = await createTestUser({ name: 'Guest' })

  const invite = await createAcceptedInvite(server, owner, guest)

  const firstResponse = await server.inject({
    method: 'DELETE',
    url: `/v1/wallet/invites/${invite.id}`,
    headers: authHeaders(server, owner),
  })
  assert.equal(firstResponse.statusCode, 204)

  const access = await prisma.walletAccess.findFirst({ where: { inviteId: invite.id } })
  assert.equal(access, null)

  const secondResponse = await server.inject({
    method: 'DELETE',
    url: `/v1/wallet/invites/${invite.id}`,
    headers: authHeaders(server, owner),
  })
  assert.equal(secondResponse.statusCode, 204)
})