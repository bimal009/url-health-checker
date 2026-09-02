"use client"

import { useEffect, useState } from "react"
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
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (isTerminal(initialBatch.status)) return

    const source = new EventSource(
      `${process.env.NEXT_PUBLIC_API_URL}/batches/${initialBatch.id}/events`
    )
    source.onmessage = (event) => {
      const next = JSON.parse(event.data) as BatchWithUrls
      setBatch(next)
      if (isTerminal(next.status)) source.close()
    }

    return () => source.close()
  }, [initialBatch.id, initialBatch.status])

  const terminal = isTerminal(batch.status)
  const progress = batch.totalUrls ? (batch.completedCount / batch.totalUrls) * 100 : 0

  async function onCancel() {
    setCancelling(true)
    setActionError(null)
    try {
      await cancelBatch(batch.id)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to cancel batch")
    } finally {
      setCancelling(false)
    }
  }

  async function onRetry() {
    setRetrying(true)
    setActionError(null)
    try {
      await retryFailed(batch.id)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to retry")
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
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

      {actionError && <p className="mb-4 text-sm text-destructive">{actionError}</p>}

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
                <TableHead>Title</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batch.urls.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.url}</TableCell>
                  <TableCell>
                    <Badge className={statusColor[row.status]} variant="secondary">
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.httpStatusCode ?? "—"}</TableCell>
                  <TableCell>
                    {row.responseTimeMs != null ? `${row.responseTimeMs} ms` : "—"}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {row.title ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-destructive">
                    {row.errorMessage ?? ""}
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
