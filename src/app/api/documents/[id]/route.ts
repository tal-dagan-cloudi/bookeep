import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { and, eq } from "drizzle-orm"

import { db } from "@/server/db"
import {
  documents,
  extractedData,
  orgMembers,
  users,
} from "@/server/db/schema"

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params
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

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request, { params }: RouteParams) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await db
    .update(documents)
    .set({ status: "trash", updatedAt: new Date() })
    .where(eq(documents.id, id))

  return NextResponse.json({ success: true })
}
