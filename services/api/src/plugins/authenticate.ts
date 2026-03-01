import { FastifyReply, FastifyRequest } from 'fastify'

/**
 * preHandler para rotas autenticadas.
 * Valida o JWT enviado no header Authorization: Bearer <token>.
 * Popula request.user com { sub, email, role }.
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.send(err)
  }
}
