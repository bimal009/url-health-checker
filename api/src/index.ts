import "dotenv/config"
import path from "node:path"
import { fileURLToPath } from "node:url"
import fastifyStatic from "@fastify/static"
import Fastify from "fastify"
import { corsPlugin } from "./plugins/cors.js"
import { dbPlugin } from "./plugins/db.js"
import { redisPlugin } from "./plugins/redis.js"
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from "fastify-type-provider-zod"
import { batchRoutes } from "./routes/batch.js"
const fastify = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>()
fastify.setValidatorCompiler(validatorCompiler)
fastify.setSerializerCompiler(serializerCompiler)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

await fastify.register(fastifyStatic, {
  root: path.join(__dirname, "html"),
  prefix: "/tests/html/",
})
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