import { RedisInstance } from "../plugins/redis"
import { KEYS } from "./constants"

export const batchListKey = `${KEYS.BATCHES}:list`

export async function invalidateBatchList(redis: RedisInstance) {
  try {
    await redis.del(batchListKey)
  } catch (err) {
    console.error("Failed to invalidate batch list cache:", err)
  }
}
