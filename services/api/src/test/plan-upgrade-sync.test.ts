import assert from 'node:assert/strict'
import { PlanType } from '@prisma/client'
import { after, before, beforeEach, test } from 'node:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { syncWalletAccessPermissionsForUser } from '../modules/wallet-sharing/wallet-sharing.service'
import {
  cleanupTestData,
  createAcceptedInvite,
  createTestServer,
  createTestUser,
  finalizeTestProcess,
  updateUserPlan,
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

test('plan-upgrade-sync.spec: upgrade promove READ para FULL', async () => {
  const owner = await createTestUser({ name: 'Owner', plan: PlanType.PREMIUM })
  const guest = await createTestUser({ name: 'Guest', plan: PlanType.FREE })
  await createAcceptedInvite(server, owner, guest)

  let access = await prisma.walletAccess.findUniqueOrThrow({
    where: { ownerId_guestId: { ownerId: owner.id, guestId: guest.id } },
  })
  assert.equal(access.permission, 'READ')

  await updateUserPlan(guest.id, PlanType.PREMIUM)
  const result = await syncWalletAccessPermissionsForUser(guest.id)
  assert.equal(result.permission, 'FULL')
  assert.equal(result.updatedCount, 1)

  access = await prisma.walletAccess.findUniqueOrThrow({
    where: { ownerId_guestId: { ownerId: owner.id, guestId: guest.id } },
  })
  assert.equal(access.permission, 'FULL')
})