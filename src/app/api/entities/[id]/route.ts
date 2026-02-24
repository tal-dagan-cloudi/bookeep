import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/server/db"
import { businessEntities } from "@/server/db/schema"

type RouteParams = { params: Promise<{ id: string }> }

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  isDefault: z.boolean().optional(),
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

  // If setting as default, unset others first
  if (parsed.data.isDefault) {
    const [entity] = await db
      .select({ orgId: businessEntities.orgId })
      .from(businessEntities)
      .where(eq(businessEntities.id, id))
      .limit(1)

    if (entity) {
      await db
        .update(businessEntities)
        .set({ isDefault: false })
        .where(eq(businessEntities.orgId, entity.orgId))
    }
  }

  const [updated] = await db
    .update(businessEntities)
    .set(parsed.data)
    .where(eq(businessEntities.id, id))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 })
  }

  return NextResponse.json({ entity: updated })
}

export async function DELETE(req: Request, { params }: RouteParams) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [deleted] = await db
    .delete(businessEntities)
    .where(eq(businessEntities.id, id))
    .returning()

  if (!deleted) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
