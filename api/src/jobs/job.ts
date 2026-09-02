import { UrlCheckJobData } from "@task/types"
import { DelayedError, Job } from "bullmq"
import { and, eq, inArray, sql } from "drizzle-orm"
import { checkRateLimit } from "../lib/rate-limit"
import { batchTable, urlTable } from "../db/schema"
import { db } from "../db/db"
import { urlCheckController } from "./controller"
import { RedisInstance } from "../plugins/redis"
import { batchUpdateKey, KEYS } from "../lib/constants"

async function isBatchCancelled(batchId: string) {
  const batch = await db.query.batchTable.findFirst({ where: { id: batchId } })
  return !batch || batch.status === "cancelled"
}

export async function processJob(job: Job<UrlCheckJobData>, redis: RedisInstance) {
  const { urlId, batchId, url } = job.data

  if (await isBatchCancelled(batchId)) return

  const allowed = await checkRateLimit(redis)
  if (!allowed) {
    await job.moveToDelayed(Date.now() + 100, job.token)
    throw new DelayedError()
  }


console.log(`rate-limiter request allowed at ${Date.now()} — global limit: 10/sec across all workers`)


  const updatedBatch = await db.transaction(async (tx) => {
    const [batch] = await tx
      .update(batchTable)
      .set({ status: "running", updatedAt: new Date() })
      .where(and(eq(batchTable.id, batchId), eq(batchTable.status, "pending")))
      .returning()

    await tx
      .update(urlTable)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(urlTable.id, urlId))

    return batch
  })

  if (updatedBatch) {
    await redis.publish(batchUpdateKey(batchId), "1")
  }

  const checkResult = await urlCheckController(url)

  if (await isBatchCancelled(batchId)) return

  const [updated] = await db
    .update(urlTable)
    .set({
      status: "success",
      httpStatusCode: checkResult.httpStatusCode,
      responseTimeMs: checkResult.responseTimeMs,
      title: checkResult.title,
      attemptCount: job.attemptsMade + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(urlTable.id, urlId), inArray(urlTable.status, ["pending", "processing"])))
    .returning()

  if (!updated) return

  await onUrlSettled(batchId, "success", redis)
}

export async function onUrlSettled(
  batchId: string,
  outcome: "success" | "failed",
  redis: RedisInstance
) {
  const wasSuccess = outcome === "success" ? 1 : 0
  const wasFailed = outcome === "failed" ? 1 : 0

  const [updatedBatch] = await db
    .update(batchTable)
    .set({
      completedCount: sql`${batchTable.completedCount} + 1`,
      successCount: sql`${batchTable.successCount} + ${wasSuccess}`,
      failedCount: sql`${batchTable.failedCount} + ${wasFailed}`,
      updatedAt: new Date(),
    })
    .where(eq(batchTable.id, batchId))
    .returning()

  const allUrlsDone = updatedBatch && updatedBatch.completedCount >= updatedBatch.totalUrls

  if (allUrlsDone) {
    await db
      .update(batchTable)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(batchTable.id, batchId))

  }

  await redis.publish(batchUpdateKey(batchId), "1")
}