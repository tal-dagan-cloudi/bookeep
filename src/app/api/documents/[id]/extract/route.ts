import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"

import { extractDocument } from "@/lib/extraction"
import { db } from "@/server/db"
import { documents, extractedData } from "@/server/db/schema"

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const doc = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1)

  if (doc.length === 0) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  const document = doc[0]

  // Update status to processing
  await db
    .update(documents)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(documents.id, id))

  try {
    const result = await extractDocument(document.fileUrl, document.fileType)

    // Upsert extracted data
    const existing = await db
      .select()
      .from(extractedData)
      .where(eq(extractedData.documentId, id))
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(extractedData)
        .set({
          vendorName: result.vendorName,
          vendorAddress: result.vendorAddress,
          documentDate: result.documentDate
            ? new Date(result.documentDate)
            : null,
          documentType: result.documentType,
          documentNumber: result.documentNumber,
          totalAmount: result.totalAmount,
          totalTax: result.totalTax,
          currency: result.currency,
          lineItems: result.lineItems,
          rawOcrText: result.rawOcrText,
          confidenceScore: result.confidenceScore,
          extractionModel: "claude-sonnet-4-20250514",
          updatedAt: new Date(),
        })
        .where(eq(extractedData.documentId, id))
    } else {
      await db.insert(extractedData).values({
        documentId: id,
        vendorName: result.vendorName,
        vendorAddress: result.vendorAddress,
        documentDate: result.documentDate
          ? new Date(result.documentDate)
          : null,
        documentType: result.documentType,
        documentNumber: result.documentNumber,
        totalAmount: result.totalAmount,
        totalTax: result.totalTax,
        currency: result.currency,
        lineItems: result.lineItems,
        rawOcrText: result.rawOcrText,
        confidenceScore: result.confidenceScore,
        extractionModel: "claude-sonnet-4-20250514",
      })
    }

    // Update document status to ready
    await db
      .update(documents)
      .set({ status: "ready", updatedAt: new Date() })
      .where(eq(documents.id, id))

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    // Revert status on failure
    await db
      .update(documents)
      .set({ status: "pending", updatedAt: new Date() })
      .where(eq(documents.id, id))

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Extraction failed",
      },
      { status: 500 }
    )
  }
}
