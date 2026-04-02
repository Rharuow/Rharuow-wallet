import { FastifyInstance, FastifyReply } from 'fastify'
import { authenticate } from '../../plugins/authenticate'
import {
  CreateWalletInviteSchema,
  WalletInviteIdParamsSchema,
  WalletInviteTokenParamsSchema,
} from './wallet-sharing.schema'
import {
  acceptInvite,
  createInvite,
  declineInvite,
  listOwnedAccesses,
  listReceivedInvites,
  listSentInvites,
  listSharedWithMe,
  revokeInvite,
} from './wallet-sharing.service'

function handleServiceError(err: unknown, reply: FastifyReply) {
  const e = err as Error & { statusCode?: number }
  return reply.status(e.statusCode ?? 500).send({ error: e.message })
}

export async function walletSharingRoutes(fastify: FastifyInstance) {
  fastify.post('/invites', {
    preHandler: authenticate,
    schema: {
      tags: ['Wallet Sharing'],
      summary: 'Enviar convite para carteira compartilhada',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['guestEmail'],
        properties: {
          guestEmail: { type: 'string', format: 'email', maxLength: 255 },
        },
      },
    },
  }, async (request, reply) => {
    const body = CreateWalletInviteSchema.parse(request.body)
    try {
      const invite = await createInvite(request.user.sub, body)
      return reply.status(201).send({ invite })
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  fastify.get('/invites', {
    preHandler: authenticate,
    schema: {
      tags: ['Wallet Sharing'],
      summary: 'Listar convites enviados pelo dono',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const invites = await listSentInvites(request.user.sub)
    return reply.send({ invites })
  })

  fastify.get('/invites/received', {
    preHandler: authenticate,
    schema: {
      tags: ['Wallet Sharing'],
      summary: 'Listar convites recebidos',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const invites = await listReceivedInvites(request.user.sub)
    return reply.send({ invites })
  })

  fastify.post<{ Params: { token: string } }>('/invites/:token/accept', {
    preHandler: authenticate,
    schema: {
      tags: ['Wallet Sharing'],
      summary: 'Aceitar convite de carteira compartilhada',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['token'],
        properties: { token: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const params = WalletInviteTokenParamsSchema.parse(request.params)
    try {
      const access = await acceptInvite(params.token, request.user.sub)
      return reply.send({ access })
    } catch (err) {
      console.error('[wallet-sharing] acceptInvite error:', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        statusCode: (err as { statusCode?: number }).statusCode,
      })
      return handleServiceError(err, reply)
    }
  })

  fastify.post<{ Params: { token: string } }>('/invites/:token/decline', {
    preHandler: authenticate,
    schema: {
      tags: ['Wallet Sharing'],
      summary: 'Recusar convite de carteira compartilhada',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['token'],
        properties: { token: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const params = WalletInviteTokenParamsSchema.parse(request.params)
    try {
      const invite = await declineInvite(params.token, request.user.sub)
      return reply.send({ invite })
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  fastify.delete<{ Params: { id: string } }>('/invites/:id', {
    preHandler: authenticate,
    schema: {
      tags: ['Wallet Sharing'],
      summary: 'Revogar convite ou acesso compartilhado',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const params = WalletInviteIdParamsSchema.parse(request.params)
    try {
      await revokeInvite(request.user.sub, params.id)
      return reply.status(204).send()
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  fastify.get('/accesses', {
    preHandler: authenticate,
    schema: {
      tags: ['Wallet Sharing'],
      summary: 'Listar acessos ativos concedidos pelo dono',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const accesses = await listOwnedAccesses(request.user.sub)
    return reply.send({ accesses })
  })

  fastify.get('/accesses/shared-with-me', {
    preHandler: authenticate,
    schema: {
      tags: ['Wallet Sharing'],
      summary: 'Listar carteiras compartilhadas comigo',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const accesses = await listSharedWithMe(request.user.sub)
    return reply.send({ accesses })
  })
}