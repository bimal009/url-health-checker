import type {
  BatchRow,
  CancelBatchResponse,
  RetryBatchResponse,
  UrlRow,
} from "@task/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL

export type BatchWithUrls = BatchRow & { urls: UrlRow[] }

export async function getBatches(): Promise<BatchRow[]> {
  const res = await fetch(`${API_URL}/batches`, { next: { revalidate: 30 } })
  if (!res.ok) throw new Error("Failed to fetch batches")
  return res.json()
}

export async function getBatch(id: string): Promise<BatchWithUrls> {
  const res = await fetch(`${API_URL}/batches/${id}`, { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to fetch batch")
  return res.json()
}

export async function cancelBatch(id: string): Promise<CancelBatchResponse> {
  const res = await fetch(`${API_URL}/batches/${id}/cancel`, { method: "POST" })
  if (!res.ok) throw new Error("Failed to cancel batch")
  return res.json()
}

export async function retryFailed(id: string): Promise<RetryBatchResponse> {
  const res = await fetch(`${API_URL}/batches/${id}/retry`, { method: "POST" })
  if (!res.ok) throw new Error("Failed to retry")
  return res.json()
}
