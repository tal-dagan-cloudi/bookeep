import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"

import { getAuthContext } from "@/lib/api-auth"
import { scheduleDocumentProcess } from "@/lib/queue"
import { db } from "@/server/db"
import { documents, extractedData } from "@/server/db/schema"

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params
  const authResult = await getAuthContext()
  if (!authResult.success) return authResult.response

  const { orgId } = authResult.context

  const doc = await db
    .select()
    .from(documents)
    .leftJoin(extractedData, eq(documents.id, extractedData.documentId))
    .where(and(eq(documents.id, id), eq(documents.orgId, orgId)))
    .limit(1)

  if (doc.length === 0) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  return NextResponse.json({
    document: doc[0].documents,
    extractedData: doc[0].extracted_data,
  })
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params
  const authResult = await getAuthContext()
  if (!authResult.success) return authResult.response

  const body = await req.json()

  // Update extracted data if provided
  if (body.extractedData) {
    await db
      .update(extractedData)
      .set({
        ...body.extractedData,
        isUserEdited: true,
        updatedAt: new Date(),
      })
      .where(eq(extractedData.documentId, id))
  }

  // Update document status if provided
  if (body.status) {
    await db
      .update(documents)
      .set({
        status: body.status,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id))
  }

  // Re-extract if requested
  if (body.reextract) {
    await db
      .update(documents)
      .set({ status: "pending", updatedAt: new Date() })
      .where(eq(documents.id, id))
    await scheduleDocumentProcess(id)
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request, { params }: RouteParams) {
  const { id } = await params
  const authResult = await getAuthContext()
  if (!authResult.success) return authResult.response

  await db
    .update(documents)
    .set({ status: "trash", updatedAt: new Date() })
    .where(eq(documents.id, id))

  return NextResponse.json({ success: true })
}
