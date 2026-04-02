import assert from 'node:assert/strict'
import { PlanType } from '@prisma/client'
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

test('invite-accept.spec: aceita convite premium com FULL', async () => {
  const owner = await createTestUser({ name: 'Owner' })
  const guest = await createTestUser({ name: 'Premium Guest', plan: PlanType.PREMIUM })

  const inviteResponse = await createInviteViaApi(server, owner, guest.email)
  const invite = parseJson<{ invite: { token: string; id: string } }>(inviteResponse).invite

  const response = await server.inject({
    method: 'POST',
    url: `/v1/wallet/invites/${invite.token}/accept`,
    headers: authHeaders(server, guest),
  })

  assert.equal(response.statusCode, 200)
  const payload = parseJson<{ access: { permission: string; invite: { status: string } } }>(response)
  assert.equal(payload.access.permission, 'FULL')
  assert.equal(payload.access.invite.status, 'ACCEPTED')
})

test('invite-accept.spec: aceita convite free com READ', async () => {
  const owner = await createTestUser({ name: 'Owner' })
  const guest = await createTestUser({ name: 'Free Guest', plan: PlanType.FREE })

  const inviteResponse = await createInviteViaApi(server, owner, guest.email)
  const invite = parseJson<{ invite: { token: string } }>(inviteResponse).invite

  const response = await server.inject({
    method: 'POST',
    url: `/v1/wallet/invites/${invite.token}/accept`,
    headers: authHeaders(server, guest),
  })

  assert.equal(response.statusCode, 200)
  const payload = parseJson<{ access: { permission: string } }>(response)
  assert.equal(payload.access.permission, 'READ')
})

test('invite-accept.spec: bloqueia token expirado', async () => {
  const owner = await createTestUser({ name: 'Owner' })
  const guest = await createTestUser({ name: 'Guest' })

  const inviteResponse = await createInviteViaApi(server, owner, guest.email)
  const invite = parseJson<{ invite: { token: string; id: string } }>(inviteResponse).invite
  await prisma.walletInvite.update({
    where: { id: invite.id },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  })

  const response = await server.inject({
    method: 'POST',
    url: `/v1/wallet/invites/${invite.token}/accept`,
    headers: authHeaders(server, guest),
  })

  assert.equal(response.statusCode, 410)
  assert.deepEqual(parseJson(response), { error: 'INVITE_EXPIRED' })
})

test('invite-accept.spec: bloqueia token já utilizado', async () => {
  const owner = await createTestUser({ name: 'Owner' })
  const guest = await createTestUser({ name: 'Guest' })

  const inviteResponse = await createInviteViaApi(server, owner, guest.email)
  const invite = parseJson<{ invite: { token: string } }>(inviteResponse).invite

  const firstResponse = await server.inject({
    method: 'POST',
    url: `/v1/wallet/invites/${invite.token}/accept`,
    headers: authHeaders(server, guest),
  })
  assert.equal(firstResponse.statusCode, 200)

  const secondResponse = await server.inject({
    method: 'POST',
    url: `/v1/wallet/invites/${invite.token}/accept`,
    headers: authHeaders(server, guest),
  })
  assert.equal(secondResponse.statusCode, 409)
  assert.deepEqual(parseJson(secondResponse), { error: 'INVITE_ALREADY_USED' })
})