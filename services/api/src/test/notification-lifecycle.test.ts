import assert from 'node:assert/strict'
import { NotificationType } from '@prisma/client'
import { after, before, beforeEach, test } from 'node:test'
import type { FastifyInstance } from 'fastify'
import {
  authHeaders,
  cleanupTestData,
  createTestServer,
  createTestUser,
  finalizeTestProcess,
  parseJson,
} from './testUtils'
import { createNotification } from '../modules/notifications/notifications.service'

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

test('notification-lifecycle.spec: lista, marca lida e remove notificação', async () => {
  const user = await createTestUser({ name: 'Notifications User' })

  const notification = await createNotification({
    userId: user.id,
    type: NotificationType.WALLET_INVITE_ACCEPTED,
    title: 'Convite aceito',
    message: 'Seu convite foi aceito.',
    data: { inviteId: 'invite-1' },
  })

  const listResponse = await server.inject({
    method: 'GET',
    url: '/v1/notifications',
    headers: authHeaders(server, user),
  })

  assert.equal(listResponse.statusCode, 200)
  const listPayload = parseJson<{ notifications: Array<{ id: string; readAt: string | null }> }>(listResponse)
  assert.equal(listPayload.notifications.length, 1)
  assert.equal(listPayload.notifications[0]?.id, notification.id)
  assert.equal(listPayload.notifications[0]?.readAt, null)

  const readResponse = await server.inject({
    method: 'PATCH',
    url: `/v1/notifications/${notification.id}/read`,
    headers: authHeaders(server, user),
  })

  assert.equal(readResponse.statusCode, 200)
  const readPayload = parseJson<{ notification: { id: string; readAt: string | null } }>(readResponse)
  assert.equal(readPayload.notification.id, notification.id)
  assert.notEqual(readPayload.notification.readAt, null)

  const deleteResponse = await server.inject({
    method: 'DELETE',
    url: `/v1/notifications/${notification.id}`,
    headers: authHeaders(server, user),
  })

  assert.equal(deleteResponse.statusCode, 204)
})