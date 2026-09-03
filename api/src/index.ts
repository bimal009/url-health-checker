import Fastify from "fastify"
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod"
import { env } from "./lib/env.js"
import { HttpError } from "./lib/errors.js"
import { corsPlugin } from "./plugins/cors.js"
import { dbPlugin } from "./plugins/db.js"
import { redisPlugin } from "./plugins/redis.js"
import { batchRoutes } from "./routes/batch.js"

const fastify = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>()

fastify.setValidatorCompiler(validatorCompiler)
fastify.setSerializerCompiler(serializerCompiler)

fastify.setErrorHandler((error, _request, reply) => {
  if (error instanceof HttpError) {
    return reply.code(error.statusCode).send({ error: error.message })
  }
  if (hasZodFastifySchemaValidationErrors(error)) {
    return reply.code(400).send({
      error: "Request validation failed",
      details: error.validation.map((v) => v.message),
    })
  }
  fastify.log.error({ err: error }, "unhandled error")
  return reply.code(500).send({ error: "Internal server error" })
})

await fastify.register(corsPlugin)
await fastify.register(dbPlugin)
await fastify.register(redisPlugin)
await fastify.register(batchRoutes, { prefix: "/batches" })

fastify.get("/health", () => ({
  status: "ok",
  uptime: process.uptime(),
}))

async function shutdown(signal: string) {
  fastify.log.info(`Received ${signal}, shutting down gracefully...`)
  try {
    await fastify.close()
    fastify.log.info("Shut down cleanly")
    process.exit(0)
  } catch (err) {
    fastify.log.error({ err }, "error during shutdown")
    process.exit(1)
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"))
process.on("SIGTERM", () => void shutdown("SIGTERM"))

try {
  await fastify.listen({ port: env.PORT, host: "0.0.0.0" })
} catch (err) {
  fastify.log.error({ err }, "failed to start server")
  process.exit(1)
}
