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

test('notification-auth-boundary.spec: usuário não acessa notificações de terceiros', async () => {
  const owner = await createTestUser({ name: 'Owner' })
  const otherUser = await createTestUser({ name: 'Other' })

  const notification = await createNotification({
    userId: owner.id,
    type: NotificationType.WALLET_INVITE_ACCEPTED,
    title: 'Convite aceito',
    message: 'Seu convite foi aceito.',
  })

  const listResponse = await server.inject({
    method: 'GET',
    url: '/v1/notifications',
    headers: authHeaders(server, otherUser),
  })

  assert.equal(listResponse.statusCode, 200)
  const listPayload = parseJson<{ notifications: Array<{ id: string }> }>(listResponse)
  assert.equal(listPayload.notifications.length, 0)

  const readResponse = await server.inject({
    method: 'PATCH',
    url: `/v1/notifications/${notification.id}/read`,
    headers: authHeaders(server, otherUser),
  })
  assert.equal(readResponse.statusCode, 404)
  assert.deepEqual(parseJson(readResponse), { error: 'NOTIFICATION_NOT_FOUND' })

  const deleteResponse = await server.inject({
    method: 'DELETE',
    url: `/v1/notifications/${notification.id}`,
    headers: authHeaders(server, otherUser),
  })
  assert.equal(deleteResponse.statusCode, 404)
  assert.deepEqual(parseJson(deleteResponse), { error: 'NOTIFICATION_NOT_FOUND' })
})