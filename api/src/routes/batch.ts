import { FastifyPluginAsyncZod } from "fastify-type-provider-zod"
import { createBatchSchema } from "@task/types"
import {
  cancelBatch,
  createBatch,
  getBatches,
  getBatchById,
  retryFailed,
  streamBatchUpdates,
} from "../services/batch.js"
import { ConflictError, NotFoundError } from "../lib/errors.js"
import {idParamsSchema} from "@task/types"

export const batchRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/",
    { schema: { body: createBatchSchema } },
    async (request, reply) => {
      const batch = await createBatch(fastify.db, request.body, fastify.redis)
      reply.code(201)
      return { batchId: batch.id }
    }
  )

  fastify.get("/", async (request, reply) => {
    const batches = await getBatches(fastify.db, fastify.redis)
    return batches
  })

  fastify.get(
    "/:id",
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      try {
        const batch = await getBatchById(fastify.db, request.params.id)
        return batch
      } catch (err) {
        if (err instanceof NotFoundError) {
          reply.code(404)
          return { error: err.message }
        }
        throw err
      }
    }
  )

  fastify.get(
    "/:id/events",
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      const { id: batchId } = request.params

      try {
        await getBatchById(fastify.db, batchId)
      } catch (err) {
        if (err instanceof NotFoundError) {
          reply.code(404)
          return { error: err.message }
        }
        throw err
      }

      await streamBatchUpdates(fastify.db, batchId, reply)
    }
  )

  fastify.post(
    "/:id/cancel",
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      try {
        return await cancelBatch(fastify.db, request.params.id, fastify.redis)
      } catch (err) {
        if (err instanceof NotFoundError) {
          reply.code(404)
          return { error: err.message }
        }
        if (err instanceof ConflictError) {
          reply.code(409)
          return { error: err.message }
        }
        throw err
      }
    }
  )

  fastify.post(
    "/:id/retry",
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      try {
        return await retryFailed(fastify.db, request.params.id, fastify.redis)
      } catch (err) {
        if (err instanceof NotFoundError) {
          reply.code(404)
          return { error: err.message }
        }
        throw err
      }
    }
  )
}