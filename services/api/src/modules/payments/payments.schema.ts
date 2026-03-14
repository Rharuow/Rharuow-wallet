import { z } from 'zod'

export const checkoutSchema = z.object({
  priceId: z.enum([
    process.env.STRIPE_PRICE_MONTHLY ?? '',
    process.env.STRIPE_PRICE_YEARLY ?? '',
  ] as [string, string]),
})

export type CheckoutInput = z.infer<typeof checkoutSchema>
