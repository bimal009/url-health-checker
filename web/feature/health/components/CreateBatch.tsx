"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { UploadCloud, FileText, X } from "lucide-react"
import { createBatchSchema } from "@task/types"
import { parseUrls } from "../helpers/validation"

async function submitBatch(urls: string[]) {
  const result = createBatchSchema.safeParse({ urls })
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid submission" }
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/batches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(result.data),
  })

  if (!res.ok) return { error: "Failed to create batch" }

  const data = await res.json()
  return { batchId: data.batchId as string }
}

export default function CreateBatch() {
  const router = useRouter()
  const [pastedUrls, setPastedUrls] = useState("")
  const [pasteUrls, setPasteUrls] = useState<string[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [csvUrls, setCsvUrls] = useState<string[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function loadCsvFile(selected: File | null) {
    setFile(selected)
    if (selected) {
      const text = await selected.text()
      setCsvUrls(parseUrls(text))
    } else {
      setCsvUrls([])
    }
  }

  async function handleCreateBatch(urls: string[], onSuccess: () => void) {
    const result = await submitBatch(urls)
    if (result.error) {
      setError(result.error)
      return
    }
    setError(null)
    onSuccess()
    router.push(`/batches/${result.batchId}`)
  }

  return (
    <div>
      <div className="mb-8 grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Paste URLs</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder={"https://example.com\nhttps://another-site.com"}
              rows={6}
              value={pastedUrls}
              onChange={(e) => {
                const text = e.target.value
                setPastedUrls(text)
                setPasteUrls(parseUrls(text))
              }}
            />
            <p className="mt-2 text-xs text-muted-foreground">{pasteUrls.length} URLs</p>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              onClick={() =>
                handleCreateBatch(pasteUrls, () => {
                  setPastedUrls("")
                  setPasteUrls([])
                })
              }
              disabled={pasteUrls.length === 0}
            >
              Create batch
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Upload CSV</CardTitle>
          </CardHeader>
          <CardContent>
            {file ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm">{file.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {csvUrls.length} URLs
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => loadCsvFile(null)}
                  className="shrink-0 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragActive(true)
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragActive(false)
                  loadCsvFile(e.dataTransfer.files?.[0] ?? null)
                }}
                className={`flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-8 text-center transition-colors ${
                  dragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/30 hover:border-muted-foreground/50"
                }`}
              >
                <UploadCloud className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm">Click to upload, or drag and drop</span>
                <span className="text-xs text-muted-foreground">.csv file</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => loadCsvFile(e.target.files?.[0] ?? null)}
            />
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              onClick={() =>
                handleCreateBatch(csvUrls, () => {
                  setFile(null)
                  setCsvUrls([])
                  if (fileInputRef.current) fileInputRef.current.value = ""
                })
              }
              disabled={csvUrls.length === 0}
            >
              Upload batch
            </Button>
          </CardFooter>
        </Card>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
    </div>
  )
}
