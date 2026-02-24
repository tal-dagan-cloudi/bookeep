import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { exportToMorning } from "@/lib/accounting/morning"
import { db } from "@/server/db"
import { documents, extractedData } from "@/server/db/schema"
import type { AccountingExpense } from "@/lib/accounting/types"

const exportSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1),
  provider: z.enum(["morning", "quickbooks", "xero", "icount", "freshbooks"]),
  credentials: z.object({
    apiKey: z.string().optional(),
    apiSecret: z.string().optional(),
  }),
})

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const parsed = exportSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { documentIds, provider, credentials } = parsed.data
  const results = []

  for (const docId of documentIds) {
    const [extracted] = await db
      .select()
      .from(extractedData)
      .where(eq(extractedData.documentId, docId))
      .limit(1)

    if (!extracted) {
      results.push({ documentId: docId, success: false, error: "No extracted data" })
      continue
    }

    const expense: AccountingExpense = {
      vendorName: extracted.vendorName || "Unknown",
      amount: extracted.totalAmount || 0,
      tax: extracted.totalTax || 0,
      currency: extracted.currency || "USD",
      date: extracted.documentDate
        ? extracted.documentDate.toISOString().split("T")[0]!
        : new Date().toISOString().split("T")[0]!,
      description: `${extracted.vendorName || "Document"} - ${extracted.documentNumber || docId}`,
      documentNumber: extracted.documentNumber,
      lineItems: (extracted.lineItems as AccountingExpense["lineItems"]) || [],
    }

    let result
    switch (provider) {
      case "morning":
        if (!credentials.apiKey || !credentials.apiSecret) {
          result = { success: false, error: "Morning API credentials required" }
        } else {
          result = await exportToMorning(
            credentials.apiKey,
            credentials.apiSecret,
            expense
          )
        }
        break
      default:
        result = {
          success: false,
          error: `${provider} integration coming soon`,
        }
    }

    // Update document status on success
    if (result.success) {
      await db
        .update(documents)
        .set({ status: "exported" })
        .where(eq(documents.id, docId))
    }

    results.push({ documentId: docId, ...result })
  }

  return NextResponse.json({ results })
}
