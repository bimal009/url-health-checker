import { KEYS, RATE_LIMITER } from "./constants"
import { RedisInstance } from "../plugins/redis"
const RATE_LIMIT = RATE_LIMITER.MAX_REQUESTS
const WINDOW_MS = RATE_LIMITER.WINDOW_MS
const KEY = KEYS.RATE_LIMIT

const RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowStart = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])

redis.call('ZREMRANGEBYSCORE', key, 0, windowStart)

local count = redis.call('ZCARD', key)

if count < limit then
  redis.call('ZADD', key, now, now .. '-' .. math.random())
  redis.call('PEXPIRE', key, 2000)
  return 1
else
  return 0
end
`

export async function checkRateLimit(redis: RedisInstance): Promise<boolean> {
  const now = Date.now()
  const windowStart = now - WINDOW_MS

  const result = await redis.eval(
    RATE_LIMIT_SCRIPT,
    1,
    KEY,
    now.toString(),
    windowStart.toString(),
    RATE_LIMIT.toString()
  )

  return result === 1
}