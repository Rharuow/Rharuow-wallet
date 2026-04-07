import fastifyWebsocket = require('@fastify/websocket')
import { prisma } from '../../lib/prisma'

type NotificationSocket = fastifyWebsocket.SocketStream['socket']

type UnreadCountMessage = {
  type: 'notifications.unread_count'
  unreadCount: number
}

const socketsByUserId = new Map<string, Set<NotificationSocket>>()

function removeSocket(userId: string, socket: NotificationSocket) {
  const sockets = socketsByUserId.get(userId)
  if (!sockets) {
    return
  }

  sockets.delete(socket)
  if (sockets.size === 0) {
    socketsByUserId.delete(userId)
  }
}

function sendJson(socket: NotificationSocket, payload: UnreadCountMessage) {
  if (socket.readyState !== 1) {
    return
  }

  socket.send(JSON.stringify(payload))
}

export function registerNotificationsSocket(userId: string, socket: NotificationSocket) {
  const sockets = socketsByUserId.get(userId) ?? new Set<NotificationSocket>()
  sockets.add(socket)
  socketsByUserId.set(userId, sockets)

  socket.on('close', () => {
    removeSocket(userId, socket)
  })

  socket.on('error', () => {
    removeSocket(userId, socket)
  })

  void pushUnreadCountToUser(userId)
}

export async function pushUnreadCountToUser(userId: string) {
  const sockets = socketsByUserId.get(userId)
  if (!sockets || sockets.size === 0) {
    return
  }

  const unreadCount = await prisma.notification.count({
    where: { userId, readAt: null },
  })

  const payload: UnreadCountMessage = {
    type: 'notifications.unread_count',
    unreadCount,
  }

  for (const socket of sockets) {
    sendJson(socket, payload)
  }
}