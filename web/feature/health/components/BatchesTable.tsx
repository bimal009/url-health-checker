import Link from "next/link"
import type { BatchRow } from "@task/types"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { statusColor } from "../helpers/status"

export default function BatchesTable({ batches }: { batches: BatchRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Recent batches</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Batch</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.map((batch) => (
              <TableRow key={batch.id}>
                <TableCell>
                  <Link href={`/batches/${batch.id}`} className="font-medium hover:underline">
                    {batch.id}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge className={statusColor[batch.status]} variant="secondary">
                    {batch.status}
                  </Badge>
                </TableCell>
                <TableCell className="w-48">
                  <div className="flex items-center gap-2">
                    <Progress
                      value={batch.totalUrls ? (batch.completedCount / batch.totalUrls) * 100 : 0}
                      className="h-2"
                    />
                    <span className="text-xs text-muted-foreground">
                      {batch.completedCount}/{batch.totalUrls}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(batch.createdAt).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
