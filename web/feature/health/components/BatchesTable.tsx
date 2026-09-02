import Link from "next/link"
import type { BatchRow } from "@task/types"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Inbox } from "lucide-react"
import { statusColor } from "../helpers/status"

export default function BatchesTable({ batches }: { batches: BatchRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Recent batches {batches.length > 0 && <span className="text-muted-foreground">({batches.length})</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {batches.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No batches yet</p>
            <p className="text-sm text-muted-foreground">Create one above to start checking URLs.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Success</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead>Total URLs</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((batch) => (
                <TableRow key={batch.id}>
                  <TableCell>
                    <Link
                      href={`/batches/${batch.id}`}
                      className="font-mono text-sm font-medium hover:underline"
                      title={batch.id}
                    >
                      {batch.id.slice(0, 8)}…
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColor[batch.status]} variant="secondary">
                      {batch.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="w-44">
                    <div className="flex items-center gap-2">
                      <Progress
                        value={batch.totalUrls ? (batch.completedCount / batch.totalUrls) * 100 : 0}
                        className="h-2"
                      />
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {batch.completedCount}/{batch.totalUrls}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums text-emerald-600">
                    {batch.successCount}
                  </TableCell>
                  <TableCell className="tabular-nums text-destructive">
                    {batch.failedCount}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {batch.totalUrls}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(batch.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}