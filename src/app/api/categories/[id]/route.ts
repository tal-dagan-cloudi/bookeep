import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/server/db"
import { categories } from "@/server/db/schema"

type RouteParams = { params: Promise<{ id: string }> }

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(50).optional(),
})

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const [updated] = await db
    .update(categories)
    .set(parsed.data)
    .where(eq(categories.id, id))
    .returning()

  if (!updated) {
    return NextResponse.json(
      { error: "Category not found" },
      { status: 404 }
    )
  }

  return NextResponse.json({ category: updated })
}

export async function DELETE(req: Request, { params }: RouteParams) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [deleted] = await db
    .delete(categories)
    .where(eq(categories.id, id))
    .returning()

  if (!deleted) {
    return NextResponse.json(
      { error: "Category not found" },
      { status: 404 }
    )
  }

  return NextResponse.json({ success: true })
}
