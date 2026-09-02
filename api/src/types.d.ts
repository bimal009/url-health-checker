import type { db } from "./db/db"
import { RedisInstance } from "./plugins/redis"

declare module "fastify" {
  interface FastifyInstance {
    db: typeof db
    redis: RedisInstance
  }
}