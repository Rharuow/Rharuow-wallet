import { NotificationType, Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import type { NotificationsQuery } from './notifications.schema'

function serviceError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode })
}

export type NotificationPayload = Prisma.InputJsonValue

export async function createNotification(input: {
  userId: string
  type: NotificationType
  title: string
  message: string
  data?: NotificationPayload
}) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      data: input.data,
    },
  })
}

export async function createNotifications(
  notifications: Array<{
    userId: string
    type: NotificationType
    title: string
    message: string
    data?: NotificationPayload
  }>,
) {
  const validNotifications = notifications.filter((notification) => notification.userId)

  if (validNotifications.length === 0) {
    return []
  }

  return prisma.$transaction(
    validNotifications.map((notification) =>
      prisma.notification.create({
        data: {
          userId: notification.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
        },
      }),
    ),
  )
}

export async function listNotifications(userId: string, query: NotificationsQuery) {
  const page = query.page
  const limit = query.limit
  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(query.type ? { type: query.type } : {}),
    ...(query.status === 'unread'
      ? { readAt: null }
      : query.status === 'read'
        ? { readAt: { not: null } }
        : {}),
  }

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ])

  return {
    notifications,
    total,
    unreadCount,
    page,
    limit,
  }
}

export async function getUnreadNotificationsCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } })
}

export async function markNotificationAsRead(userId: string, notificationId: string) {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  })

  if (!notification) {
    throw serviceError('NOTIFICATION_NOT_FOUND', 404)
  }

  if (notification.readAt) {
    return notification
  }

  return prisma.notification.update({
    where: { id: notification.id },
    data: { readAt: new Date() },
  })
}

export async function markAllNotificationsAsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  })

  return { updatedCount: result.count }
}

export async function deleteNotification(userId: string, notificationId: string) {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
    select: { id: true },
  })

  if (!notification) {
    throw serviceError('NOTIFICATION_NOT_FOUND', 404)
  }

  await prisma.notification.delete({ where: { id: notification.id } })
  return { deleted: true }
}