import { getBatches } from "@/lib/api"
import CreateBatch from "@/feature/health/components/CreateBatch"
import BatchesTable from "@/feature/health/components/BatchesTable"

export default async function BatchesPage() {
  const batches = await getBatches()

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-8 border-b pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">URL Health Checker</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit a batch of URLs to check their status, response time, and page title.
        </p>
      </div>

      <div className="mb-10">
        <CreateBatch />
      </div>

      <BatchesTable batches={batches} />
    </div>
  )
}