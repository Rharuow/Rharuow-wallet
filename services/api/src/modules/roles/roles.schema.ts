import { z } from 'zod'

export const createRoleSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').trim(),
})

export const updateRoleSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').trim(),
})

export type CreateRoleInput = z.infer<typeof createRoleSchema>
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>
