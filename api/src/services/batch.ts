import { and, eq, inArray, sql } from "drizzle-orm"
import { CreateBatchInput, PUBSUB_TYPES, UrlCheckJobData } from "@task/types"
import { DB } from "../db/db.js"
import { batchTable, urlTable } from "../db/schema/index.js"
import { urlCheckQueue } from "../jobs/queue.js"
import { batchUpdateKey, KEYS, TTL } from "../lib/constants.js"
import { RedisInstance } from "../plugins/redis.js"
import { ConflictError, NotFoundError } from "../lib/errors.js"
import { createSubscriber } from "../lib/redis.js"
import { FastifyReply } from "fastify"


const listBatchesKey = () => `${KEYS.BATCHES}:list`

const invalidateBatches = async (redis: RedisInstance) => {
  try {
    await redis.del(listBatchesKey())
  } catch (err) {
    console.error("Failed to invalidate batch list cache:", err)
  }
}

const publishBatchUpdate = async (redis: RedisInstance, batchId: string, type: string) => {
  await redis.publish(batchUpdateKey(batchId), JSON.stringify({ type }))
}

export const createBatch = async (
  db: DB,
  batchData: CreateBatchInput,
  redis: RedisInstance
) => {
  const { urls } = batchData

  const { batch, insertedUrls } = await db.transaction(async (tx) => {
    const [batch] = await tx
      .insert(batchTable)
      .values({ totalUrls: urls.length })
      .returning()

    const insertedUrls = await tx
      .insert(urlTable)
      .values(urls.map((url) => ({ batchId: batch.id, url, status: "pending" as const })))
      .returning()

    return { batch, insertedUrls }
  })

  try {
    const jobs = await urlCheckQueue.addBulk(
      insertedUrls.map((row) => ({
        name: "check-url",
        data: {
          urlId: row.id,
          batchId: batch.id,
          url: row.url,
        } satisfies UrlCheckJobData,
      }))
    )

    await db.transaction(async (tx) => {
      await Promise.all(
        jobs.map((job, i) =>
          tx.update(urlTable).set({ jobId: job.id }).where(eq(urlTable.id, insertedUrls[i].id))
        )
      )
    })
  } catch (err) {
    await db.transaction(async (tx) => {
      await tx
        .update(batchTable)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(batchTable.id, batch.id))

      await tx
        .update(urlTable)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(urlTable.batchId, batch.id))
    })

    throw err
  }

  await invalidateBatches(redis)

  return batch
}

export const getBatches = async (db: DB, redis: RedisInstance) => {
  try {
    const cached = await redis.get(listBatchesKey())
    if (cached) {
      return JSON.parse(cached)
    }
  } catch (err) {
    console.error("Failed to read batch list cache:", err)
  }

  const batches = await db.select().from(batchTable).orderBy(batchTable.createdAt)

  try {
    await redis.set(listBatchesKey(), JSON.stringify(batches), "EX", TTL.SHORT)
  } catch (err) {
    console.error("Failed to write batch list cache:", err)
  }

  return batches
}

export const getBatchById = async (db: DB, id: string) => {
  const batch = await db.query.batchTable.findFirst({
    where: { id },
    with: { urls: true },
  })

  if (!batch) {
    throw new NotFoundError(`Batch ${id} not found`)
  }

  return batch
}

export const cancelBatch = async (db: DB, redis: RedisInstance, batchId: string) => {
  const batch = await getBatchById(db, batchId)

  if (batch.status === "completed" || batch.status === "cancelled") {
    throw new ConflictError(`Batch ${batchId} is already ${batch.status}`)
  }

  await redis.set(`cancelled:${batchId}`, "1", "EX", 300)

  const cancellableUrls = batch.urls.filter(
    (url) => url.status === "pending" || url.status === "processing"
  )

  await Promise.all(
    cancellableUrls.map(async (url) => {
      if (!url.jobId) return
      const job = await urlCheckQueue.getJob(url.jobId)
      if (!job) return

      const state = await job.getState()
      if (state === "waiting" || state === "delayed") {
        await job.remove()
      }
    })
  )

  await db.transaction(async (tx) => {
    await tx
      .update(batchTable)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(batchTable.id, batchId))

    await tx
      .update(urlTable)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(urlTable.batchId, batchId),
          inArray(urlTable.status, ["pending", "processing"])
        )
      )
  })

  await invalidateBatches(redis)
  await publishBatchUpdate(redis, batchId, PUBSUB_TYPES.BATCH_CANCELLED)

  return { cancelled: true as const }
}

