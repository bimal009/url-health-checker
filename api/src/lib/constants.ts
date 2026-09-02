export const TTL = {
  SHORT: 30,
  MEDIUM: 60,
  LONG: 300,
}

export const KEYS = {
  RATE_LIMIT: "rate-limit",
  BATCHES: "batches",
}

export const RATE_LIMITER = {
  MAX_REQUESTS: 10,
  WINDOW_MS: 1000,
}

export const CONTROLLER = {
  ABORT_TIMEOUT_MS: 10000,
}

export const batchUpdateKey = (batchId: string) => `batch:${batchId}:updates`
