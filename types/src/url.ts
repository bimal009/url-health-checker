import { z } from "zod"


export const urlStatusSchema = z.enum([
  "pending",
  "processing",
  "success",
  "failed",
  "cancelled",
])
export type UrlStatus = z.infer<typeof urlStatusSchema>





export const urlRowSchema = z.object({
  id: z.string().uuid(),
  batchId: z.string().uuid(),
  url: z.string(),
  status: urlStatusSchema,
  httpStatusCode: z.number().int().nullable(),
  responseTimeMs: z.number().int().nullable(),
  title: z.string().nullable(),
  attemptCount: z.number().int(),
  jobId: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
export type UrlRow = z.infer<typeof urlRowSchema>


export const urlSettleFieldsSchema = z
  .object({
    httpStatusCode: z.number().int().nullable(),
    responseTimeMs: z.number().int().nullable(),
    title: z.string().nullable(),
    errorMessage: z.string().nullable(),
    attemptCount: z.number().int(),
  })
  .partial()
export type UrlSettleFields = z.infer<typeof urlSettleFieldsSchema>