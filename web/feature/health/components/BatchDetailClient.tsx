"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cancelBatch, retryFailed, type BatchWithUrls } from "@/lib/api"
import { isTerminal, statusColor } from "../helpers/status"

export default function BatchDetailClient({ initialBatch }: { initialBatch: BatchWithUrls }) {
  const [batch, setBatch] = useState(initialBatch)
  const [cancelling, setCancelling] = useState(false)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    if (isTerminal(initialBatch.status)) return

    const source = new EventSource(
      `${process.env.NEXT_PUBLIC_API_URL}/batches/${initialBatch.id}/events`
    )
    source.onmessage = (event) => {
      try {
        const next = JSON.parse(event.data) as BatchWithUrls
        setBatch(next)
        if (isTerminal(next.status)) source.close()
      } catch {
        toast.error("Received a malformed update from the server")
      }
    }
    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) {
        toast.error("Live updates disconnected. Refresh to reconnect.")
      }
    }

    return () => source.close()
  }, [initialBatch.id, initialBatch.status])

  const terminal = isTerminal(batch.status)
  const progress = batch.totalUrls ? (batch.completedCount / batch.totalUrls) * 100 : 0

  async function onCancel() {
    setCancelling(true)
    try {
      await cancelBatch(batch.id)
      toast.success("Batch cancelled")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel batch")
    } finally {
      setCancelling(false)
    }
  }

  async function onRetry() {
    setRetrying(true)
    try {
      await retryFailed(batch.id)
      toast.success("Retrying failed URLs")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to retry failed URLs")
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Batch {batch.id}</h1>
          <div className="mt-2">
            <Badge className={statusColor[batch.status]} variant="secondary">
              {batch.status}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} disabled={terminal || cancelling}>
            {cancelling ? "Cancelling..." : "Cancel batch"}
          </Button>
          <Button
            variant="outline"
            onClick={onRetry}
            disabled={batch.failedCount === 0 || retrying}
          >
            {retrying ? "Retrying..." : "Retry failed"}
          </Button>
        </div>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Progress value={progress} className="h-2" />
            <span className="text-sm text-muted-foreground">
              {batch.completedCount}/{batch.totalUrls}
            </span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {batch.successCount} success · {batch.failedCount} failed
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">URLs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>URL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>HTTP</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batch.urls.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-md break-all font-medium">{row.url}</TableCell>
                  <TableCell>
                    <Badge className={statusColor[row.status]} variant="secondary">
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.httpStatusCode ?? "—"}</TableCell>
                  <TableCell>
                    {row.responseTimeMs != null ? `${row.responseTimeMs} ms` : "—"}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {row.attemptCount > 0 ? row.attemptCount : "—"}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground" title={row.title ?? undefined}>
                    {row.title ?? "—"}
                  </TableCell>
                  <TableCell
                    className="min-w-[16rem] max-w-lg whitespace-normal wrap-break-word text-destructive"
                    title={row.errorMessage ?? undefined}
                  >
                    {row.errorMessage ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
