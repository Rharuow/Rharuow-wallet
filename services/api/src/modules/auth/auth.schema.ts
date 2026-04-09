import { z } from 'zod'

const emailField = z.string().trim().toLowerCase().email('E-mail inválido')

export const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').optional(),
  email: emailField,
  password: z
    .string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um número'),
  // roleId é opcional: se omitido, o backend atribui a role "User" automaticamente
  roleId: z.string().min(1).optional(),
})

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Senha é obrigatória'),
})

export const forgotPasswordSchema = z.object({
  email: emailField,
})

export const resendVerificationSchema = z.object({
  email: emailField,
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
  password: z
    .string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um número'),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
