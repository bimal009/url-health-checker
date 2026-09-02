import { z } from "zod"

export const submittedUrlSchema = z
  .url()
  .refine((val) => {
    const protocol = new URL(val).protocol
    return protocol === "http:" || protocol === "https:"
  }, { message: "Must be a valid http:// or https:// URL" })

export const batchStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "cancelled",
])
export type BatchStatus = z.infer<typeof batchStatusSchema>


export const batchRowSchema = z.object({
  id: z.string().uuid(),
  status: batchStatusSchema,
  totalUrls: z.number().int(),
  completedCount: z.number().int(),
  successCount: z.number().int(),
  failedCount: z.number().int(),
  eventSeq: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
export type BatchRow = z.infer<typeof batchRowSchema>


export const createBatchSchema = z.object({
  urls: z.array(submittedUrlSchema).min(1),
})
export type CreateBatchInput = z.infer<typeof createBatchSchema>


export const createBatchResponseSchema = z.object({
  batchId: z.string().uuid(),
})
export type CreateBatchResponse = z.infer<typeof createBatchResponseSchema>


export const cancelBatchResponseSchema = z.object({
  cancelled: z.literal(true),
})
export type CancelBatchResponse = z.infer<typeof cancelBatchResponseSchema>


export const retryBatchResponseSchema = z.object({
  retried: z.literal(true),
})
export type RetryBatchResponse = z.infer<typeof retryBatchResponseSchema>