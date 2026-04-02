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
import { createNotifications } from '../modules/notifications/notifications.service'

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

test('unread-count-consistency.spec: contador reflete leitura individual e leitura em massa', async () => {
  const user = await createTestUser({ name: 'Unread User' })

  const notifications = await createNotifications([
    {
      userId: user.id,
      type: NotificationType.WALLET_INVITE_SENT,
      title: 'Convite recebido',
      message: 'Existe um convite pendente.',
      data: { inviteToken: 'token-1' },
    },
    {
      userId: user.id,
      type: NotificationType.WALLET_INVITE_ACCEPTED,
      title: 'Convite aceito',
      message: 'Seu convite foi aceito.',
    },
  ])

  const countBefore = await server.inject({
    method: 'GET',
    url: '/v1/notifications/unread-count',
    headers: authHeaders(server, user),
  })

  assert.equal(countBefore.statusCode, 200)
  assert.equal(parseJson<{ unreadCount: number }>(countBefore).unreadCount, 2)

  const readOne = await server.inject({
    method: 'PATCH',
    url: `/v1/notifications/${notifications[0]!.id}/read`,
    headers: authHeaders(server, user),
  })
  assert.equal(readOne.statusCode, 200)

  const countAfterOne = await server.inject({
    method: 'GET',
    url: '/v1/notifications/unread-count',
    headers: authHeaders(server, user),
  })
  assert.equal(parseJson<{ unreadCount: number }>(countAfterOne).unreadCount, 1)

  const readAll = await server.inject({
    method: 'POST',
    url: '/v1/notifications/read-all',
    headers: authHeaders(server, user),
    payload: {},
  })
  assert.equal(readAll.statusCode, 200)
  assert.equal(parseJson<{ updatedCount: number }>(readAll).updatedCount, 1)

  const countAfterAll = await server.inject({
    method: 'GET',
    url: '/v1/notifications/unread-count',
    headers: authHeaders(server, user),
  })
  assert.equal(parseJson<{ unreadCount: number }>(countAfterAll).unreadCount, 0)
})