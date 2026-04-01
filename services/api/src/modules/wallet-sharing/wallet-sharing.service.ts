import crypto from 'node:crypto'
import { InviteStatus, PlanType, WalletPermission } from '@prisma/client'
import { sendWalletInviteEmail } from '../../lib/mailer'
import { prisma } from '../../lib/prisma'
import type { CreateWalletInviteInput } from './wallet-sharing.schema'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function serviceError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode })
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function permissionFromPlan(planName: PlanType | null | undefined) {
  return planName === PlanType.PREMIUM ? WalletPermission.FULL : WalletPermission.READ
}

async function getUserForInvite(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, plan: { select: { name: true } } },
  })

  if (!user) throw serviceError('USER_NOT_FOUND', 404)
  return user
}

function assertInviteIsPending(invite: { status: InviteStatus; expiresAt: Date }) {
  if (invite.status !== InviteStatus.PENDING) {
    throw serviceError('INVITE_ALREADY_USED', 409)
  }

  if (invite.expiresAt.getTime() <= Date.now()) {
    throw serviceError('INVITE_EXPIRED', 410)
  }
}

export async function createInvite(ownerId: string, data: CreateWalletInviteInput) {
  const owner = await getUserForInvite(ownerId)
  const guestEmail = normalizeEmail(data.guestEmail)

  if (normalizeEmail(owner.email) === guestEmail) {
    throw serviceError('SELF_INVITE_NOT_ALLOWED', 400)
  }

  const guest = await prisma.user.findFirst({
    where: { email: { equals: guestEmail, mode: 'insensitive' } },
    select: { id: true, email: true },
  })

  const existingPendingInvite = await prisma.walletInvite.findFirst({
    where: {
      ownerId,
      guestEmail,
      status: InviteStatus.PENDING,
      expiresAt: { gt: new Date() },
    },
  })

  if (existingPendingInvite) {
    throw serviceError('INVITE_PENDING_CONFLICT', 409)
  }

  if (guest) {
    const existingAccess = await prisma.walletAccess.findUnique({
      where: { ownerId_guestId: { ownerId, guestId: guest.id } },
      select: { id: true },
    })

    if (existingAccess) {
      throw serviceError('ACCESS_ALREADY_GRANTED', 409)
    }
  }

  const invite = await prisma.walletInvite.create({
    data: {
      ownerId,
      guestEmail,
      guestId: guest?.id ?? null,
      token: crypto.randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
    include: {
      owner: { select: { id: true, email: true, name: true } },
      guest: { select: { id: true, email: true, name: true } },
    },
  })

  await sendWalletInviteEmail(invite.guestEmail, invite.token, owner.name ?? owner.email)
  console.info('[wallet-sharing] invite.created', {
    inviteId: invite.id,
    ownerId,
    guestEmail: invite.guestEmail,
  })

  return invite
}

export async function listSentInvites(ownerId: string) {
  return prisma.walletInvite.findMany({
    where: { ownerId },
    include: {
      guest: { select: { id: true, email: true, name: true } },
      access: { select: { id: true, permission: true, createdAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function listReceivedInvites(guestId: string) {
  const guest = await getUserForInvite(guestId)
  const guestEmail = normalizeEmail(guest.email)

  return prisma.walletInvite.findMany({
    where: {
      OR: [{ guestId }, { guestEmail }],
    },
    include: {
      owner: { select: { id: true, email: true, name: true } },
      access: { select: { id: true, permission: true, createdAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function acceptInvite(token: string, guestId: string) {
  const guest = await getUserForInvite(guestId)
  const invite = await prisma.walletInvite.findUnique({
    where: { token },
    include: {
      owner: { select: { id: true, email: true, name: true } },
      access: { select: { id: true } },
    },
  })

  if (!invite) throw serviceError('INVITE_NOT_FOUND', 404)
  if (normalizeEmail(guest.email) !== invite.guestEmail) {
    throw serviceError('INVITE_EMAIL_MISMATCH', 403)
  }
  if (invite.ownerId === guestId) {
    throw serviceError('SELF_INVITE_NOT_ALLOWED', 400)
  }

  assertInviteIsPending(invite)

  const existingAccess = await prisma.walletAccess.findUnique({
    where: { ownerId_guestId: { ownerId: invite.ownerId, guestId } },
  })
  if (existingAccess || invite.access) {
    throw serviceError('ACCESS_ALREADY_GRANTED', 409)
  }

  const permission = permissionFromPlan(guest.plan?.name)

  const access = await prisma.$transaction(async (tx) => {
    const updatedInvite = await tx.walletInvite.update({
      where: { id: invite.id },
      data: { status: InviteStatus.ACCEPTED, guestId },
    })

    const createdAccess = await tx.walletAccess.create({
      data: {
        ownerId: invite.ownerId,
        guestId,
        inviteId: updatedInvite.id,
        permission,
      },
      include: {
        owner: { select: { id: true, email: true, name: true } },
        guest: { select: { id: true, email: true, name: true } },
        invite: { select: { id: true, status: true, guestEmail: true } },
      },
    })

    return createdAccess
  })

  console.info('[wallet-sharing] invite.accepted', {
    inviteId: invite.id,
    ownerId: invite.ownerId,
    guestId,
    permission,
  })

  return access
}

export async function declineInvite(token: string, guestId: string) {
  const guest = await getUserForInvite(guestId)
  const invite = await prisma.walletInvite.findUnique({
    where: { token },
    include: { owner: { select: { id: true, email: true, name: true } } },
  })

  if (!invite) throw serviceError('INVITE_NOT_FOUND', 404)
  if (normalizeEmail(guest.email) !== invite.guestEmail) {
    throw serviceError('INVITE_EMAIL_MISMATCH', 403)
  }

  assertInviteIsPending(invite)

  const declinedInvite = await prisma.walletInvite.update({
    where: { id: invite.id },
    data: { status: InviteStatus.DECLINED, guestId },
    include: { owner: { select: { id: true, email: true, name: true } } },
  })

  console.info('[wallet-sharing] invite.declined', {
    inviteId: invite.id,
    ownerId: invite.ownerId,
    guestId,
  })

  return declinedInvite
}

export async function revokeInvite(ownerId: string, inviteId: string) {
  const invite = await prisma.walletInvite.findFirst({
    where: { id: inviteId, ownerId },
    include: { access: { select: { id: true } } },
  })

  if (!invite) throw serviceError('INVITE_NOT_FOUND', 404)

  if (invite.status === InviteStatus.REVOKED && !invite.access) {
    return { revoked: true }
  }

  await prisma.$transaction(async (tx) => {
    await tx.walletAccess.deleteMany({ where: { inviteId: invite.id } })
    await tx.walletInvite.update({
      where: { id: invite.id },
      data: { status: InviteStatus.REVOKED },
    })
  })

  console.info('[wallet-sharing] invite.revoked', {
    inviteId,
    ownerId,
  })

  return { revoked: true }
}

export async function listOwnedAccesses(ownerId: string) {
  return prisma.walletAccess.findMany({
    where: { ownerId },
    include: {
      guest: { select: { id: true, email: true, name: true } },
      invite: { select: { id: true, guestEmail: true, status: true, createdAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function listSharedWithMe(guestId: string) {
  return prisma.walletAccess.findMany({
    where: { guestId },
    include: {
      owner: { select: { id: true, email: true, name: true } },
      invite: { select: { id: true, guestEmail: true, status: true, createdAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function findWalletAccess(ownerId: string, guestId: string) {
  return prisma.walletAccess.findUnique({
    where: { ownerId_guestId: { ownerId, guestId } },
    select: { id: true, permission: true, ownerId: true, guestId: true },
  })
}

export async function syncWalletAccessPermissionsForUser(userId: string) {
  const user = await getUserForInvite(userId)
  const permission = permissionFromPlan(user.plan?.name)

  const result = await prisma.walletAccess.updateMany({
    where: {
      guestId: userId,
      permission: { not: permission },
    },
    data: { permission },
  })

  if (result.count > 0) {
    console.info('[wallet-sharing] access.permission_synced', {
      guestId: userId,
      permission,
      count: result.count,
    })
  }

  return { permission, updatedCount: result.count }
}