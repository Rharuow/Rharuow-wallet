import crypto from 'node:crypto'
import { InviteStatus, PlanType, WalletPermission } from '@prisma/client'
import { sendWalletInviteEmail } from '../../lib/mailer'
import { prisma } from '../../lib/prisma'
import { createNotifications, type NotificationPayload } from '../notifications/notifications.service'
import { NotificationType } from '@prisma/client'
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

async function deliverInviteEmail(guestEmail: string, token: string, ownerName: string) {
  await sendWalletInviteEmail(guestEmail, token, ownerName)
}

async function emitNotificationsSafely(
  notifications: Array<{
    userId: string
    type: NotificationType
    title: string
    message: string
    data?: NotificationPayload
  }>,
) {
  if (notifications.length === 0) return

  try {
    await createNotifications(notifications)
  } catch (error) {
    console.error('[notifications] emit_failed', {
      error: error instanceof Error ? error.message : String(error),
      notificationsCount: notifications.length,
    })
  }
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
    include: {
      owner: { select: { id: true, email: true, name: true } },
      guest: { select: { id: true, email: true, name: true } },
    },
  })

  if (existingPendingInvite) {
    const refreshedInvite = await prisma.walletInvite.update({
      where: { id: existingPendingInvite.id },
      data: {
        token: crypto.randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        guestId: guest?.id ?? existingPendingInvite.guestId ?? null,
      },
      include: {
        owner: { select: { id: true, email: true, name: true } },
        guest: { select: { id: true, email: true, name: true } },
      },
    })

    await deliverInviteEmail(refreshedInvite.guestEmail, refreshedInvite.token, owner.name ?? owner.email)
    await emitNotificationsSafely(
      refreshedInvite.guest?.id
        ? [
            {
              userId: refreshedInvite.guest.id,
              type: NotificationType.WALLET_INVITE_SENT,
              title: 'Novo convite para carteira compartilhada',
              message: `${owner.name ?? owner.email} enviou um convite para acessar uma carteira.`,
              data: {
                inviteId: refreshedInvite.id,
                inviteToken: refreshedInvite.token,
                ownerId: owner.id,
                ownerName: owner.name,
                ownerEmail: owner.email,
              },
            },
          ]
        : [],
    )
    console.info('[wallet-sharing] invite.resent', {
      inviteId: refreshedInvite.id,
      ownerId,
      guestEmail: refreshedInvite.guestEmail,
    })

    return refreshedInvite
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

  await deliverInviteEmail(invite.guestEmail, invite.token, owner.name ?? owner.email)
  await emitNotificationsSafely(
    invite.guest?.id
      ? [
          {
            userId: invite.guest.id,
            type: NotificationType.WALLET_INVITE_SENT,
            title: 'Novo convite para carteira compartilhada',
            message: `${owner.name ?? owner.email} enviou um convite para acessar uma carteira.`,
            data: {
              inviteId: invite.id,
              inviteToken: invite.token,
              ownerId: owner.id,
              ownerName: owner.name,
              ownerEmail: owner.email,
            },
          },
        ]
      : [],
  )
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

  await emitNotificationsSafely([
    {
      userId: invite.owner.id,
      type: NotificationType.WALLET_INVITE_ACCEPTED,
      title: 'Convite aceito',
      message: `${guest.name ?? guest.email} aceitou seu convite para carteira compartilhada.`,
      data: {
        inviteId: invite.id,
        ownerId: invite.owner.id,
        guestId,
        guestName: guest.name,
        guestEmail: guest.email,
        permission,
      },
    },
  ])

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

  await emitNotificationsSafely([
    {
      userId: invite.owner.id,
      type: NotificationType.WALLET_INVITE_DECLINED,
      title: 'Convite recusado',
      message: `${guest.name ?? guest.email} recusou seu convite para carteira compartilhada.`,
      data: {
        inviteId: invite.id,
        ownerId: invite.owner.id,
        guestId,
        guestName: guest.name,
        guestEmail: guest.email,
      },
    },
  ])

  return declinedInvite
}

export async function revokeInvite(ownerId: string, inviteId: string) {
  const invite = await prisma.walletInvite.findFirst({
    where: { id: inviteId, ownerId },
    include: {
      access: { select: { id: true } },
      owner: { select: { id: true, email: true, name: true } },
      guest: { select: { id: true, email: true, name: true } },
    },
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

  await emitNotificationsSafely(
    invite.guest?.id
      ? [
          {
            userId: invite.guest.id,
            type: NotificationType.WALLET_INVITE_REVOKED,
            title: 'Acesso revogado',
            message: `${invite.owner.name ?? invite.owner.email} revogou seu acesso ou convite de carteira compartilhada.`,
            data: {
              inviteId: invite.id,
              ownerId: invite.owner.id,
              ownerName: invite.owner.name,
              ownerEmail: invite.owner.email,
              guestId: invite.guest.id,
            },
          },
        ]
      : [],
  )

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