import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

/**
 * Garante que a role Root existe e que o usuário default está criado.
 * Chamado automaticamente ao startar o servidor.
 */
export async function seed(logger?: { info: (msg: string) => void }) {
  const log = (msg: string) => logger?.info(msg) ?? console.info(msg)

  // --- Root role ---
  let rootRole = await prisma.role.findUnique({ where: { name: 'Root' } })
  if (!rootRole) {
    rootRole = await prisma.role.create({ data: { name: 'Root' } })
    log('[seed] Role "Root" criada.')
  } else {
    log('[seed] Role "Root" já existe.')
  }

  // --- Usuário default ---
  const defaultEmail =
    process.env.DEFAULT_USER_EMAIL ?? 'rharuow@mail.com'
  const defaultPassword =
    process.env.DEFAULT_USER_PASSWORD ?? 'endx9zss.2250667'
  const defaultName = process.env.DEFAULT_USER_NAME ?? 'Admin'

  const existing = await prisma.user.findUnique({ where: { email: defaultEmail } })
  if (!existing) {
    const passwordHash = await bcrypt.hash(defaultPassword, 12)
    await prisma.user.create({
      data: {
        email: defaultEmail,
        name: defaultName,
        passwordHash,
        roleId: rootRole.id,
      },
    })
    log(`[seed] Usuário default "${defaultEmail}" criado com role Root.`)
  } else {
    log(`[seed] Usuário default "${defaultEmail}" já existe.`)
  }
}
