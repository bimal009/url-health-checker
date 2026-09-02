import { submittedUrlSchema } from "@task/types"

export function parseUrls(raw: string): string[] {
  return raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)
}

export function findInvalidUrls(urls: string[]): string[] {
  return urls.filter((url) => !submittedUrlSchema.safeParse(url).success)
}