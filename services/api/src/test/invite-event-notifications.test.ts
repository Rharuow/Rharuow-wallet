import assert from 'node:assert/strict'
import { InviteStatus } from '@prisma/client'
import { after, before, beforeEach, test } from 'node:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import {
  authHeaders,
  cleanupTestData,
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

test('invite-event-notifications.spec: convidado recebe notificação ao receber convite', async () => {
  const owner = await createTestUser({ name: 'Owner' })
  const guest = await createTestUser({ name: 'Guest' })

  const createResponse = await server.inject({
    method: 'POST',
    url: '/v1/wallet/invites',
    headers: authHeaders(server, owner),
    payload: { guestEmail: guest.email },
  })

  assert.equal(createResponse.statusCode, 201)

  const notification = await prisma.notification.findFirst({
    where: { userId: guest.id, type: 'WALLET_INVITE_SENT' },
    orderBy: { createdAt: 'desc' },
  })

  assert.ok(notification)
  assert.equal(notification?.type, 'WALLET_INVITE_SENT')
})

test('invite-event-notifications.spec: dono recebe notificação ao aceite e recusa', async () => {
  const owner = await createTestUser({ name: 'Owner' })
  const guestAccept = await createTestUser({ name: 'Guest Accept' })
  const guestDecline = await createTestUser({ name: 'Guest Decline' })

  const acceptInviteResponse = await server.inject({
    method: 'POST',
    url: '/v1/wallet/invites',
    headers: authHeaders(server, owner),
    payload: { guestEmail: guestAccept.email },
  })
  const acceptInvite = parseJson<{ invite: { token: string } }>(acceptInviteResponse).invite

  const acceptedResponse = await server.inject({
    method: 'POST',
    url: `/v1/wallet/invites/${acceptInvite.token}/accept`,
    headers: authHeaders(server, guestAccept),
  })
  assert.equal(acceptedResponse.statusCode, 200)

  const declineInviteResponse = await server.inject({
    method: 'POST',
    url: '/v1/wallet/invites',
    headers: authHeaders(server, owner),
    payload: { guestEmail: guestDecline.email },
  })
  const declineInvite = parseJson<{ invite: { token: string } }>(declineInviteResponse).invite

  const declinedResponse = await server.inject({
    method: 'POST',
    url: `/v1/wallet/invites/${declineInvite.token}/decline`,
    headers: authHeaders(server, guestDecline),
  })
  assert.equal(declinedResponse.statusCode, 200)

  const ownerNotifications = await prisma.notification.findMany({
    where: { userId: owner.id },
    orderBy: { createdAt: 'asc' },
  })

  assert.deepEqual(
    ownerNotifications.map((notification) => notification.type),
    ['WALLET_INVITE_ACCEPTED', 'WALLET_INVITE_DECLINED'],
  )
})

test('invite-event-notifications.spec: convidado recebe notificação ao revogar acesso', async () => {
  const owner = await createTestUser({ name: 'Owner' })
  const guest = await createTestUser({ name: 'Guest' })

  const createResponse = await server.inject({
    method: 'POST',
    url: '/v1/wallet/invites',
    headers: authHeaders(server, owner),
    payload: { guestEmail: guest.email },
  })
  const invite = parseJson<{ invite: { token: string; id: string } }>(createResponse).invite

  const acceptResponse = await server.inject({
    method: 'POST',
    url: `/v1/wallet/invites/${invite.token}/accept`,
    headers: authHeaders(server, guest),
  })
  assert.equal(acceptResponse.statusCode, 200)

  await prisma.notification.deleteMany({
    where: { userId: guest.id, type: 'WALLET_INVITE_SENT' },
  })

  const revokeResponse = await server.inject({
    method: 'DELETE',
    url: `/v1/wallet/invites/${invite.id}`,
    headers: authHeaders(server, owner),
  })
  assert.equal(revokeResponse.statusCode, 204)

  const revokeNotification = await prisma.notification.findFirst({
    where: { userId: guest.id, type: 'WALLET_INVITE_REVOKED' },
  })
  assert.ok(revokeNotification)

  const revokedInvite = await prisma.walletInvite.findUnique({ where: { id: invite.id } })
  assert.equal(revokedInvite?.status, InviteStatus.REVOKED)
})