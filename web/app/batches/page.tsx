import { getBatches } from "@/lib/api"
import CreateBatch from "@/feature/health/components/CreateBatch"
import BatchesTable from "@/feature/health/components/BatchesTable"

export default async function BatchesPage() {
  const batches = await getBatches()

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Batches</h1>
        <p className="text-sm text-muted-foreground">
          Submit a list of URLs and track their check status.
        </p>
      </div>

      <CreateBatch />
      <BatchesTable batches={batches} />
    </div>
  )
}
