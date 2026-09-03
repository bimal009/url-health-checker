"use client"

import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"

export default function BatchError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const notFound = error.message === "Batch not found"

  return (
    <div className="mx-auto max-w-2xl px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold">
        {notFound ? "Batch not found" : "Couldn't load this batch"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {notFound
          ? "This batch doesn't exist, or it may have been removed."
          : error.message}
      </p>
      <div className="mt-6 flex justify-center gap-2">
        {!notFound && (
          <Button variant="outline" onClick={() => retry()}>
            Try again
          </Button>
        )}
        <Link href="/batches" className={buttonVariants({ variant: notFound ? "outline" : "ghost" })}>
          Back to batches
        </Link>
      </div>
    </div>
  )
}
