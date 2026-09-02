import { z } from "zod"

export const urlCheckJobSchema = z.object({
  urlId: z.string().uuid(),
  batchId: z.string().uuid(),
  url: z.string(),
})
export type UrlCheckJobData = z.infer<typeof urlCheckJobSchema>

export const controllerResultSchema = z.object({
  httpStatusCode: z.number().int(),
  responseTimeMs: z.number().int(),
  title: z.string().nullable(),
})

export type ControllerResult = z.infer<typeof controllerResultSchema>

export const PUBSUB_TYPES = {
  BATCH_RUNNING: "batch-running",
  URL_SETTLED: "url-settled",
  BATCH_CANCELLED: "batch-cancelled",
  BATCH_RETRIED: "batch-retried",
} as const

export const batchUpdateTypeSchema = z.enum([
  PUBSUB_TYPES.BATCH_RUNNING,
  PUBSUB_TYPES.URL_SETTLED,
  PUBSUB_TYPES.BATCH_CANCELLED,
  PUBSUB_TYPES.BATCH_RETRIED,
])
export type BatchUpdateType = z.infer<typeof batchUpdateTypeSchema>