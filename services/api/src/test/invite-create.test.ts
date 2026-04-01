import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import {
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

test('invite-create.spec: cria convite e reenvia duplicado pendente com novo token', async () => {
  const owner = await createTestUser({ name: 'Owner' })
  const guest = await createTestUser({ name: 'Guest' })

  const firstResponse = await createInviteViaApi(server, owner, guest.email.toUpperCase())
  assert.equal(firstResponse.statusCode, 201)

  const firstPayload = parseJson<{ invite: { id: string; token: string; guestEmail: string; status: string } }>(firstResponse)
  assert.equal(firstPayload.invite.guestEmail, guest.email)
  assert.equal(firstPayload.invite.status, 'PENDING')

  const duplicateResponse = await createInviteViaApi(server, owner, guest.email)
  assert.equal(duplicateResponse.statusCode, 201)

  const duplicatePayload = parseJson<{ invite: { id: string; token: string; guestEmail: string; status: string } }>(duplicateResponse)
  assert.equal(duplicatePayload.invite.id, firstPayload.invite.id)
  assert.notEqual(duplicatePayload.invite.token, firstPayload.invite.token)
  assert.equal(duplicatePayload.invite.guestEmail, guest.email)
  assert.equal(duplicatePayload.invite.status, 'PENDING')

  const inviteCount = await prisma.walletInvite.count({
    where: { ownerId: owner.id, guestEmail: guest.email },
  })
  assert.equal(inviteCount, 1)
})