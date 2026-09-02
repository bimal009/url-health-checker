import "dotenv/config"
import Fastify from "fastify"
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from "fastify-type-provider-zod"
import { corsPlugin } from "./plugins/cors.js"
import { dbPlugin } from "./plugins/db.js"
import { redisPlugin } from "./plugins/redis.js"
import { batchRoutes } from "./routes/batch.js"

const fastify = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>()

fastify.setValidatorCompiler(validatorCompiler)
fastify.setSerializerCompiler(serializerCompiler)

await fastify.register(corsPlugin)
await fastify.register(dbPlugin)
await fastify.register(redisPlugin)
await fastify.register(batchRoutes, { prefix: "/batches" })

fastify.get("/health", (request, reply) => {
  reply.send({
    status: "ok",
    uptime: process.uptime(),
  })
})

fastify.listen({ port: 8080, host: "0.0.0.0" }, (err) => {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
})

async function shutdown(signal: string) {
  fastify.log.info(`Received ${signal}, shutting down gracefully...`)
  await fastify.close()
  fastify.log.info("Shut down cleanly")
  process.exit(0)
}

process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))