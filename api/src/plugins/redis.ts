import fp from "fastify-plugin"
import { redis } from "../lib/redis"

export const redisPlugin = fp(async (fastify) => {
  fastify.decorate("redis", redis)
  fastify.addHook("onClose", async () => {
    await redis.quit()
  })
})

export type RedisInstance = typeof redis
