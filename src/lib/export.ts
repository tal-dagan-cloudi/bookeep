import { eq, inArray } from "drizzle-orm"

import { db } from "@/server/db"
import { documents, extractedData } from "@/server/db/schema"

type ExportDocument = {
  id: string
  vendorName: string | null
  totalAmount: number | null
  totalTax: number | null
  currency: string | null
  documentDate: Date | null
  documentType: string | null
  documentNumber: string | null
  source: string
  status: string
  createdAt: Date
}

async function fetchDocumentsForExport(
  documentIds: string[]
): Promise<ExportDocument[]> {
  const docs = await db
    .select({
      id: documents.id,
      source: documents.source,
      status: documents.status,
      createdAt: documents.createdAt,
      vendorName: extractedData.vendorName,
      totalAmount: extractedData.totalAmount,
      totalTax: extractedData.totalTax,
      currency: extractedData.currency,
      documentDate: extractedData.documentDate,
      documentType: extractedData.documentType,
      documentNumber: extractedData.documentNumber,
    })
    .from(documents)
    .leftJoin(extractedData, eq(documents.id, extractedData.documentId))
    .where(inArray(documents.id, documentIds))

  return docs
}

export async function exportToCsv(documentIds: string[]): Promise<string> {
  const docs = await fetchDocumentsForExport(documentIds)

  const headers = [
    "Vendor",
    "Amount",
    "Tax",
    "Currency",
    "Date",
    "Type",
    "Number",
    "Source",
    "Status",
    "Created",
  ]

  const rows = docs.map((d) => [
    csvEscape(d.vendorName || ""),
    d.totalAmount?.toString() || "",
    d.totalTax?.toString() || "",
    d.currency || "",
    d.documentDate ? d.documentDate.toISOString().split("T")[0] : "",
    d.documentType || "",
    csvEscape(d.documentNumber || ""),
    d.source,
    d.status,
    d.createdAt.toISOString().split("T")[0],
  ])

  const csvContent = [
    headers.join(","),
    ...rows.map((r) => r.join(",")),
  ].join("\n")

  return csvContent
}

export async function exportToJson(documentIds: string[]): Promise<string> {
  const docs = await fetchDocumentsForExport(documentIds)

  return JSON.stringify(
    docs.map((d) => ({
      vendor: d.vendorName,
      amount: d.totalAmount,
      tax: d.totalTax,
      currency: d.currency,
      date: d.documentDate
        ? d.documentDate.toISOString().split("T")[0]
        : null,
      type: d.documentType,
      number: d.documentNumber,
      source: d.source,
      status: d.status,
      created: d.createdAt.toISOString(),
    })),
    null,
    2
  )
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
