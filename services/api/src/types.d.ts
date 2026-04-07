import '@fastify/jwt'
import 'fastify'

type WalletPermissionValue = 'READ' | 'FULL'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string
      email: string
      role: string
      purpose?: 'notifications-ws'
    }
    user: {
      sub: string
      email: string
      role: string
    }
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    walletContext?: {
      ownerId: string
      permission: WalletPermissionValue
      isShared: boolean
    }
  }
}
