import type { BatchStatus } from "@task/types"

export const statusColor: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  processing: "bg-blue-100 text-blue-700",
  running: "bg-blue-100 text-blue-700",
  success: "bg-green-100 text-green-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-red-100 text-red-700",
}

export function isTerminal(status: BatchStatus): boolean {
  return status === "completed" || status === "cancelled"
}
