import assert from 'node:assert/strict'
import test from 'node:test'
import { prisma } from '../lib/prisma'
import { createTestServer, ensureBaseData, finalizeTestProcess, makeTestEmail, parseJson } from './testUtils'

test('resend verification invalidates previous token and creates a new one for inactive users', async () => {
  const server = await createTestServer()

  try {
    const { userRole, freePlan } = await ensureBaseData()
    const email = makeTestEmail('verify')

    const user = await prisma.user.create({
      data: {
        email,
        name: 'Verify User',
        passwordHash: 'hash',
        roleId: userRole.id,
        isActive: false,
        planId: freePlan.id,
      },
    })

    const previousToken = await prisma.emailVerifyToken.create({
      data: {
        userId: user.id,
        token: 'old-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    })

    const response = await server.inject({
      method: 'POST',
      url: '/v1/auth/resend-verification',
      payload: { email },
    })

    assert.equal(response.statusCode, 200)
    assert.equal(
      parseJson<{ message: string }>(response).message,
      'Se a conta existir e ainda não estiver ativa, enviaremos um novo e-mail em instantes.',
    )

    const tokens = await prisma.emailVerifyToken.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    })

    assert.equal(tokens.length, 2)
    assert.equal(tokens[0].id, previousToken.id)
    assert.ok(tokens[0].usedAt instanceof Date)
    assert.notEqual(tokens[1].token, previousToken.token)
    assert.equal(tokens[1].usedAt, null)
  } finally {
    await finalizeTestProcess(server)
  }
})