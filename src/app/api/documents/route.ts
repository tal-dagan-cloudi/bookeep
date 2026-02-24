import { NextRequest, NextResponse } from "next/server"
import { and, desc, eq, sql } from "drizzle-orm"

import { getAuthContext } from "@/lib/api-auth"
import { db } from "@/server/db"
import {
  documents,
  extractedData,
} from "@/server/db/schema"

export async function GET(req: NextRequest) {
  const authResult = await getAuthContext()
  if (!authResult.success) return authResult.response

  const { orgId } = authResult.context

  const searchParams = req.nextUrl.searchParams
  const status = searchParams.get("status")
  const search = searchParams.get("search")
  const page = parseInt(searchParams.get("page") || "1", 10)
  const limit = parseInt(searchParams.get("limit") || "20", 10)
  const offset = (page - 1) * limit

  const conditions = [eq(documents.orgId, orgId)]

  if (status && status !== "all") {
    conditions.push(
      eq(
        documents.status,
        status as
          | "pending"
          | "processing"
          | "ready"
          | "reviewed"
          | "exported"
          | "trash"
      )
    )
  }

  const docs = await db
    .select({
      id: documents.id,
      source: documents.source,
      status: documents.status,
      fileUrl: documents.fileUrl,
      fileType: documents.fileType,
      fileSizeBytes: documents.fileSizeBytes,
      thumbnailUrl: documents.thumbnailUrl,
      createdAt: documents.createdAt,
      vendorName: extractedData.vendorName,
      totalAmount: extractedData.totalAmount,
      currency: extractedData.currency,
      documentDate: extractedData.documentDate,
      documentType: extractedData.documentType,
    })
    .from(documents)
    .leftJoin(extractedData, eq(documents.id, extractedData.documentId))
    .where(and(...conditions))
    .orderBy(desc(documents.createdAt))
    .limit(limit)
    .offset(offset)

  // Filter by search in application layer if needed
  const filtered = search
    ? docs.filter(
        (d) =>
          d.vendorName?.toLowerCase().includes(search.toLowerCase()) ?? false
      )
    : docs

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(documents)
    .where(and(...conditions))

  return NextResponse.json({
    documents: filtered,
    meta: {
      total: Number(countResult.count),
      page,
      limit,
    },
  })
}
