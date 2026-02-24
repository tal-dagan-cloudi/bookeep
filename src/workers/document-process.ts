import { eq } from "drizzle-orm"

import { extractDocument } from "@/lib/extraction"
import { db } from "@/server/db"
import { documents, extractedData } from "@/server/db/schema"
import { createDocumentProcessWorker, type DocumentProcessJobData } from "@/lib/queue"
import type { Job } from "bullmq"

async function processDocument(job: Job<DocumentProcessJobData>) {
  const { documentId } = job.data

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1)

  if (!doc) {
    throw new Error(`Document ${documentId} not found`)
  }

  // Mark as processing
  await db
    .update(documents)
    .set({ status: "processing" })
    .where(eq(documents.id, documentId))

  try {
    const result = await extractDocument(doc.fileUrl, doc.fileType)

    const extractionValues = {
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
      extractionModel: "minimax-m2.5",
    }

    // Upsert extraction data
    const existing = await db
      .select({ id: extractedData.id })
      .from(extractedData)
      .where(eq(extractedData.documentId, documentId))
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(extractedData)
        .set(extractionValues)
        .where(eq(extractedData.documentId, documentId))
    } else {
      await db.insert(extractedData).values({
        documentId,
        ...extractionValues,
      })
    }

    // Mark as ready
    await db
      .update(documents)
      .set({ status: "ready" })
      .where(eq(documents.id, documentId))
  } catch (error) {
    console.error(`Document processing failed: ${documentId}`, error)
    // Reset to pending so it can be retried
    await db
      .update(documents)
      .set({ status: "pending" })
      .where(eq(documents.id, documentId))
    throw error
  }
}

export const documentProcessWorker = createDocumentProcessWorker(processDocument)

documentProcessWorker.on("completed", (job) => {
  console.info(`Document processed: ${job.id}`)
})

documentProcessWorker.on("failed", (job, err) => {
  console.error(`Document processing failed: ${job?.id}`, err)
})
