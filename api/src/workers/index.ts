import { Worker } from "bullmq"
import { processJob, settleUrl } from "../jobs/job.js"
import { redis } from "../lib/redis"
import { bullMqConnection } from "../lib/bullmq-connection.js"
import { urlCheckQueue } from "../jobs/queue.js"
import { db } from "../db/db.js"
import { getDetailedErrorMessage } from "../lib/utils.js"

const CONCURRENCY = 5

await urlCheckQueue.setGlobalConcurrency(CONCURRENCY)

export const worker = new Worker(
  "url-checks",
  (job) => processJob(job, redis),
  { connection: bullMqConnection, concurrency: CONCURRENCY }
)

worker.on("error", (err) => {
  console.error("[worker] error:", err)
})

worker.on("failed", async (job, err) => {
  if (!job) return

  try {
    const maxAttempts = job.opts.attempts ?? 1
    if (job.attemptsMade < maxAttempts) return

    const { urlId, batchId } = job.data

    const batch = await db.query.batchTable.findFirst({ where: { id: batchId } })
    if (!batch || batch.status === "cancelled") return

    await settleUrl(batchId, urlId, "failed", redis, {
      errorMessage: getDetailedErrorMessage(err),
      attemptCount: job.attemptsMade,
    })
  } catch (handlerErr) {
    console.error(`[worker] failed to record failure for job ${job.id}:`, handlerErr)
  }
})

async function shutdown(signal: string) {
  console.log(`[worker] received ${signal}, shutting down gracefully...`)
  try {
    await worker.close()
    console.log("[worker] shut down cleanly")
    process.exit(0)
  } catch (err) {
    console.error("[worker] error during shutdown:", err)
    process.exit(1)
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"))
process.on("SIGTERM", () => void shutdown("SIGTERM"))

console.log(`[worker] listening for jobs (concurrency=${CONCURRENCY}, global cap=${CONCURRENCY})`)
