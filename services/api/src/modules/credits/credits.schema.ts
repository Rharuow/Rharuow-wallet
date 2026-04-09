import { z } from 'zod'

export const createCreditTopupSchema = z.object({
  amount: z.coerce.number().finite().min(3, 'Valor minimo de recarga: R$ 3,00'),
})

export const creditLedgerQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export type CreateCreditTopupInput = z.infer<typeof createCreditTopupSchema>
export type CreditLedgerQueryInput = z.infer<typeof creditLedgerQuerySchema>