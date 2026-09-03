import type {
  BatchRow,
  BatchWithUrls,
  CancelBatchResponse,
  RetryBatchResponse,
} from "@task/types"

const API = process.env.NEXT_PUBLIC_API_URL

export type { BatchWithUrls }

export async function getBatches(): Promise<BatchRow[]> {
  const res = await fetch(`${API}/batches`, { cache: "no-store" })
  if (!res.ok) throw new Error("Couldn't load batches")
  return res.json()
}

export async function getBatch(id: string): Promise<BatchWithUrls> {
  const res = await fetch(`${API}/batches/${id}`, { cache: "no-store" })
  if (res.status === 404) throw new Error("Batch not found")
  if (!res.ok) throw new Error("Couldn't load batch")
  return res.json()
}

export async function cancelBatch(id: string): Promise<CancelBatchResponse> {
  const res = await fetch(`${API}/batches/${id}/cancel`, { method: "POST" })
  if (res.status === 409) throw new Error("This batch can't be cancelled anymore")
  if (!res.ok) throw new Error("Couldn't cancel the batch")
  return res.json()
}

export async function retryFailed(id: string): Promise<RetryBatchResponse> {
  const res = await fetch(`${API}/batches/${id}/retry`, { method: "POST" })
  if (!res.ok) throw new Error("Couldn't retry the failed URLs")
  return res.json()
}
