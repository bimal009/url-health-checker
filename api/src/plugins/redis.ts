import fp from "fastify-plugin"
import { redis } from "../lib/redis"

export const redisPlugin = fp(async (fastify) => {
  fastify.decorate("redis", redis)
})

export type RedisInstance = typeof redis