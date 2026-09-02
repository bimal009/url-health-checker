export function getDetailedErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return "Unknown error"

  if (err.name === "TimeoutError" || err.name === "AbortError") {
    return "Request timed out"
  }

  const parts: string[] = [err.message]

  let cause: unknown = (err as Error & { cause?: unknown }).cause
  const seen = new Set<unknown>([err])
  while (cause && !seen.has(cause)) {
    seen.add(cause)
    if (cause instanceof AggregateError && cause.errors.length > 0) {
      parts.push(cause.errors.map((e) => (e instanceof Error ? e.message : String(e))).join("; "))
      break
    }
    if (cause instanceof Error) {
      const code = (cause as Error & { code?: unknown }).code
      parts.push(code ? `${cause.message} (${String(code)})` : cause.message)
      cause = (cause as Error & { cause?: unknown }).cause
      continue
    }
    parts.push(String(cause))
    break
  }

  return parts.join(": ")
}
