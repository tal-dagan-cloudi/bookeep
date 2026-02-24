"use client"

import { useCallback, useState } from "react"
import { useTranslations } from "next-intl"
import { FileUp, Loader2, X } from "lucide-react"

type UploadResult = {
  id: string
  name: string
  status: string
  fileType: string
  fileSizeBytes: number
}

type Props = {
  onUploadComplete: (docs: UploadResult[]) => void
}

export function UploadZone({ onUploadComplete }: Props) {
  const t = useTranslations("documents")
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string[]>([])

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files)
      if (fileArray.length === 0) return

      setIsUploading(true)
      setUploadProgress(fileArray.map((f) => f.name))

      const formData = new FormData()
      for (const file of fileArray) {
        formData.append("files", file)
      }

      try {
        const res = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        })

        if (!res.ok) {
          throw new Error("Upload failed")
        }

        const data = await res.json()

        // Trigger extraction for each uploaded document
        const uploaded = data.documents as UploadResult[]
        for (const doc of uploaded) {
          if (doc.id) {
            fetch(`/api/documents/${doc.id}/extract`, {
              method: "POST",
            }).catch(() => {
              // Non-blocking extraction
            })
          }
        }

        onUploadComplete(uploaded)
      } catch (error) {
        console.error("Upload error:", error)
      } finally {
        setIsUploading(false)
        setUploadProgress([])
      }
    },
    [onUploadComplete]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleClick = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.multiple = true
    input.accept = ".pdf,.jpg,.jpeg,.png,.webp,.heic"
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files
      if (files) handleFiles(files)
    }
    input.click()
  }, [handleFiles])

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-muted/50"
      }`}
    >
      {isUploading ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Uploading {uploadProgress.length} file(s)...
          </p>
          <div className="flex flex-wrap gap-1">
            {uploadProgress.map((name) => (
              <span
                key={name}
                className="rounded bg-muted px-2 py-0.5 text-xs"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <>
          <FileUp className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">{t("dragDrop")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("supportedFormats")}
          </p>
        </>
      )}
    </div>
  )
}