export const retryFailed = async (db: DB, redis: RedisInstance, batchId: string) => {
  const batch = await getBatchById(db, batchId)

  if (batch.status === "cancelled") {
    throw new ConflictError(`Batch ${batchId} is cancelled, cannot retry`)
  }

  const failedUrls = batch.urls.filter((url) => url.status === "failed")

  if (failedUrls.length === 0) {
    return { retried: true as const }
  }

  const failedIds = failedUrls.map((url) => url.id)

  await redis.del(`cancelled:${batchId}`)

  await db.transaction(async (tx) => {
    await tx
      .update(urlTable)
      .set({
        status: "pending",
        httpStatusCode: null,
        responseTimeMs: null,
        title: null,
        errorMessage: null,
        jobId: null,
        updatedAt: new Date(),
      })
      .where(inArray(urlTable.id, failedIds))

    await tx
      .update(batchTable)
      .set({
        status: "running",
        completedCount: sql`${batchTable.completedCount} - ${failedUrls.length}`,
        failedCount: sql`${batchTable.failedCount} - ${failedUrls.length}`,
        updatedAt: new Date(),
      })
      .where(eq(batchTable.id, batchId))
  })

  try {
    const jobs = await urlCheckQueue.addBulk(
      failedUrls.map((url) => ({
        name: "check-url",
        data: {
          urlId: url.id,
          batchId,
          url: url.url,
        } satisfies UrlCheckJobData,
        opts: {
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
        },
      }))
    )

    await db.transaction(async (tx) => {
      await Promise.all(
        jobs.map((job, i) =>
          tx.update(urlTable).set({ jobId: job.id }).where(eq(urlTable.id, failedUrls[i].id))
        )
      )
    })
  } catch (err) {
    await db.transaction(async (tx) => {
      await tx
        .update(urlTable)
        .set({ status: "failed", updatedAt: new Date() })
        .where(inArray(urlTable.id, failedIds))

      await tx
        .update(batchTable)
        .set({
          completedCount: sql`${batchTable.completedCount} + ${failedUrls.length}`,
          failedCount: sql`${batchTable.failedCount} + ${failedUrls.length}`,
          updatedAt: new Date(),
        })
        .where(eq(batchTable.id, batchId))
    })

    throw err
  }

  await invalidateBatches(redis)
  await publishBatchUpdate(redis, batchId, PUBSUB_TYPES.BATCH_RETRIED)

  return { retried: true as const }
}




export const streamBatchUpdates = async (db: DB, batchId: string, reply: FastifyReply) => {
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": process.env.WEB_URL ?? "http://localhost:3000",
    "Access-Control-Allow-Credentials": "true",
  })


  const initialBatch = await getBatchById(db, batchId)
  reply.raw.write(`data: ${JSON.stringify(initialBatch)}\n\n`)

  if (initialBatch.status === "completed" || initialBatch.status === "cancelled") {
    reply.raw.end()
    return
  }

  const subscriber = createSubscriber()
  await subscriber.subscribe(batchUpdateKey(batchId))

  const cleanup = () => {
    subscriber.unsubscribe().catch(() => {})
    subscriber.disconnect()
  }

  subscriber.on("message", async () => {
    try {
      const latestBatch = await getBatchById(db, batchId)
      reply.raw.write(`data: ${JSON.stringify(latestBatch)}\n\n`)

      if (latestBatch.status === "completed" || latestBatch.status === "cancelled") {
        cleanup() 
        reply.raw.end()
      }
    } catch (err) {
      console.error("Error handling SSE update:", err)
    }
  })

  const ping = setInterval(() => {
    reply.raw.write(": ping\n\n")
  }, 15000)

  reply.raw.on("close", () => {
    clearInterval(ping)
    cleanup() 
  })
}