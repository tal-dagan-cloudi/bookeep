import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"

import { db } from "@/server/db"
import { emailAccounts, orgMembers, users } from "@/server/db/schema"

export async function GET() {
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

  const accounts = await db
    .select({
      id: emailAccounts.id,
      provider: emailAccounts.provider,
      emailAddress: emailAccounts.emailAddress,
      syncStatus: emailAccounts.syncStatus,
      lastSyncAt: emailAccounts.lastSyncAt,
      createdAt: emailAccounts.createdAt,
    })
    .from(emailAccounts)
    .where(eq(emailAccounts.orgId, orgId))

  return NextResponse.json({ accounts })
}
