import Redis from "ioredis"
import { env } from "./env"

export const redis = new Redis(env.REDIS_URL)

export function createSubscriber() {
  const subscriber = new Redis(env.REDIS_URL)
  subscriber.on("error", (err) => {
    console.error("[redis subscriber] error:", err.message)
  })
  return subscriber
}
