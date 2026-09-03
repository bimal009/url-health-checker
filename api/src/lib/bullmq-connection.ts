import { Redis } from "ioredis"
import { env } from "./env"

export const bullMqConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
})
