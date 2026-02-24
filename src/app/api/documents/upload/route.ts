import { NextResponse } from "next/server"
import { and, eq, gte, sql } from "drizzle-orm"

import { getAuthContext } from "@/lib/api-auth"
import { checkPlanLimits } from "@/lib/billing"
import { scheduleDocumentProcess } from "@/lib/queue"
import { rateLimitByUser } from "@/lib/rate-limit"
import { generateThumbnail, saveFile } from "@/lib/storage"
import { db } from "@/server/db"
import { documents } from "@/server/db/schema"

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]

export async function POST(req: Request) {
  const authResult = await getAuthContext()
  if (!authResult.success) return authResult.response

  const { dbUserId, orgId } = authResult.context

  // Rate limit: 30 uploads per minute
  const rl = await rateLimitByUser(dbUserId, "upload", 30, 60)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Please wait a moment." },
      { status: 429 }
    )
  }

  // Check plan limits
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [docCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(documents)
    .where(
      and(eq(documents.orgId, orgId), gte(documents.createdAt, startOfMonth))
    )

  const planCheck = await checkPlanLimits(
    orgId,
    "documents",
    Number(docCount.count)
  )

  if (!planCheck.allowed) {
    return NextResponse.json(
      {
        error: "Document limit reached for your plan",
        limit: planCheck.limit,
        used: planCheck.used,
      },
      { status: 403 }
    )
  }

  const formData = await req.formData()
  const files = formData.getAll("files") as File[]

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 })
  }

  if (files.length > 20) {
    return NextResponse.json(
      { error: "Maximum 20 files per upload" },
      { status: 400 }
    )
  }

  const results = []

  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      results.push({
        name: file.name,
        error: `Unsupported file type: ${file.type}`,
      })
      continue
    }

    if (file.size > MAX_FILE_SIZE) {
      results.push({
        name: file.name,
        error: "File exceeds 20MB limit",
      })
      continue
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const { filePath, fileType, fileSizeBytes } = await saveFile(
      buffer,
      file.name,
      orgId
    )

    let thumbnailUrl: string | null = null
    try {
      thumbnailUrl = await generateThumbnail(filePath, orgId)
    } catch {
      // Thumbnail generation is non-critical
    }

    const [doc] = await db
      .insert(documents)
      .values({
        orgId,
        uploadedByUserId: dbUserId,
        source: "upload",
        status: "pending",
        fileUrl: filePath,
        fileType,
        fileSizeBytes,
        thumbnailUrl,
      })
      .returning()

    // Queue for AI extraction
    await scheduleDocumentProcess(doc.id)

    results.push({
      id: doc.id,
      name: file.name,
      status: doc.status,
      fileType,
      fileSizeBytes,
    })
  }

  return NextResponse.json({ documents: results })
}
