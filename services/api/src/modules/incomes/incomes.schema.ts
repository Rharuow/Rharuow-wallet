import { z } from 'zod'

export const RECURRENCE_UNITS = ['DAY', 'WEEK', 'MONTH', 'YEAR'] as const
export type RecurrenceUnit = (typeof RECURRENCE_UNITS)[number]

// ----------------------------------------------------------------
// IncomeRecurrence
// ----------------------------------------------------------------

export const CreateIncomeRecurrenceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(255).optional(),
  amount: z.number().positive(),
  unit: z.enum(RECURRENCE_UNITS),
  interval: z.number().int().positive(),
  startDate: z.string().datetime(),
  maxOccurrences: z.number().int().positive().optional(),
})
export type CreateIncomeRecurrenceInput = z.infer<typeof CreateIncomeRecurrenceSchema>

export const UpdateIncomeRecurrenceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(255).optional(),
  amount: z.number().positive().optional(),
  unit: z.enum(RECURRENCE_UNITS).optional(),
  interval: z.number().int().positive().optional(),
  maxOccurrences: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
})
export type UpdateIncomeRecurrenceInput = z.infer<typeof UpdateIncomeRecurrenceSchema>

// ----------------------------------------------------------------
// Income
// ----------------------------------------------------------------

export const CreateIncomeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(255).optional(),
  amount: z.number().positive(),
  date: z.string().datetime(),
})
export type CreateIncomeInput = z.infer<typeof CreateIncomeSchema>

export const UpdateIncomeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(255).optional(),
  amount: z.number().positive().optional(),
  date: z.string().datetime().optional(),
})
export type UpdateIncomeInput = z.infer<typeof UpdateIncomeSchema>

export const IncomeListQuerySchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
export type IncomeListQuery = z.infer<typeof IncomeListQuerySchema>

// ----------------------------------------------------------------
// Analytics
// ----------------------------------------------------------------

export const IncomeAnalyticsQuerySchema = z.object({
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
})
export type IncomeAnalyticsQuery = z.infer<typeof IncomeAnalyticsQuerySchema>
