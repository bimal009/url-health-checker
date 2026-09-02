import { getBatch } from "@/lib/api"
import BatchDetailClient from "@/feature/health/components/BatchDetailClient"

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const batch = await getBatch(id)

  return <BatchDetailClient initialBatch={batch} />
}
