import { Worker } from "bullmq"
import { and, eq, inArray } from "drizzle-orm"
import { onUrlSettled, processJob } from "../jobs/job.js"
import { redis } from "../lib/redis"
import { bullMqConnection } from "../lib/bullmq-connection.js"
import { db } from "../db/db.js"
import { urlTable } from "../db/schema/index.js"
import { getDetailedErrorMessage } from "../lib/utils.js"

export const worker = new Worker(
  "url-checks",
  (job) => processJob(job, redis),
  { connection: bullMqConnection, concurrency: 5 }
)

worker.on("completed", (job) => {
  console.log(`Job ${job.id} has completed!`)
})

worker.on("error", (err) => {
  console.error("Worker error:", err)
})

worker.on("failed", async (job, err) => {
  if (!job) return

  try {
    const attemptsMade = job.attemptsMade
    const maxAttempts = job.opts.attempts ?? 1
    const retriesExhausted = attemptsMade >= maxAttempts

    if (!retriesExhausted) return

    const { urlId, batchId } = job.data

    const batch = await db.query.batchTable.findFirst({ where: { id: batchId } })
    if (!batch || batch.status === "cancelled") return

    const [updated] = await db
      .update(urlTable)
      .set({
        status: "failed",
        errorMessage: getDetailedErrorMessage(err),
        attemptCount: attemptsMade,
        updatedAt: new Date(),
      })
      .where(and(eq(urlTable.id, urlId), inArray(urlTable.status, ["pending", "processing"])))
      .returning()

    if (!updated) return

    await onUrlSettled(batchId, "failed", redis)
  } catch (handlerErr) {
    console.error(`Failed to record failure for job ${job.id}:`, handlerErr)
  }
})

async function shutdown(signal: string) {
  console.log(`[worker] received ${signal}, shutting down gracefully...`)
  await worker.close()
  console.log("[worker] shut down cleanly")
  process.exit(0)
}

process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))

console.log("[worker] listening for jobs, concurrency=5")