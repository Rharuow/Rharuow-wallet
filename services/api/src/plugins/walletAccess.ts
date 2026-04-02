import { FastifyReply, FastifyRequest } from 'fastify'
import { WalletPermission } from '@prisma/client'
import { findWalletAccess } from '../modules/wallet-sharing/wallet-sharing.service'

type RequiredAccess = 'read' | 'write'

export function checkWalletAccess(requiredAccess: RequiredAccess) {
  return async function walletAccessPreHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const authenticatedUserId = request.user.sub
    const ownerHeader = request.headers['x-wallet-owner']

    if (Array.isArray(ownerHeader)) {
      return reply.status(400).send({ error: 'INVALID_WALLET_OWNER' })
    }

    const requestedOwnerId = typeof ownerHeader === 'string' && ownerHeader.trim().length > 0
      ? ownerHeader.trim()
      : authenticatedUserId

    if (requestedOwnerId === authenticatedUserId) {
      request.walletContext = {
        ownerId: authenticatedUserId,
        permission: WalletPermission.FULL,
        isShared: false,
      }
      return
    }

    const access = await findWalletAccess(requestedOwnerId, authenticatedUserId)

    if (!access) {
      return reply.status(403).send({ error: 'ACCESS_DENIED' })
    }

    if (requiredAccess === 'write' && access.permission !== WalletPermission.FULL) {
      return reply.status(403).send({ error: 'ACCESS_DENIED' })
    }

    request.walletContext = {
      ownerId: requestedOwnerId,
      permission: access.permission,
      isShared: true,
    }
  }
}