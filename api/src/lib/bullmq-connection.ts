import { Redis } from "ioredis"
import "dotenv/config"


export const bullMqConnection = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
})