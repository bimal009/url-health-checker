import Redis from "ioredis"

export const redis = new Redis(process.env.REDIS_URL!)

export function createSubscriber() {
  const subscriber = new Redis(process.env.REDIS_URL!)
  subscriber.on("error", (err) => {
    console.error("[redis subscriber] error:", err.message)
  })
  return subscriber
}