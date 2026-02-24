import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/server/db"
import { businessEntities, orgMembers, users } from "@/server/db/schema"

const createSchema = z.object({
  name: z.string().min(1).max(255),
  isDefault: z.boolean().default(false),
})

async function getOrgId(clerkId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1)

  if (!user) return null

  const [membership] = await db
    .select()
    .from(orgMembers)
    .where(eq(orgMembers.userId, user.id))
    .limit(1)

  return membership ? membership.orgId : user.id
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const orgId = await getOrgId(userId)
  if (!orgId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const result = await db
    .select()
    .from(businessEntities)
    .where(eq(businessEntities.orgId, orgId))

  return NextResponse.json({ entities: result })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const orgId = await getOrgId(userId)
  if (!orgId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // If setting as default, unset other defaults
  if (parsed.data.isDefault) {
    await db
      .update(businessEntities)
      .set({ isDefault: false })
      .where(eq(businessEntities.orgId, orgId))
  }

  const [entity] = await db
    .insert(businessEntities)
    .values({
      orgId,
      name: parsed.data.name,
      isDefault: parsed.data.isDefault,
    })
    .returning()

  return NextResponse.json({ entity }, { status: 201 })
}
