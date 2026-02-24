"use client"

import { useTranslations } from "next-intl"
import { FileText, Loader2 } from "lucide-react"

import { type DocumentItem } from "@/types/document"

type Props = {
  documents: DocumentItem[]
  onSelect: (doc: DocumentItem) => void
}

export function DocumentTable({ documents, onSelect }: Props) {
  const t = useTranslations("documents")

  if (documents.length === 0) {
    return null
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-start font-medium text-muted-foreground">
              Vendor
            </th>
            <th className="px-4 py-3 text-start font-medium text-muted-foreground">
              Amount
            </th>
            <th className="px-4 py-3 text-start font-medium text-muted-foreground">
              Date
            </th>
            <th className="px-4 py-3 text-start font-medium text-muted-foreground">
              Type
            </th>
            <th className="px-4 py-3 text-start font-medium text-muted-foreground">
              Status
            </th>
            <th className="px-4 py-3 text-start font-medium text-muted-foreground">
              Source
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {documents.map((doc) => (
            <tr
              key={doc.id}
              onClick={() => onSelect(doc)}
              className="cursor-pointer transition-colors hover:bg-muted/50"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {doc.vendorName || "Unknown"}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                {doc.totalAmount != null
                  ? `${doc.currency || "USD"} ${doc.totalAmount.toFixed(2)}`
                  : "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {doc.documentDate
                  ? new Date(doc.documentDate).toLocaleDateString()
                  : "—"}
              </td>
              <td className="px-4 py-3 capitalize text-muted-foreground">
                {doc.documentType || "—"}
              </td>
              <td className="px-4 py-3">
                <StatusPill status={doc.status} />
              </td>
              <td className="px-4 py-3 capitalize text-muted-foreground">
                {doc.source}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
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
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-800"}`}
    >
      {status === "processing" && (
        <Loader2 className="h-3 w-3 animate-spin" />
      )}
      {status}
    </span>
  )
}
