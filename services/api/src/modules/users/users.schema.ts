import { z } from 'zod'

export const updateUserSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').optional(),
})

export type UpdateUserInput = z.infer<typeof updateUserSchema>
