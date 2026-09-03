import { FastifyPluginAsyncZod } from "fastify-type-provider-zod"
import { createBatchSchema, idParamsSchema } from "@task/types"
import {
  cancelBatch,
  createBatch,
  getBatches,
  getBatchById,
  retryFailed,
  streamBatchUpdates,
} from "../services/batch.js"

export const batchRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post("/", { schema: { body: createBatchSchema } }, async (request, reply) => {
    const batch = await createBatch(fastify.db, request.body, fastify.redis)
    return reply.code(201).send({ batchId: batch.id })
  })

  fastify.get("/", async () => getBatches(fastify.db, fastify.redis))

  fastify.get("/:id", { schema: { params: idParamsSchema } }, async (request) =>
    getBatchById(fastify.db, request.params.id)
  )

  fastify.get("/:id/events", { schema: { params: idParamsSchema } }, async (request, reply) => {
    await getBatchById(fastify.db, request.params.id)
    await streamBatchUpdates(fastify.db, request.params.id, reply)
  })

  fastify.post("/:id/cancel", { schema: { params: idParamsSchema } }, async (request) =>
    cancelBatch(fastify.db, fastify.redis, request.params.id)
  )

  fastify.post("/:id/retry", { schema: { params: idParamsSchema } }, async (request) =>
    retryFailed(fastify.db, fastify.redis, request.params.id)
  )
}
