import { NotificationType } from '@prisma/client'
import { z } from 'zod'

export const NotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  type: z.nativeEnum(NotificationType).optional(),
  status: z.enum(['all', 'read', 'unread']).optional(),
  unreadOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((value) => (value === true || value === 'true' ? true : false))
    .default(false),
}).transform(({ unreadOnly, status, ...rest }) => ({
  ...rest,
  status: status ?? (unreadOnly ? 'unread' : 'all'),
}))

export const NotificationIdParamsSchema = z.object({
  id: z.string().min(1),
})

export type NotificationsQuery = z.infer<typeof NotificationsQuerySchema>
export type NotificationIdParams = z.infer<typeof NotificationIdParamsSchema>