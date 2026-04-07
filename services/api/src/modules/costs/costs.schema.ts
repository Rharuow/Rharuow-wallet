import { z } from 'zod'

// ----------------------------------------------------------------
// CostArea
// ----------------------------------------------------------------

export const CreateCostAreaSchema = z.object({
  name: z.string().min(1).max(80),
})
export type CreateCostAreaInput = z.infer<typeof CreateCostAreaSchema>

export const UpdateCostAreaSchema = z.object({
  name: z.string().min(1).max(80),
})
export type UpdateCostAreaInput = z.infer<typeof UpdateCostAreaSchema>

// ----------------------------------------------------------------
// CostType
// ----------------------------------------------------------------

export const CreateCostTypeSchema = z.object({
  name: z.string().min(1).max(80),
  areaId: z.string().cuid(),
})
export type CreateCostTypeInput = z.infer<typeof CreateCostTypeSchema>

export const UpdateCostTypeSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  areaId: z.string().cuid().optional(),
})
export type UpdateCostTypeInput = z.infer<typeof UpdateCostTypeSchema>

// ----------------------------------------------------------------
// CostRecurrence
// ----------------------------------------------------------------

export const RECURRENCE_UNITS = ['DAY', 'WEEK', 'MONTH', 'YEAR'] as const
export type RecurrenceUnit = (typeof RECURRENCE_UNITS)[number]

export const CreateCostRecurrenceSchema = z.object({
  costTypeId: z.string().cuid(),
  existingCostId: z.string().cuid().optional(),
  amount: z.number().positive(),
  description: z.string().max(255).optional(),
  unit: z.enum(RECURRENCE_UNITS),
  interval: z.number().int().positive(),
  startDate: z.string().datetime(),
  maxOccurrences: z.number().int().positive().optional(),
})
export type CreateCostRecurrenceInput = z.infer<typeof CreateCostRecurrenceSchema>

export const UpdateCostRecurrenceSchema = z.object({
  amount: z.number().positive().optional(),
  description: z.string().max(255).optional(),
  unit: z.enum(RECURRENCE_UNITS).optional(),
  interval: z.number().int().positive().optional(),
  maxOccurrences: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
})
export type UpdateCostRecurrenceInput = z.infer<typeof UpdateCostRecurrenceSchema>

// ----------------------------------------------------------------
// Cost
// ----------------------------------------------------------------

export const CreateCostSchema = z.object({
  costTypeId: z.string().cuid(),
  amount: z.number().positive(),
  description: z.string().max(255).optional(),
  date: z.string().datetime(),
})
export type CreateCostInput = z.infer<typeof CreateCostSchema>

export const UpdateCostSchema = z.object({
  costTypeId: z.string().cuid().optional(),
  amount: z.number().positive().optional(),
  description: z.string().max(255).optional(),
  date: z.string().datetime().optional(),
  recurrenceId: z.string().cuid().nullable().optional(),
})
export type UpdateCostInput = z.infer<typeof UpdateCostSchema>

export const CostListQuerySchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  areaId: z.string().cuid().optional(),
  costTypeId: z.string().cuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
export type CostListQuery = z.infer<typeof CostListQuerySchema>

// ----------------------------------------------------------------
// Analytics
// ----------------------------------------------------------------

export const CostAnalyticsQuerySchema = z.object({
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
  areaId: z.string().cuid().optional(),
  costTypeId: z.string().cuid().optional(),
})
export type CostAnalyticsQuery = z.infer<typeof CostAnalyticsQuerySchema>
