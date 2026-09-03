import { and, eq, inArray, sql } from "drizzle-orm"
import { CreateBatchInput } from "@task/types"
import { DB } from "../db/db.js"
import { batchTable, urlTable } from "../db/schema/index.js"
import { urlCheckQueue } from "../jobs/queue.js"
import { batchUpdateKey, TTL } from "../lib/constants.js"
import { batchListKey, invalidateBatchList } from "../lib/cache.js"
import { RedisInstance } from "../plugins/redis.js"
import { ConflictError, NotFoundError } from "../lib/errors.js"
import { createSubscriber } from "../lib/redis.js"
import { FastifyReply } from "fastify"

const notify = (redis: RedisInstance, batchId: string) =>
  redis.publish(batchUpdateKey(batchId), "1").catch((err) => {
    console.error(`Failed to publish update for batch ${batchId}:`, err)
  })

async function enqueueChecks(db: DB, batchId: string, rows: { id: string; url: string }[]) {
  const jobs = await urlCheckQueue.addBulk(
    rows.map((row) => ({
      name: "check-url",
      data: { urlId: row.id, batchId, url: row.url },
      opts: { attempts: 3, backoff: { type: "exponential" as const, delay: 1000 } },
    }))
  )

  await db.transaction((tx) =>
    Promise.all(
      jobs.map((job, i) =>
        tx.update(urlTable).set({ jobId: job.id }).where(eq(urlTable.id, rows[i].id))
      )
    )
  )
}

export async function createBatch(db: DB, input: CreateBatchInput, redis: RedisInstance) {
  const { batch, urls } = await db.transaction(async (tx) => {
    const [batch] = await tx
      .insert(batchTable)
      .values({ totalUrls: input.urls.length })
      .returning()

    const urls = await tx
      .insert(urlTable)
      .values(input.urls.map((url) => ({ batchId: batch.id, url, status: "pending" as const })))
      .returning()

    return { batch, urls }
  })

  try {
    await enqueueChecks(db, batch.id, urls)
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

  await invalidateBatchList(redis)
  return batch
}

export async function getBatches(db: DB, redis: RedisInstance) {
  try {
    const cached = await redis.get(batchListKey)
    if (cached) return JSON.parse(cached)
  } catch (err) {
    console.error("Failed to read batch list cache:", err)
  }

  const batches = await db.select().from(batchTable).orderBy(batchTable.createdAt)

  try {
    await redis.set(batchListKey, JSON.stringify(batches), "EX", TTL.SHORT)
  } catch (err) {
    console.error("Failed to write batch list cache:", err)
  }

  return batches
}

export async function getBatchById(db: DB, id: string) {
  const batch = await db.query.batchTable.findFirst({
    where: { id },
    with: { urls: true },
  })
  if (!batch) throw new NotFoundError(`Batch ${id} not found`)
  return batch
}

export async function cancelBatch(db: DB, redis: RedisInstance, batchId: string) {
  const batch = await getBatchById(db, batchId)

  if (batch.status === "completed" || batch.status === "cancelled") {
    throw new ConflictError(`Batch ${batchId} is already ${batch.status}`)
  }

  const pending = batch.urls.filter(
    (u) => u.jobId && (u.status === "pending" || u.status === "processing")
  )
  await Promise.allSettled(
    pending.map(async (u) => {
      const job = await urlCheckQueue.getJob(u.jobId!)
      const state = await job?.getState()
      if (state === "waiting" || state === "delayed" || state === "prioritized") {
        await job!.remove()
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
      .where(and(eq(urlTable.batchId, batchId), inArray(urlTable.status, ["pending", "processing"])))
  })

  await invalidateBatchList(redis)
  await notify(redis, batchId)
  return { cancelled: true as const }
}

export async function retryFailed(db: DB, redis: RedisInstance, batchId: string) {
  const batch = await getBatchById(db, batchId)

  if (batch.status === "cancelled") {
    throw new ConflictError(`Batch ${batchId} is cancelled, cannot retry`)
  }

  const failed = batch.urls.filter((u) => u.status === "failed")
  if (failed.length === 0) return { retried: true as const }

  const ids = failed.map((u) => u.id)

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
      .where(inArray(urlTable.id, ids))

    await tx
      .update(batchTable)
      .set({
        status: "running",
        completedCount: sql`greatest(${batchTable.completedCount} - ${failed.length}, 0)`,
        failedCount: sql`greatest(${batchTable.failedCount} - ${failed.length}, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(batchTable.id, batchId))
  })

  try {
    await enqueueChecks(db, batchId, failed)
  } catch (err) {
    await db.transaction(async (tx) => {
      await tx
        .update(urlTable)
        .set({ status: "failed", updatedAt: new Date() })
        .where(inArray(urlTable.id, ids))
      await tx
        .update(batchTable)
        .set({
          completedCount: sql`${batchTable.completedCount} + ${failed.length}`,
          failedCount: sql`${batchTable.failedCount} + ${failed.length}`,
          updatedAt: new Date(),
        })
        .where(eq(batchTable.id, batchId))
    })
    throw err
  }

  await invalidateBatchList(redis)
  await notify(redis, batchId)
  return { retried: true as const }
}

export async function streamBatchUpdates(db: DB, batchId: string, reply: FastifyReply) {
  reply.hijack()
  for (const [key, value] of Object.entries(reply.getHeaders())) {
    if (value !== undefined) reply.raw.setHeader(key, value as string | number | string[])
  }
  reply.raw.setHeader("Content-Type", "text/event-stream")
  reply.raw.setHeader("Cache-Control", "no-cache")
  reply.raw.setHeader("Connection", "keep-alive")
  reply.raw.setHeader("X-Accel-Buffering", "no")
  reply.raw.writeHead(200)
  reply.raw.flushHeaders()

  const sub = createSubscriber()
  let ping: NodeJS.Timeout | undefined
  let closed = false

  const close = () => {
    if (closed) return
    closed = true
    clearInterval(ping)
    sub.removeAllListeners()
    sub.unsubscribe().catch(() => {})
    sub.disconnect()
    if (!reply.raw.writableEnded) reply.raw.end()
  }

  const send = (batch: unknown) => reply.raw.write(`data: ${JSON.stringify(batch)}\n\n`)

  reply.raw.on("close", close)
  reply.raw.on("error", close)

  try {
    const batch = await getBatchById(db, batchId)
    send(batch)
    if (batch.status === "completed" || batch.status === "cancelled") return close()

    await sub.subscribe(batchUpdateKey(batchId))
    sub.on("message", async () => {
      try {
        const latest = await getBatchById(db, batchId)
        if (closed) return
        send(latest)
        if (latest.status === "completed" || latest.status === "cancelled") close()
      } catch (err) {
        console.error(`SSE update failed for batch ${batchId}:`, err)
        close()
      }
    })

    ping = setInterval(() => {
      if (reply.raw.writableEnded) return close()
      reply.raw.write(": ping\n\n")
    }, 15000)
  } catch (err) {
    console.error(`Couldn't start SSE stream for batch ${batchId}:`, err)
    close()
  }
}
