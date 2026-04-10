import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { prisma } from '../../lib/prisma'
import { sendVerificationEmail, sendPasswordResetEmail } from '../../lib/mailer'
import { publishUserRegistered } from '../../lib/kafka'
import { appLogger } from '../../lib/logger'
import type { LoginInput, RegisterInput, ForgotPasswordInput, ResetPasswordInput, ResendVerificationInput } from './auth.schema'

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

  const role = await prisma.role.findUnique({
    where: { id: input.roleId ?? '' },
  }) ?? await prisma.role.findUnique({ where: { name: 'User' } })

  if (!role) {
    const error = new Error('Role não encontrada') as Error & {
      statusCode: number
    }
    error.statusCode = 404
    throw error
  }

  const passwordHash = await bcrypt.hash(input.password, 12)

  const premiumPlan = await prisma.plan.findUnique({ where: { name: 'PREMIUM' } })

  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        roleId: role.id,
        isActive: false,
        planId: premiumPlan?.id ?? null,
        planExpiresAt: premiumPlan ? thirtyDaysFromNow : null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true } },
        planExpiresAt: true,
        createdAt: true,
      },
    })

    await tx.emailVerifyToken.create({
      data: { userId: created.id, token, expiresAt },
    })

    return created
  })

  let verificationEmailSent = true

  try {
    await sendVerificationEmail(user.email, token)
  } catch (err) {
    verificationEmailSent = false
    appLogger.error('auth-verification-email-send-failed', {
      email: user.email,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  try {
    await publishUserRegistered({
      userId: user.id,
      email: user.email,
      name: user.name ?? null,
      passwordHash,
      registeredAt: user.createdAt,
    })
  } catch (err) {
    appLogger.error('auth-user-registered-publish-failed', {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  return {
    user,
    verificationEmailSent,
  }
}

export async function verifyEmail(token: string) {
  const record = await prisma.emailVerifyToken.findUnique({ where: { token } })

  if (!record || record.usedAt) {
    const error = new Error('Token inválido ou já utilizado') as Error & { statusCode: number }
    error.statusCode = 400
    throw error
  }

  if (record.expiresAt < new Date()) {
    const error = new Error('Token expirado') as Error & { statusCode: number }
    error.statusCode = 410
    throw error
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { isActive: true },
    }),
    prisma.emailVerifyToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ])
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

  if (!user.isActive) {
    const error = new Error('Conta não confirmada. Verifique seu e-mail.') as Error & {
      statusCode: number
    }
    error.statusCode = 403
    throw error
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    roleId: user.roleId,
  }
}

export async function forgotPassword(input: ForgotPasswordInput) {
  // Always respond with success to avoid e-mail enumeration
  const user = await prisma.user.findUnique({ where: { email: input.email } })
  if (!user) return

  // Invalidate any existing unused tokens for this user
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  })

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hora

  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt },
  })

  await sendPasswordResetEmail(user.email, token)
}

export async function resendVerificationEmail(input: ResendVerificationInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, email: true, isActive: true },
  })

  if (!user || user.isActive) {
    return
  }

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

  await prisma.$transaction([
    prisma.emailVerifyToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.emailVerifyToken.create({
      data: { userId: user.id, token, expiresAt },
    }),
  ])

  try {
    await sendVerificationEmail(user.email, token)
  } catch (err) {
    appLogger.error('auth-verification-email-resend-failed', {
      email: user.email,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

export async function resetPassword(input: ResetPasswordInput) {
  const record = await prisma.passwordResetToken.findUnique({ where: { token: input.token } })

  if (!record || record.usedAt) {
    const error = new Error('Token inválido ou já utilizado') as Error & { statusCode: number }
    error.statusCode = 400
    throw error
  }

  if (record.expiresAt < new Date()) {
    const error = new Error('Token expirado. Solicite uma nova redefinição de senha.') as Error & { statusCode: number }
    error.statusCode = 410
    throw error
  }

  const passwordHash = await bcrypt.hash(input.password, 12)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ])
}
