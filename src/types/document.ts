export type DocumentItem = {
  id: string
  source: string
  status: string
  fileUrl: string
  fileType: string
  fileSizeBytes: number | null
  thumbnailUrl: string | null
  createdAt: string | Date | null
  vendorName: string | null
  totalAmount: number | null
  currency: string | null
  documentDate: string | Date | null
  documentType: string | null
}
