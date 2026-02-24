import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"

import { generateThumbnail, saveFile } from "@/lib/storage"
import { db } from "@/server/db"
import { documents, orgMembers, users } from "@/server/db/schema"

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]

export async function POST(req: Request) {
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

  // Get user's org (first one for now)
  const membership = await db
    .select()
    .from(orgMembers)
    .where(eq(orgMembers.userId, user[0].id))
    .limit(1)

  const orgId = membership.length > 0 ? membership[0].orgId : user[0].id

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
        uploadedByUserId: user[0].id,
        source: "upload",
        status: "pending",
        fileUrl: filePath,
        fileType,
        fileSizeBytes,
        thumbnailUrl,
      })
      .returning()

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
