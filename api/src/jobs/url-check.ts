import { Worker } from "bullmq"
import IORedis from "ioredis"

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
})

const worker = new Worker(
  "url-checks",
  async (job) => {
    const { urlId, batchId } = job.data
  },
  {
    connection,
    concurrency: 5,
  }
)

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message)
})

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`)
})