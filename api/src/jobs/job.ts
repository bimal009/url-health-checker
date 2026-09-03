import { UrlCheckJobData, UrlSettleFields } from "@task/types"
import { DelayedError, Job } from "bullmq"
import { and, eq, inArray, sql } from "drizzle-orm"
import { checkRateLimit } from "../lib/rate-limit"
import { batchTable, urlTable } from "../db/schema"
import { db } from "../db/db"
import { urlCheckController } from "./controller"
import { RedisInstance } from "../plugins/redis"
import { batchUpdateKey } from "../lib/constants"
import { invalidateBatchList } from "../lib/cache"

async function batchIsCancelled(batchId: string) {
  const batch = await db.query.batchTable.findFirst({ where: { id: batchId } })
  return !batch || batch.status === "cancelled"
}

export async function processJob(job: Job<UrlCheckJobData>, redis: RedisInstance) {
  const { urlId, batchId, url } = job.data

  if (await batchIsCancelled(batchId)) return

  if (!(await checkRateLimit(redis))) {
    await job.moveToDelayed(Date.now() + 100, job.token)
    throw new DelayedError()
  }

  const started = await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(urlTable)
      .set({ status: "processing", updatedAt: new Date() })
      .where(and(eq(urlTable.id, urlId), inArray(urlTable.status, ["pending", "processing"])))
      .returning()

    if (!claimed) return null

    const [batch] = await tx
      .update(batchTable)
      .set({ status: "running", updatedAt: new Date() })
      .where(and(eq(batchTable.id, batchId), eq(batchTable.status, "pending")))
      .returning()

    return { firstInBatch: !!batch }
  })

  if (!started) return

  if (started.firstInBatch) await invalidateBatchList(redis)
  await redis.publish(batchUpdateKey(batchId), "1")

  try {
    const result = await urlCheckController(url)

    if (await batchIsCancelled(batchId)) return

    await settleUrl(batchId, urlId, "success", redis, {
      httpStatusCode: result.httpStatusCode,
      responseTimeMs: result.responseTimeMs,
      title: result.title,
      errorMessage: null,
      attemptCount: job.attemptsMade + 1,
    })
  } catch (err) {
    if (await batchIsCancelled(batchId)) return

    const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1)
    if (!isFinalAttempt) throw err

    await settleUrl(batchId, urlId, "failed", redis, {
      httpStatusCode: null,
      responseTimeMs: null,
      title: null,
      errorMessage: err instanceof Error ? err.message : String(err),
      attemptCount: job.attemptsMade + 1,
    })
  }
}

export async function settleUrl(
  batchId: string,
  urlId: string,
  outcome: "success" | "failed",
  redis: RedisInstance,
  fields: UrlSettleFields
) {
  const batch = await db.transaction(async (tx) => {
    const [settled] = await tx
      .update(urlTable)
      .set({ status: outcome, updatedAt: new Date(), ...fields })
      .where(and(eq(urlTable.id, urlId), inArray(urlTable.status, ["pending", "processing"])))
      .returning()

    if (!settled) return null

    const [row] = await tx
      .update(batchTable)
      .set({
        completedCount: sql`${batchTable.completedCount} + 1`,
        successCount: sql`${batchTable.successCount} + ${outcome === "success" ? 1 : 0}`,
        failedCount: sql`${batchTable.failedCount} + ${outcome === "failed" ? 1 : 0}`,
        updatedAt: new Date(),
      })
      .where(eq(batchTable.id, batchId))
      .returning()

    return row ?? null
  })

  if (!batch) return

  if (batch.status === "running" && batch.completedCount >= batch.totalUrls) {
    await db
      .update(batchTable)
      .set({ status: "completed", updatedAt: new Date() })
      .where(and(eq(batchTable.id, batchId), eq(batchTable.status, "running")))
  }

  await invalidateBatchList(redis)
  await redis.publish(batchUpdateKey(batchId), "1")
}