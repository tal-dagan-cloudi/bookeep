"use client"

import { useTranslations } from "next-intl"
import { FileText, Loader2 } from "lucide-react"

import { type DocumentItem } from "@/types/document"

type Props = {
  documents: DocumentItem[]
  onSelect: (doc: DocumentItem) => void
}

export function DocumentGallery({ documents, onSelect }: Props) {
  const t = useTranslations("documents")

  if (documents.length === 0) {
    return null
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {documents.map((doc) => (
        <button
          key={doc.id}
          onClick={() => onSelect(doc)}
          className="group relative flex flex-col overflow-hidden rounded-lg border bg-background transition-shadow hover:shadow-md"
        >
          {/* Thumbnail */}
          <div className="relative aspect-[4/3] bg-muted">
            {doc.thumbnailUrl ? (
              <img
                src={`/api/documents/${doc.id}/file?thumbnail=true`}
                alt={doc.vendorName || "Document"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <FileText className="h-12 w-12 text-muted-foreground/50" />
              </div>
            )}
            <StatusBadge status={doc.status} />
          </div>

          {/* Info */}
          <div className="p-3 text-start">
            <p className="truncate text-sm font-medium">
              {doc.vendorName || "Unknown vendor"}
            </p>
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {doc.totalAmount != null
                  ? `${doc.currency || "$"} ${doc.totalAmount.toFixed(2)}`
                  : "—"}
              </span>
              <span>
                {doc.documentDate
                  ? new Date(doc.documentDate).toLocaleDateString()
                  : doc.createdAt
                    ? new Date(doc.createdAt).toLocaleDateString()
                    : ""}
              </span>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    processing: "bg-blue-100 text-blue-800",
    ready: "bg-green-100 text-green-800",
    reviewed: "bg-purple-100 text-purple-800",
    exported: "bg-gray-100 text-gray-800",
    trash: "bg-red-100 text-red-800",
  }

  return (
    <span
      className={`absolute end-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-800"}`}
    >
      {status === "processing" ? (
        <Loader2 className="inline h-3 w-3 animate-spin" />
      ) : (
        status
      )}
    </span>
  )
}
