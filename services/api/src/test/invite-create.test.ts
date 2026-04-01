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

test('invite-create.spec: cria convite e bloqueia duplicado pendente', async () => {
  const owner = await createTestUser({ name: 'Owner' })
  const guest = await createTestUser({ name: 'Guest' })

  const firstResponse = await createInviteViaApi(server, owner, guest.email.toUpperCase())
  assert.equal(firstResponse.statusCode, 201)

  const firstPayload = parseJson<{ invite: { guestEmail: string; status: string } }>(firstResponse)
  assert.equal(firstPayload.invite.guestEmail, guest.email)
  assert.equal(firstPayload.invite.status, 'PENDING')

  const duplicateResponse = await createInviteViaApi(server, owner, guest.email)
  assert.equal(duplicateResponse.statusCode, 409)
  assert.deepEqual(parseJson(duplicateResponse), { error: 'INVITE_PENDING_CONFLICT' })
})