import type {
  BatchRow,
  CancelBatchResponse,
  RetryBatchResponse,
  UrlRow,
} from "@task/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL

export type BatchWithUrls = BatchRow & { urls: UrlRow[] }

export async function getBatches(): Promise<BatchRow[]> {
  try {
    const res = await fetch(`${API_URL}/batches`, { next: { revalidate: 30 } })
    if (!res.ok) throw new Error(`Failed to fetch batches (${res.status})`)
    return await res.json()
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : "Failed to fetch batches"
    )
  }
}

export async function getBatch(id: string): Promise<BatchWithUrls> {
  try {
    const res = await fetch(`${API_URL}/batches/${id}`, { cache: "no-store" })
    if (!res.ok) throw new Error(`Failed to fetch batch (${res.status})`)
    return await res.json()
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : "Failed to fetch batch"
    )
  }
}

export async function cancelBatch(id: string): Promise<CancelBatchResponse> {
  try {
    const res = await fetch(`${API_URL}/batches/${id}/cancel`, { method: "POST" })
    if (!res.ok) throw new Error(`Failed to cancel batch (${res.status})`)
    return await res.json()
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : "Failed to cancel batch"
    )
  }
}

export async function retryFailed(id: string): Promise<RetryBatchResponse> {
  try {
    const res = await fetch(`${API_URL}/batches/${id}/retry`, { method: "POST" })
    if (!res.ok) throw new Error(`Failed to retry (${res.status})`)
    return await res.json()
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : "Failed to retry"
    )
  }
}