import { z } from 'zod'

export const CreateWalletInviteSchema = z.object({
  guestEmail: z.string().trim().email().max(255),
})

export const WalletInviteTokenParamsSchema = z.object({
  token: z.string().min(1),
})

export const WalletInviteIdParamsSchema = z.object({
  id: z.string().min(1),
})

export type CreateWalletInviteInput = z.infer<typeof CreateWalletInviteSchema>
export type WalletInviteTokenParams = z.infer<typeof WalletInviteTokenParamsSchema>
export type WalletInviteIdParams = z.infer<typeof WalletInviteIdParamsSchema>