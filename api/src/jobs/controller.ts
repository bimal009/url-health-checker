import { ControllerResult } from "@task/types"
import { CONTROLLER } from "../lib/constants"

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

export const urlCheckController = async (url: string): Promise<ControllerResult> => {
  const start = Date.now()

  const response = await fetch(url, {
    signal: AbortSignal.timeout(CONTROLLER.ABORT_TIMEOUT_MS),
    redirect: "follow",
    headers: REQUEST_HEADERS,
  })

  const responseTimeMs = Date.now() - start
  const httpStatusCode = response.status

  let title: string | null = null
  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("text/html")) {
    try {
      const html = await response.text()
      const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
      title = match ? match[1].replace(/\s+/g, " ").trim().slice(0, 500) || null : null
    } catch {
      title = null
    }
  } else {
    await response.body?.cancel().catch(() => {})
  }

  return { httpStatusCode, responseTimeMs, title }
}
