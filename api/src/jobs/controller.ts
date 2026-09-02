import { ControllerResult } from "@task/types"
import { CONTROLLER } from "../lib/constants"

export const urlCheckController = async (url: string): Promise<ControllerResult> => {
  const start = Date.now()

  const response = await fetch(url, {
    signal: AbortSignal.timeout(CONTROLLER.ABORT_TIMEOUT_MS),
    redirect: "follow",
  })

  const responseTime = Date.now() - start
  const statusCode = response.status

  let title: string | null = null
  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("text/html")) {
    const html = await response.text()
    const match = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    title = match ? match[1].trim() : null
  }

  return {
    httpStatusCode: statusCode,
    responseTimeMs: responseTime,
    title,
  }
}