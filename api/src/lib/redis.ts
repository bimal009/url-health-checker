import Redis from "ioredis"

export const redis = new Redis(process.env.REDIS_URL!)

export function createSubscriber() {
  return new Redis(process.env.REDIS_URL!)
}