import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/server/db"
import { organizations, orgMembers, users } from "@/server/db/schema"

const linkSchema = z.object({
  phoneNumber: z.string().regex(/^\+\d{10,15}$/, "Invalid phone number format"),
})

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1)

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const [membership] = await db
    .select()
    .from(orgMembers)
    .where(eq(orgMembers.userId, user.id))
    .limit(1)

  const orgId = membership ? membership.orgId : user.id

  const body = await req.json()
  const parsed = linkSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const [updated] = await db
    .update(organizations)
    .set({ whatsappNumber: parsed.data.phoneNumber })
    .where(eq(organizations.id, orgId))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    whatsappNumber: updated.whatsappNumber,
  })
}

export async function DELETE() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1)

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const [membership] = await db
    .select()
    .from(orgMembers)
    .where(eq(orgMembers.userId, user.id))
    .limit(1)

  const orgId = membership ? membership.orgId : user.id

  await db
    .update(organizations)
    .set({ whatsappNumber: null })
    .where(eq(organizations.id, orgId))

  return NextResponse.json({ success: true })
}
