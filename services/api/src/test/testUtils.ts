import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { PlanType } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import type { Response as InjectResponse } from 'light-my-request'
import { buildServer } from '../app'
import { prisma } from '../lib/prisma'

const TEST_EMAIL_DOMAIN = '@wallet-sharing.test'

export async function createTestServer() {
  const server = await buildServer()
  await server.ready()
  return server
}

export async function ensureBaseData() {
  const [freePlan, premiumPlan, userRole] = await Promise.all([
    prisma.plan.upsert({ where: { name: 'FREE' }, update: {}, create: { name: 'FREE' } }),
    prisma.plan.upsert({ where: { name: 'PREMIUM' }, update: {}, create: { name: 'PREMIUM' } }),
    prisma.role.upsert({ where: { name: 'User' }, update: {}, create: { name: 'User' } }),
  ])

  return { freePlan, premiumPlan, userRole }
}

export async function cleanupTestData() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: TEST_EMAIL_DOMAIN } },
    select: { id: true },
  })
  const userIds = users.map((user) => user.id)

  if (userIds.length > 0) {
    await prisma.walletAccess.deleteMany({
      where: {
        OR: [
          { ownerId: { in: userIds } },
          { guestId: { in: userIds } },
        ],
      },
    })
  }

  await prisma.walletInvite.deleteMany({
    where: {
      OR: [
        userIds.length > 0 ? { ownerId: { in: userIds } } : undefined,
        userIds.length > 0 ? { guestId: { in: userIds } } : undefined,
        { guestEmail: { endsWith: TEST_EMAIL_DOMAIN } },
      ].filter(Boolean) as Array<Record<string, unknown>>,
    },
  })

  if (userIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  }
}

export async function createTestUser(options?: {
  email?: string
  name?: string
  plan?: PlanType
}) {
  const { freePlan, premiumPlan, userRole } = await ensureBaseData()
  const email = options?.email ?? makeTestEmail('user')
  const passwordHash = await bcrypt.hash('password-123', 4)
  const plan = options?.plan ?? PlanType.FREE

  return prisma.user.create({
    data: {
      email,
      name: options?.name ?? email.split('@')[0],
      passwordHash,
      roleId: userRole.id,
      isActive: true,
      planId: plan === PlanType.PREMIUM ? premiumPlan.id : freePlan.id,
      planExpiresAt: null,
    },
    include: { plan: { select: { name: true } }, role: { select: { name: true } } },
  })
}

export function makeTestEmail(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}${TEST_EMAIL_DOMAIN}`
}

export function authHeaders(server: FastifyInstance, user: { id: string; email: string; role?: { name: string } | null }) {
  const token = server.jwt.sign({
    sub: user.id,
    email: user.email,
    role: user.role?.name ?? 'User',
  })

  return {
    authorization: `Bearer ${token}`,
  }
}

export async function createInviteViaApi(
  server: FastifyInstance,
  owner: { id: string; email: string; role?: { name: string } | null },
  guestEmail: string,
) {
  const response = await server.inject({
    method: 'POST',
    url: '/v1/wallet/invites',
    headers: authHeaders(server, owner),
    payload: { guestEmail },
  })

  return response
}

export function parseJson<T>(response: InjectResponse) {
  return JSON.parse(response.body) as T
}

export async function createAcceptedInvite(
  server: FastifyInstance,
  owner: { id: string; email: string; role?: { name: string } | null },
  guest: { id: string; email: string; role?: { name: string } | null },
) {
  const inviteResponse = await createInviteViaApi(server, owner, guest.email)
  assert.equal(inviteResponse.statusCode, 201)

  const parsedInvitePayload = parseJson<{ invite: { token: string; id: string } }>(inviteResponse)
  const acceptResponse = await server.inject({
    method: 'POST',
    url: `/v1/wallet/invites/${parsedInvitePayload.invite.token}/accept`,
    headers: authHeaders(server, guest),
  })
  assert.equal(acceptResponse.statusCode, 200)

  return parsedInvitePayload.invite
}

export async function createCostFixtures(ownerId: string) {
  const area = await prisma.costArea.create({
    data: {
      name: `Area ${crypto.randomUUID()}`,
      userId: ownerId,
    },
  })

  const type = await prisma.costType.create({
    data: {
      name: `Tipo ${crypto.randomUUID()}`,
      areaId: area.id,
      userId: ownerId,
    },
  })

  const cost = await prisma.cost.create({
    data: {
      userId: ownerId,
      costTypeId: type.id,
      amount: 123.45,
      description: 'Custo inicial',
      date: new Date('2026-03-20T00:00:00.000Z'),
    },
  })

  return { area, type, cost }
}

export async function createIncomeFixture(ownerId: string) {
  return prisma.income.create({
    data: {
      userId: ownerId,
      name: `Entrada ${crypto.randomUUID()}`,
      amount: 456.78,
      description: 'Entrada inicial',
      date: new Date('2026-03-21T00:00:00.000Z'),
    },
  })
}

export async function updateUserPlan(userId: string, plan: PlanType) {
  const { freePlan, premiumPlan } = await ensureBaseData()

  return prisma.user.update({
    where: { id: userId },
    data: { planId: plan === PlanType.PREMIUM ? premiumPlan.id : freePlan.id },
  })
}

export async function finalizeTestProcess(server: FastifyInstance) {
  await cleanupTestData()
  await server.close()
  await prisma.$disconnect()
  setImmediate(() => process.exit(process.exitCode ?? 0))
}