import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { and, desc, eq, ilike, sql } from "drizzle-orm"

import { db } from "@/server/db"
import {
  documentCategorization,
  documents,
  extractedData,
  orgMembers,
  users,
} from "@/server/db/schema"

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1)

  if (user.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const membership = await db
    .select()
    .from(orgMembers)
    .where(eq(orgMembers.userId, user[0].id))
    .limit(1)

  const orgId = membership.length > 0 ? membership[0].orgId : user[0].id

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
