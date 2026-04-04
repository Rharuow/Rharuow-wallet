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

test('notification-filters.spec: lista notificações com filtro por tipo, status e paginação', async () => {
  const user = await createTestUser({ name: 'Filter User' })

  const [sentOne, sentTwo, accepted] = await createNotifications([
    {
      userId: user.id,
      type: NotificationType.WALLET_INVITE_SENT,
      title: 'Convite recebido 1',
      message: 'Primeiro convite pendente.',
      data: { inviteToken: 'filter-token-1' },
    },
    {
      userId: user.id,
      type: NotificationType.WALLET_INVITE_SENT,
      title: 'Convite recebido 2',
      message: 'Segundo convite pendente.',
      data: { inviteToken: 'filter-token-2' },
    },
    {
      userId: user.id,
      type: NotificationType.WALLET_INVITE_ACCEPTED,
      title: 'Convite aceito',
      message: 'Seu convite foi aceito.',
    },
  ])

  await server.inject({
    method: 'PATCH',
    url: `/v1/notifications/${accepted.id}/read`,
    headers: authHeaders(server, user),
  })

  const unreadSentResponse = await server.inject({
    method: 'GET',
    url: '/v1/notifications?type=WALLET_INVITE_SENT&status=unread&page=1&limit=1',
    headers: authHeaders(server, user),
  })

  assert.equal(unreadSentResponse.statusCode, 200)
  const unreadSentPayload = parseJson<{
    notifications: Array<{ id: string; type: string; readAt: string | null }>
    total: number
    page: number
    limit: number
    unreadCount: number
  }>(unreadSentResponse)

  assert.equal(unreadSentPayload.notifications.length, 1)
  assert.equal(unreadSentPayload.total, 2)
  assert.equal(unreadSentPayload.page, 1)
  assert.equal(unreadSentPayload.limit, 1)
  assert.equal(unreadSentPayload.unreadCount, 2)
  assert.equal(unreadSentPayload.notifications[0]?.type, 'WALLET_INVITE_SENT')
  assert.equal(unreadSentPayload.notifications[0]?.readAt, null)
  assert.ok([sentOne.id, sentTwo.id].includes(unreadSentPayload.notifications[0]!.id))

  const readAcceptedResponse = await server.inject({
    method: 'GET',
    url: '/v1/notifications?status=read&type=WALLET_INVITE_ACCEPTED',
    headers: authHeaders(server, user),
  })

  assert.equal(readAcceptedResponse.statusCode, 200)
  const readAcceptedPayload = parseJson<{
    notifications: Array<{ id: string; type: string; readAt: string | null }>
    total: number
  }>(readAcceptedResponse)

  assert.equal(readAcceptedPayload.total, 1)
  assert.equal(readAcceptedPayload.notifications[0]?.id, accepted.id)
  assert.notEqual(readAcceptedPayload.notifications[0]?.readAt, null)
})