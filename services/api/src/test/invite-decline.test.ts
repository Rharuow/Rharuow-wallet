import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import {
  authHeaders,
  cleanupTestData,
  createInviteViaApi,
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

test('invite-decline.spec: recusa convite e atualiza status', async () => {
  const owner = await createTestUser({ name: 'Owner' })
  const guest = await createTestUser({ name: 'Guest' })

  const inviteResponse = await createInviteViaApi(server, owner, guest.email)
  const invite = parseJson<{ invite: { token: string; id: string } }>(inviteResponse).invite

  const response = await server.inject({
    method: 'POST',
    url: `/v1/wallet/invites/${invite.token}/decline`,
    headers: authHeaders(server, guest),
  })

  assert.equal(response.statusCode, 200)
  const updatedInvite = await prisma.walletInvite.findUniqueOrThrow({ where: { id: invite.id } })
  assert.equal(updatedInvite.status, 'DECLINED')
})