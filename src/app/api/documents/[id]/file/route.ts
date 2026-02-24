import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"

import { getFile, getThumbnail } from "@/lib/storage"
import { db } from "@/server/db"
import { documents } from "@/server/db/schema"

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const thumbnail = url.searchParams.get("thumbnail") === "true"

  const doc = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1)

  if (doc.length === 0) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  const document = doc[0]

  try {
    if (thumbnail && document.thumbnailUrl) {
      const buffer = await getThumbnail(document.thumbnailUrl)
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=3600",
        },
      })
    }

    const buffer = await getFile(document.fileUrl)
    const contentType = getContentType(document.fileType)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }
}

function getContentType(fileType: string): string {
  const types: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
  }
  return types[fileType] || "application/octet-stream"
}
