import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/server/db"
import { categories, orgMembers, users } from "@/server/db/schema"

const createSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
  icon: z.string().max(50).optional(),
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
    .from(categories)
    .where(eq(categories.orgId, orgId))

  return NextResponse.json({ categories: result })
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

  const [category] = await db
    .insert(categories)
    .values({
      orgId,
      name: parsed.data.name,
      color: parsed.data.color,
      icon: parsed.data.icon,
    })
    .returning()

  return NextResponse.json({ category }, { status: 201 })
}
