"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { useParams } from "next/navigation"
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  FileText,
  Hash,
  MapPin,
  RefreshCw,
  Store,
  Tag,
} from "lucide-react"
import { Link } from "@/i18n/navigation"

type DocumentDetail = {
  id: string
  source: string
  status: string
  fileUrl: string
  fileType: string
  fileSizeBytes: number
  thumbnailUrl: string | null
  createdAt: string
}

type ExtractedData = {
  id: string
  vendorName: string | null
  vendorAddress: string | null
  documentDate: string | null
  documentType: string | null
  documentNumber: string | null
  totalAmount: number | null
  totalTax: number | null
  currency: string | null
  lineItems: Array<{
    description: string
    quantity: number
    unitPrice: number
    total: number
    tax: number
  }> | null
  rawOcrText: string | null
  confidenceScore: number | null
  extractionModel: string | null
}

export default function DocumentDetailPage() {
  const t = useTranslations("documents")
  const tCommon = useTranslations("common")
  const params = useParams()
  const documentId = params.id as string

  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  const [extracted, setExtracted] = useState<ExtractedData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isReextracting, setIsReextracting] = useState(false)

  const fetchDocument = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}`)
      if (!res.ok) return
      const data = await res.json()
      setDoc(data.document)
      setExtracted(data.extractedData)
    } catch (err) {
      console.error("Failed to fetch document:", err)
    } finally {
      setIsLoading(false)
    }
  }, [documentId])

  useEffect(() => {
    fetchDocument()
  }, [fetchDocument])

  const handleReextract = useCallback(async () => {
    setIsReextracting(true)
    try {
      await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reextract: true }),
      })
      // Poll for completion
      const poll = setInterval(async () => {
        const res = await fetch(`/api/documents/${documentId}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.document.status === "ready" || data.document.status === "pending") {
          if (data.document.status === "ready") {
            setDoc(data.document)
            setExtracted(data.extractedData)
            clearInterval(poll)
            setIsReextracting(false)
          }
        }
      }, 3000)
      // Stop polling after 60s
      setTimeout(() => {
        clearInterval(poll)
        setIsReextracting(false)
        fetchDocument()
      }, 60000)
    } catch (err) {
      console.error("Re-extraction failed:", err)
      setIsReextracting(false)
    }
  }, [documentId, fetchDocument])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Document not found
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/documents"
            className="rounded-md p-1.5 hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <StatusBadge status={doc.status} />
        </div>
        <button
          onClick={handleReextract}
          disabled={isReextracting}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${isReextracting ? "animate-spin" : ""}`}
          />
          Re-extract
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Document Preview */}
        <div className="overflow-hidden rounded-lg border">
          {doc.thumbnailUrl ? (
            <img
              src={`/api/documents/${doc.id}/file?type=thumbnail`}
              alt="Document preview"
              className="w-full object-contain"
            />
          ) : (
            <div className="flex h-64 items-center justify-center bg-muted/50">
              <FileText className="h-16 w-16 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Extracted Data */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Extraction Results</h2>

          {!extracted ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              {doc.status === "processing" || doc.status === "pending"
                ? "Extraction in progress..."
                : "No extraction data available"}
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid gap-3 sm:grid-cols-2">
                <DataField
                  icon={<Store className="h-4 w-4" />}
                  label="Vendor"
                  value={extracted.vendorName}
                />
                <DataField
                  icon={<DollarSign className="h-4 w-4" />}
                  label="Total Amount"
                  value={
                    extracted.totalAmount != null
                      ? `${extracted.currency || ""} ${extracted.totalAmount}`
                      : null
                  }
                  highlight
                />
                <DataField
                  icon={<Calendar className="h-4 w-4" />}
                  label="Date"
                  value={extracted.documentDate}
                />
                <DataField
                  icon={<Tag className="h-4 w-4" />}
                  label="Type"
                  value={extracted.documentType}
                />
                <DataField
                  icon={<Hash className="h-4 w-4" />}
                  label="Document #"
                  value={extracted.documentNumber}
                />
                <DataField
                  icon={<DollarSign className="h-4 w-4" />}
                  label="Tax (VAT)"
                  value={
                    extracted.totalTax != null
                      ? `${extracted.currency || ""} ${extracted.totalTax}`
                      : null
                  }
                />
                <DataField
                  icon={<MapPin className="h-4 w-4" />}
                  label="Address"
                  value={extracted.vendorAddress}
                />
                <DataField
                  icon={<Tag className="h-4 w-4" />}
                  label="Confidence"
                  value={
                    extracted.confidenceScore != null
                      ? `${Math.round(extracted.confidenceScore * 100)}%`
                      : null
                  }
                />
              </div>

              {/* Line Items */}
              {extracted.lineItems && extracted.lineItems.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Line Items</h3>
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-start font-medium">
                            Description
                          </th>
                          <th className="px-3 py-2 text-end font-medium">
                            Qty
                          </th>
                          <th className="px-3 py-2 text-end font-medium">
                            Price
                          </th>
                          <th className="px-3 py-2 text-end font-medium">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {extracted.lineItems.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2">
                              {item.description}
                            </td>
                            <td className="px-3 py-2 text-end">
                              {item.quantity}
                            </td>
                            <td className="px-3 py-2 text-end">
                              {item.unitPrice}
                            </td>
                            <td className="px-3 py-2 text-end font-medium">
                              {item.total}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Raw OCR Text */}
              {extracted.rawOcrText && (
                <details className="rounded-lg border">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-medium hover:bg-muted/50">
                    Raw OCR Text
                  </summary>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t px-4 py-3 text-xs text-muted-foreground">
                    {extracted.rawOcrText}
                  </pre>
                </details>
              )}

              {/* Metadata */}
              <div className="rounded-lg border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                <p>Model: {extracted.extractionModel || "—"}</p>
                <p>Source: {doc.source}</p>
                <p>
                  File: {doc.fileType} ({Math.round(doc.fileSizeBytes / 1024)} KB)
                </p>
                <p>
                  Uploaded: {new Date(doc.createdAt).toLocaleString()}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function DataField({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  value: string | null | undefined
  highlight?: boolean
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p
        className={`text-sm font-medium ${
          highlight ? "text-lg text-green-600" : ""
        } ${!value ? "text-muted-foreground" : ""}`}
      >
        {value || "—"}
      </p>
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
  }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        colors[status] || "bg-gray-100 text-gray-800"
      }`}
    >
      {status}
    </span>
  )
}
