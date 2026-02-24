"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Grid3X3, List, Search } from "lucide-react"

import { type DocumentItem } from "@/types/document"
import { DocumentGallery } from "@/components/document-gallery"
import { DocumentTable } from "@/components/document-table"
import { UploadZone } from "@/components/upload-zone"

type ViewMode = "gallery" | "table"
type StatusFilter = "all" | "pending" | "processing" | "ready" | "reviewed" | "exported" | "trash"

export default function DocumentsPage() {
  const t = useTranslations("documents")
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>("gallery")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (searchQuery) params.set("search", searchQuery)

      const res = await fetch(`/api/documents?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to fetch documents")

      const data = await res.json()
      setDocuments(data.documents)
    } catch (error) {
      console.error("Failed to fetch documents:", error)
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter, searchQuery])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleUploadComplete = useCallback(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleSelect = useCallback((doc: DocumentItem) => {
    // TODO: Open document detail panel
    console.info("Selected document:", doc.id)
  }, [])

  const statuses: StatusFilter[] = [
    "all",
    "pending",
    "processing",
    "ready",
    "reviewed",
    "exported",
    "trash",
  ]

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      {/* Upload Zone */}
      <UploadZone onUploadComplete={handleUploadComplete} />

      {/* Filters & Controls */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border bg-background py-2 ps-10 pe-4 text-sm outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Status Filter */}
        <div className="flex gap-1 overflow-x-auto">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {s === "all" ? t("allStatuses") : s}
            </button>
          ))}
        </div>

        {/* View Toggle */}
        <div className="flex rounded-md border">
          <button
            onClick={() => setViewMode("gallery")}
            className={`p-2 ${
              viewMode === "gallery"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`p-2 ${
              viewMode === "table"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Document List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <p className="text-lg font-medium text-muted-foreground">
            {t("noDocuments")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("uploadFirst")}
          </p>
        </div>
      ) : viewMode === "gallery" ? (
        <DocumentGallery documents={documents} onSelect={handleSelect} />
      ) : (
        <DocumentTable documents={documents} onSelect={handleSelect} />
      )}
    </div>
  )
}
