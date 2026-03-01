import bcrypt from 'bcryptjs'
import { prisma } from '../../lib/prisma'
import type { LoginInput, RegisterInput } from './auth.schema'

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  })

  if (existing) {
    const error = new Error('E-mail já cadastrado') as Error & {
      statusCode: number
    }
    error.statusCode = 409
    throw error
  }

  const role = await prisma.role.findUnique({ where: { id: input.roleId } })
  if (!role) {
    const error = new Error('Role não encontrada') as Error & {
      statusCode: number
    }
    error.statusCode = 404
    throw error
  }

  const passwordHash = await bcrypt.hash(input.password, 12)

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash,
      roleId: input.roleId,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: { select: { id: true, name: true } },
      createdAt: true,
    },
  })

  return user
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { role: { select: { id: true, name: true } } },
  })

  const invalidError = new Error('Credenciais inválidas') as Error & {
    statusCode: number
  }
  invalidError.statusCode = 401

  // Comparação mesmo se o usuário não existir (evita timing attack)
  const dummyHash =
    '$2b$12$invalidhashfortimingprotectiononly000000000000000000000'
  const passwordHash = user?.passwordHash ?? dummyHash
  const valid = await bcrypt.compare(input.password, passwordHash)

  if (!user || !valid) {
    throw invalidError
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    roleId: user.roleId,
  }
}
